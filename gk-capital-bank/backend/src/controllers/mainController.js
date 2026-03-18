const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { Transaction, FraudAlert, AuditLog, BNPLPlan, ScheduledTransaction, TransactionReversal, KYCDocument, Session, GeoAnomaly, Beneficiary } = require('../models/index');
const { generateStatement } = require('../services/statementService');
const { predictCashFlow, getLedgerStatement } = require('../services/ledgerService');
const { parseIntent, executeIntent } = require('../services/agentService');
const { sessionSvc, notifySvc, auditSvc } = require('../services/services');
const logger = require('../utils/logger');

// ── Account Dashboard ─────────────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean();
    const acc  = user.accountNumber;
    const [recentTx, monthlyCredit, monthlyDebit] = await Promise.all([
      Transaction.find({ $or:[{fromAccountNumber:acc},{toAccountNumber:acc}] }).sort({createdAt:-1}).limit(10).lean(),
      Transaction.aggregate([{$match:{toAccountNumber:acc,type:'credit',status:'completed',createdAt:{$gte:new Date(Date.now()-30*24*3600000)}}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
      Transaction.aggregate([{$match:{fromAccountNumber:acc,type:{$in:['transfer','debit']},status:'completed',createdAt:{$gte:new Date(Date.now()-30*24*3600000)}}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
    ]);
    res.json({ account:{ accountNumber:user.accountNumber, accountType:user.accountType, balance:user.balance, ifscCode:user.ifscCode, branchName:user.branchName, currency:user.currency, roundUpBalance:user.roundUpBalance||0, creditScore:user.creditScore||0, isKYCDone:user.isKYCDone, lastLogin:user.lastLogin }, summary:{ monthlyCredit:monthlyCredit[0]?.total||0, monthlyDebit:monthlyDebit[0]?.total||0 }, recentTransactions:recentTx.map(t=>({...t,perspective:t.toAccountNumber===acc&&t.type==='credit'?'credit':'debit'})) });
  } catch (e) { next(e); }
};

exports.getBalance = async (req, res, next) => {
  try { const u=await User.findById(req.user._id).select('balance accountNumber roundUpBalance').lean(); res.json({ balance:u.balance, accountNumber:u.accountNumber, roundUpBalance:u.roundUpBalance||0 }); }
  catch (e) { next(e); }
};

exports.getProfile    = async (req, res, next) => { try { res.json((await User.findById(req.user._id)).toSafeObject()); } catch (e) { next(e); } };
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed=['firstName','lastName','address','notificationPrefs','roundUpEnabled','panNumber'];
    const updates={};
    allowed.forEach(f=>{ if(req.body[f]!==undefined) updates[f]=req.body[f]; });
    const u=await User.findByIdAndUpdate(req.user._id,updates,{new:true,runValidators:true});
    res.json(u.toSafeObject());
  } catch (e) { next(e); }
};
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const u=await User.findById(req.user._id);
    if (!await u.comparePassword(currentPassword)) return res.status(400).json({ error:'Current password incorrect' });
    u.password=newPassword; await u.save();
    res.json({ message:'Password changed' });
  } catch (e) { next(e); }
};

exports.getCreditScore = async (req, res, next) => {
  try {
    const u=await User.findById(req.user._id);
    const txCount=await Transaction.countDocuments({fromAccountNumber:u.accountNumber,status:'completed'});
    const ageDays=Math.floor((Date.now()-u.createdAt)/(1000*60*60*24));
    let score=300;
    if(u.balance>=100000) score+=150; else if(u.balance>=50000) score+=100; else if(u.balance>=10000) score+=60; else score+=20;
    if(txCount>=50) score+=100; else if(txCount>=20) score+=70; else if(txCount>=5) score+=40;
    if(ageDays>=1825) score+=100; else if(ageDays>=365) score+=40; else score+=15;
    score=Math.max(300,Math.min(900,score));
    await User.findByIdAndUpdate(u._id,{creditScore:score});
    res.json({ score, rating:score>=750?'Excellent':score>=650?'Good':score>=550?'Fair':'Poor', factors:{ balance:u.balance, txCount, ageDays } });
  } catch (e) { next(e); }
};

exports.getCarbonFootprint = async (req, res, next) => {
  try { const u=await User.findById(req.user._id).select('carbonFootprint').lean(); res.json({ carbonKg:u.carbonFootprint||0 }); }
  catch (e) { next(e); }
};

// ── Statement ─────────────────────────────────────────────────────────────────
exports.downloadStatement = async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const u = await User.findById(req.user._id);
    const result = await generateStatement(u, parseInt(year), parseInt(month));
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="${result.fileName}"`);
    fs.createReadStream(result.filePath).pipe(res);
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.STATEMENT_GENERATED, userId:u._id, metadata:{year,month}, ipAddress:req.ip });
  } catch (e) { next(e); }
};

exports.getStatementSummary = async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const acc=req.user.accountNumber;
    const start=new Date(parseInt(year),parseInt(month)-1,1), end=new Date(parseInt(year),parseInt(month),0,23,59,59);
    const [credits,debits,count]=await Promise.all([
      Transaction.aggregate([{$match:{toAccountNumber:acc,type:'credit',createdAt:{$gte:start,$lte:end},status:'completed'}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
      Transaction.aggregate([{$match:{fromAccountNumber:acc,createdAt:{$gte:start,$lte:end},status:'completed'}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
      Transaction.countDocuments({$or:[{fromAccountNumber:acc},{toAccountNumber:acc}],createdAt:{$gte:start,$lte:end}}),
    ]);
    res.json({ year:parseInt(year), month:parseInt(month), totalCredit:credits[0]?.total||0, totalDebit:debits[0]?.total||0, transactions:count, downloadUrl:`/api/statements/${year}/${month}/download` });
  } catch (e) { next(e); }
};

// ── Scheduled ─────────────────────────────────────────────────────────────────
exports.createScheduled = async (req, res, next) => {
  try {
    const { toAccountNumber, amount, scheduledAt, description, transferMode, category, recurring, recurringFrequency, recurringEndDate } = req.body;
    const schedDate=new Date(scheduledAt);
    if(schedDate<=new Date()) return res.status(400).json({ error:'Date must be in the future' });
    const s=await ScheduledTransaction.create({ userId:req.user._id, fromAccountNumber:req.user.accountNumber, toAccountNumber, amount:parseFloat(amount), description, transferMode:transferMode||'IMPS', category:category||'other', scheduledAt:schedDate, recurring:{ enabled:!!recurring, frequency:recurringFrequency||'monthly', endDate:recurringEndDate?new Date(recurringEndDate):undefined, nextRunAt:schedDate } });
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.SCHEDULED_TX_CREATED, userId:req.user._id, metadata:{ amount, toAccountNumber, scheduledAt }, ipAddress:req.ip });
    res.status(201).json({ message:'Transfer scheduled', scheduled:s });
  } catch (e) { next(e); }
};

exports.getScheduled = async (req, res, next) => {
  try { res.json(await ScheduledTransaction.find({userId:req.user._id}).sort({scheduledAt:1}).lean()); }
  catch (e) { next(e); }
};

exports.cancelScheduled = async (req, res, next) => {
  try {
    const s=await ScheduledTransaction.findOne({_id:req.params.id,userId:req.user._id});
    if(!s) return res.status(404).json({ error:'Not found' });
    if(s.status!=='pending') return res.status(400).json({ error:'Can only cancel pending' });
    s.status='cancelled'; await s.save();
    res.json({ message:'Cancelled' });
  } catch (e) { next(e); }
};

// ── AI Agent ──────────────────────────────────────────────────────────────────
exports.agentCommand = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error:'Command text required' });
    const user  = await User.findById(req.user._id);
    const benes = await Beneficiary.find({ userId:req.user._id }).lean();
    const parsed = await parseIntent(text, req.user._id);
    const result = await executeIntent(parsed, user, benes);
    res.json({ command:text, intent:parsed.intent, confidence:parsed.confidence, response:result });
  } catch (e) { next(e); }
};

exports.cashFlowPredict = async (req, res, next) => {
  try { const u=await User.findById(req.user._id).lean(); res.json(await predictCashFlow(req.user._id,u.accountNumber,u.balance)); }
  catch (e) { next(e); }
};

exports.getLedger = async (req, res, next) => {
  try { res.json(await getLedgerStatement(req.user.accountNumber, req.query.startDate, req.query.endDate)); }
  catch (e) { next(e); }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const { period='30' }=req.query, acc=req.user.accountNumber;
    const since=new Date(Date.now()-parseInt(period)*24*3600*1000);
    const [cat,monthly]=await Promise.all([
      Transaction.aggregate([{$match:{fromAccountNumber:acc,type:{$in:['transfer','debit']},createdAt:{$gte:since},status:'completed'}},{$group:{_id:'$category',total:{$sum:'$amount'},count:{$sum:1},avgAmount:{$avg:'$amount'}}},{$sort:{total:-1}}]),
      Transaction.aggregate([{$match:{$or:[{fromAccountNumber:acc},{toAccountNumber:acc}],status:'completed',createdAt:{$gte:new Date(Date.now()-180*24*3600*1000)}}},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$createdAt'}},spent:{$sum:{$cond:[{$eq:['$fromAccountNumber',acc]},'$amount',0]}},received:{$sum:{$cond:[{$and:[{$eq:['$toAccountNumber',acc]},{$eq:['$type','credit']}]},'$amount',0]}}}},{$sort:{_id:1}}]),
    ]);
    res.json({ categoryBreakdown:cat, monthlyTrend:monthly, summary:{ totalSpent:cat.reduce((s,c)=>s+c.total,0), period:parseInt(period) } });
  } catch (e) { next(e); }
};

// ── Sessions ──────────────────────────────────────────────────────────────────
exports.getSessions = async (req, res, next) => {
  try {
    const sessions=await sessionSvc.getUserSessions(req.user._id);
    const currentId=req.headers['x-session-id'];
    res.json(sessions.map(s=>({ sessionId:s.sessionId, deviceInfo:s.deviceInfo, location:s.location, ipAddress:s.ipAddress, lastActivity:s.lastActivity, createdAt:s.createdAt, isCurrent:currentId===s.sessionId })));
  } catch (e) { next(e); }
};
exports.revokeSession    = async (req, res, next) => { try { await sessionSvc.revokeSession(req.params.sessionId,req.user._id); res.json({ message:'Session terminated' }); } catch (e) { next(e); } };
exports.revokeAllSessions= async (req, res, next) => { try { const c=await sessionSvc.revokeAllSessions(req.user._id); await User.findByIdAndUpdate(req.user._id,{refreshToken:null}); res.json({ message:`${c} session(s) terminated. Please login again.` }); } catch (e) { next(e); } };
exports.getGeoAnomalies  = async (req, res, next) => { try { res.json(await GeoAnomaly.find({userId:req.user._id}).sort({createdAt:-1}).limit(20).lean()); } catch (e) { next(e); } };

// ── KYC ──────────────────────────────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_PATH||'./uploads/kyc';
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});
const storage = multer.diskStorage({ destination:(req,file,cb)=>cb(null,uploadDir), filename:(req,file,cb)=>cb(null,`${req.user._id}_${Date.now()}${path.extname(file.originalname)}`) });
const uploadMiddleware = multer({ storage, fileFilter:(req,file,cb)=>{ const ok=['image/jpeg','image/png','image/jpg','application/pdf'].includes(file.mimetype); cb(ok?null:new Error('Only JPG, PNG, PDF allowed'), ok); }, limits:{fileSize:(parseInt(process.env.MAX_FILE_SIZE_MB)||5)*1024*1024} }).single('document');

exports.uploadKYC = (req, res, next) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ error:err.message });
    if (!req.file) return res.status(400).json({ error:'No file uploaded' });
    try {
      const validTypes=['aadhaar','pan','passport','voter_id','driving_license'];
      if (!validTypes.includes(req.body.documentType)) return res.status(400).json({ error:'Invalid document type' });
      const kyc=await KYCDocument.findOneAndUpdate({ userId:req.user._id }, { $push:{ documents:{ type:req.body.documentType, fileName:req.file.originalname, filePath:req.file.path, mimeType:req.file.mimetype, fileSize:req.file.size, status:'pending' } }, $set:{ kycStatus:'pending' } }, { upsert:true, new:true });
      await auditSvc.auditLog({ action:auditSvc.ACTIONS.KYC_UPLOADED, userId:req.user._id, metadata:{ type:req.body.documentType }, ipAddress:req.ip });
      res.json({ message:'Document uploaded. Verification pending.', kycStatus:kyc.kycStatus });
    } catch (e) { next(e); }
  });
};

exports.getKYCStatus = async (req, res, next) => {
  try {
    const kyc=await KYCDocument.findOne({userId:req.user._id}).lean();
    if(!kyc) return res.json({ kycStatus:'incomplete', documents:[] });
    res.json({ kycStatus:kyc.kycStatus, documents:kyc.documents.map(d=>({ type:d.type, status:d.status, uploadedAt:d.uploadedAt, reviewNote:d.reviewNote })) });
  } catch (e) { next(e); }
};

// ── Admin ─────────────────────────────────────────────────────────────────────
exports.getAdminDashboard = async (req, res, next) => {
  try {
    const [totalUsers,activeUsers,totalTx,vol,fraudAlerts,highRisk,recentTx]=await Promise.all([
      User.countDocuments(), User.countDocuments({isActive:true,isFrozen:false}),
      Transaction.countDocuments({status:'completed'}),
      Transaction.aggregate([{$match:{status:'completed'}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
      FraudAlert.countDocuments(), FraudAlert.countDocuments({severity:'high'}),
      Transaction.find({status:'completed'}).sort({createdAt:-1}).limit(10).populate('fromUserId','firstName lastName').lean(),
    ]);
    const topFlags=await FraudAlert.aggregate([{$unwind:'$flags'},{$group:{_id:'$flags',count:{$sum:1}}},{$sort:{count:-1}}]);
    res.json({ stats:{ totalUsers,activeUsers,totalTransactions:totalTx,totalVolume:vol[0]?.total||0,fraudAlerts,highRiskAlerts:highRisk }, recentTransactions:recentTx, fraudSummary:{ total:fraudAlerts, high:highRisk, topFlags } });
  } catch (e) { next(e); }
};

exports.listUsers = async (req, res, next) => {
  try {
    const { page=1, limit=20, search, frozen }=req.query;
    const filter={};
    if(search) filter.$or=[{firstName:{$regex:search,$options:'i'}},{email:{$regex:search,$options:'i'}},{accountNumber:{$regex:search,$options:'i'}}];
    if(frozen!==undefined) filter.isFrozen=frozen==='true';
    const [users,total]=await Promise.all([User.find(filter).select('-password -refreshToken').sort({createdAt:-1}).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).lean(), User.countDocuments(filter)]);
    res.json({ users, pagination:{page:parseInt(page),total,pages:Math.ceil(total/parseInt(limit))} });
  } catch (e) { next(e); }
};

exports.freezeAccount = async (req, res, next) => {
  try {
    const { userId, reason }=req.body;
    const u=await User.findByIdAndUpdate(userId,{isFrozen:true,frozenReason:reason},{new:true});
    if(!u) return res.status(404).json({ error:'User not found' });
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.ACCOUNT_FROZEN, userId:req.user._id, metadata:{targetUser:userId,reason}, ipAddress:req.ip, severity:'warn' });
    notifySvc.notifyAccountFreeze(u, reason).catch(()=>{});
    res.json({ message:`Account ${u.accountNumber} frozen` });
  } catch (e) { next(e); }
};

exports.unfreezeAccount = async (req, res, next) => {
  try {
    const { userId }=req.body;
    const u=await User.findByIdAndUpdate(userId,{isFrozen:false,frozenReason:null,loginAttempts:0,lockUntil:null},{new:true});
    if(!u) return res.status(404).json({ error:'User not found' });
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.ACCOUNT_UNFROZEN, userId:req.user._id, metadata:{targetUser:userId}, ipAddress:req.ip });
    res.json({ message:`Account ${u.accountNumber} unfrozen` });
  } catch (e) { next(e); }
};

exports.getFraudAlerts = async (req, res, next) => {
  try {
    const { status, severity, page=1, limit=20 }=req.query;
    const filter={};
    if(status) filter.status=status;
    if(severity) filter.severity=severity;
    const [alerts,total]=await Promise.all([FraudAlert.find(filter).sort({createdAt:-1}).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).populate('userId','firstName lastName email accountNumber phone').lean(), FraudAlert.countDocuments(filter)]);
    res.json({ alerts, pagination:{page:parseInt(page),total,pages:Math.ceil(total/parseInt(limit))} });
  } catch (e) { next(e); }
};

exports.reviewFraudAlert = async (req, res, next) => {
  try {
    const { status, reviewNote }=req.body;
    const alert=await FraudAlert.findByIdAndUpdate(req.params.id,{status,reviewNote,reviewedBy:req.user._id},{new:true});
    if(!alert) return res.status(404).json({ error:'Alert not found' });
    res.json(alert);
  } catch (e) { next(e); }
};

exports.getAuditLogs = async (req, res, next) => {
  try { res.json(await auditSvc.getAuditLogs(req.query)); } catch (e) { next(e); }
};

exports.getReversals = async (req, res, next) => {
  try { res.json(await TransactionReversal.find().populate('originalTransactionId').populate('requestedBy','firstName lastName email accountNumber').sort({createdAt:-1}).lean()); }
  catch (e) { next(e); }
};

exports.processReversal = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { reversalId, approve, adminNote }=req.body;
    const reversal=await TransactionReversal.findById(reversalId).populate('originalTransactionId');
    if(!reversal) { await session.abortTransaction(); return res.status(404).json({ error:'Not found' }); }
    if(reversal.status!=='pending') { await session.abortTransaction(); return res.status(400).json({ error:'Already processed' }); }
    if(!approve) { reversal.status='rejected'; reversal.adminNote=adminNote; reversal.processedAt=new Date(); await reversal.save(); await session.commitTransaction(); return res.json({ message:'Rejected' }); }
    const orig=reversal.originalTransactionId;
    await User.findOneAndUpdate({accountNumber:orig.fromAccountNumber},{$inc:{balance:orig.amount}},{session});
    await User.findOneAndUpdate({accountNumber:orig.toAccountNumber},{$inc:{balance:-orig.amount}},{session});
    const [revTx]=await Transaction.create([{ idempotencyKey:uuidv4(), fromAccountNumber:orig.toAccountNumber, toAccountNumber:orig.fromAccountNumber, amount:orig.amount, type:'refund', description:`Reversal of ${orig.idempotencyKey?.slice(0,16)}`, status:'completed', processedAt:new Date() }],{session});
    orig.status='reversed'; await orig.save({session});
    reversal.status='completed'; reversal.reversalTransactionId=revTx._id; reversal.adminNote=adminNote; reversal.processedAt=new Date();
    await reversal.save({session}); await session.commitTransaction();
    res.json({ message:'Reversal processed', reversalTxId:revTx._id });
  } catch (e) { await session.abortTransaction(); next(e); }
  finally { session.endSession(); }
};
