const CircuitBreaker = require('opossum');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const { OTP, Transaction, TransactionReversal } = require('../models/index');
const User = require('../models/User');
const { generateOTP, sendOTP } = require('../services/otpService');
const { analyzeTransaction } = require('../services/fraudService');
const { notifySvc } = require('../services/services');
const { auditSvc }  = require('../services/services');
const { createLedgerEntries } = require('../services/ledgerService');
const logger = require('../utils/logger');

const CARBON = { food:.25, travel:.85, shopping:.15, utilities:.10, healthcare:.05, entertainment:.05, fuel:1.20, salary:0, other:.08 };
const calcCharges = (a,m) => { if(['INTERNAL','UPI'].includes(m)) return 0; if(m==='IMPS') return a<=10000?5:a<=100000?10:15; if(m==='NEFT') return a<=10000?2.5:a<=100000?5:a<=200000?15:25; if(m==='RTGS') return a<=500000?25:50; return 0; };

// Circuit breaker for OTP lookup
const otpBreaker = new CircuitBreaker(
  async (otp, identifier) => OTP.findOne({ identifier, otp, type:'transaction', used:false }),
  { timeout:3000, errorThresholdPercentage:50, resetTimeout:30000 }
);
otpBreaker.fallback(() => ({ _fallback:true }));
otpBreaker.on('open',  () => logger.error('🔴 OTP Circuit Breaker OPEN'));
otpBreaker.on('close', () => logger.info('🟢 OTP Circuit Breaker CLOSED'));

exports.sendTransactionOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.isFrozen) return res.status(403).json({ error:'Account frozen' });
    const otp = generateOTP();
    const identifier = user.phone || user.email;
    await OTP.deleteMany({ identifier, type:'transaction' });
    await OTP.create({ identifier, otp, type:'transaction', expiresAt:new Date(Date.now()+5*60*1000) });
    const result = await sendOTP({ phone:user.phone, email:user.email, name:user.firstName, otp, type:'transaction' });
    res.json({ message:'OTP sent', expiresIn:300, provider:result.provider, ...(result.otp && { devOtp:result.otp }) });
  } catch (err) { next(err); }
};

exports.transfer = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { toAccountNumber, amount, otp, idempotencyKey, transferMode='IMPS', description, category='other', remarks } = req.body;
    const iKey = idempotencyKey || uuidv4();

    // Idempotency check
    const existing = await Transaction.findOne({ idempotencyKey:iKey });
    if (existing) { await session.abortTransaction(); return res.json({ message:'Already processed', transaction:existing, idempotent:true }); }

    // OTP via circuit breaker
    const identifier = req.user.phone || req.user.email;
    const otpResult  = await otpBreaker.fire(otp, identifier);
    if (otpResult?._fallback) { await session.abortTransaction(); return res.status(503).json({ error:'OTP service unavailable. Try in 30 seconds.', fallback:true }); }
    if (!otpResult||otpResult.expiresAt<new Date()) { await session.abortTransaction(); await auditSvc.auditLog({ action:auditSvc.ACTIONS.OTP_FAILED, userId:req.user._id, metadata:{type:'transaction'}, ipAddress:req.ip, severity:'warn' }); return res.status(400).json({ error:'Invalid or expired OTP' }); }

    const sender = await User.findById(req.user._id).session(session);
    if (!sender?.isActive) { await session.abortTransaction(); return res.status(403).json({ error:'Account inactive' }); }
    if (sender.isFrozen)   { await session.abortTransaction(); return res.status(403).json({ error:'Account frozen. Contact GK Capital Bank.' }); }
    if (transferMode==='RTGS'&&parseFloat(amount)<200000) { await session.abortTransaction(); return res.status(400).json({ error:'RTGS minimum is ₹2,00,000' }); }

    const txAmount   = parseFloat(amount);
    const charges    = calcCharges(txAmount, transferMode);
    let   roundUpAmt = 0;
    if (sender.roundUpEnabled) roundUpAmt = Math.ceil(txAmount/10)*10 - txAmount;
    const totalDeduction = txAmount + charges + roundUpAmt;

    if (sender.balance < totalDeduction) { await session.abortTransaction(); return res.status(400).json({ error:`Insufficient balance. Need ₹${totalDeduction.toFixed(2)}, have ₹${sender.balance.toFixed(2)}` }); }
    if (sender.accountNumber===toAccountNumber) { await session.abortTransaction(); return res.status(400).json({ error:'Cannot transfer to own account' }); }

    const receiver = await User.findOne({ accountNumber:toAccountNumber }).session(session);
    if (!receiver) { await session.abortTransaction(); return res.status(404).json({ error:'Recipient account not found' }); }

    // Fraud check (non-blocking, runs after commit)
    const fraud = await analyzeTransaction(sender._id, sender.accountNumber, txAmount, toAccountNumber, { ip:req.ip });
    if (fraud.blocked) { await session.abortTransaction(); await auditSvc.auditLog({ action:auditSvc.ACTIONS.FRAUD_FLAGGED, userId:sender._id, metadata:{riskScore:fraud.riskScore,flags:fraud.flags}, ipAddress:req.ip, severity:'error' }); return res.status(403).json({ error:'Transaction blocked due to suspicious activity. Call 1800-GK-2024.', fraudFlags:fraud.flags }); }

    const carbonKg    = parseFloat(((txAmount/1000)*(CARBON[category]||.08)).toFixed(3));
    const senderBefore = sender.balance, receiverBefore = receiver.balance;

    // Atomic balance update
    await User.findByIdAndUpdate(sender._id,   { $inc:{ balance:-totalDeduction, roundUpBalance:roundUpAmt, carbonFootprint:carbonKg } }, { session });
    await User.findByIdAndUpdate(receiver._id, { $inc:{ balance:txAmount } }, { session });

    const [txDoc] = await Transaction.create([{
      idempotencyKey:iKey, fromAccountNumber:sender.accountNumber, toAccountNumber,
      fromUserId:sender._id, toUserId:receiver._id, amount:txAmount, charges, roundUpAmount:roundUpAmt,
      type:'transfer', category, description, transferMode, remarks, status:'completed',
      balanceBefore:senderBefore, balanceAfter:senderBefore-totalDeduction, carbonKg, riskScore:fraud.riskScore,
      processedAt:new Date(), ipAddress:req.ip,
    }], { session });

    // Credit entry for receiver
    await Transaction.create([{
      idempotencyKey:uuidv4(), fromAccountNumber:sender.accountNumber, toAccountNumber,
      fromUserId:sender._id, toUserId:receiver._id, amount:txAmount, type:'credit', category,
      description:`Credit from ${sender.accountNumber}`, transferMode, status:'completed',
      balanceBefore:receiverBefore, balanceAfter:receiverBefore+txAmount, processedAt:new Date(),
    }], { session });

    // Double-entry ledger
    const updatedReceiver = { ...receiver.toObject(), balance:receiverBefore+txAmount };
    await createLedgerEntries({ ...txDoc.toObject(), balanceAfter:senderBefore-totalDeduction }, { ...sender.toObject(), balance:senderBefore-totalDeduction }, updatedReceiver, session);

    otpResult.used=true; await otpResult.save({ session });
    await session.commitTransaction();

    // Post-commit async work
    const updatedSender = await User.findById(sender._id).lean();
    const txDetails = { amount:txAmount, charges, balanceAfter:updatedSender.balance, referenceNumber:iKey, toAccountNumber, fromAccountNumber:sender.accountNumber, transferMode };
    notifySvc.notifyTransfer(sender, receiver, txDetails).catch(()=>{});
    if (fraud.suspicious) notifySvc.notifySuspicious(sender, fraud).catch(()=>{});
    auditSvc.auditLog({ action:auditSvc.ACTIONS.TRANSFER_SUCCESS, userId:sender._id, accountNumber:sender.accountNumber, metadata:{ amount:txAmount, to:toAccountNumber, riskScore:fraud.riskScore }, ipAddress:req.ip });

    logger.info(`✅ Transfer: ${sender.accountNumber}→${toAccountNumber} ₹${txAmount} (risk:${fraud.riskScore})`);
    res.json({ message:'Transfer successful', transaction:{ referenceNumber:iKey, amount:txAmount, charges, roundUpAmount:roundUpAmt, balanceAfter:updatedSender.balance, status:'completed', timestamp:txDoc.processedAt, riskScore:fraud.riskScore, ...(fraud.suspicious && { fraudWarning:'Transaction flagged for review' }) } });
  } catch (err) { await session.abortTransaction(); await auditSvc.auditLog({ action:auditSvc.ACTIONS.TRANSFER_FAILED, userId:req.user?._id, metadata:{error:err.message}, ipAddress:req.ip, severity:'error' }); next(err); }
  finally { session.endSession(); }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { page=1, limit=20, type, category, startDate, endDate, search } = req.query;
    const acc = req.user.accountNumber;
    const filter = { $or:[{fromAccountNumber:acc},{toAccountNumber:acc}] };
    if (type==='credit') filter.toAccountNumber=acc;
    if (type==='debit')  filter.fromAccountNumber=acc;
    if (category) filter.category=category;
    if (startDate||endDate) { filter.createdAt={}; if(startDate) filter.createdAt.$gte=new Date(startDate); if(endDate) filter.createdAt.$lte=new Date(endDate+'T23:59:59'); }
    if (search) filter.$or=[{description:{$regex:search,$options:'i'}},{merchant:{$regex:search,$options:'i'}}];
    const [txs,total] = await Promise.all([Transaction.find(filter).sort({createdAt:-1}).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).lean(), Transaction.countDocuments(filter)]);
    res.json({ transactions:txs.map(t=>({...t,perspective:t.toAccountNumber===acc&&t.type==='credit'?'credit':'debit'})), pagination:{page:parseInt(page),limit:parseInt(limit),total,pages:Math.ceil(total/parseInt(limit))} });
  } catch (err) { next(err); }
};

exports.getInsights = async (req, res, next) => {
  try {
    const { period='30' } = req.query;
    const acc = req.user.accountNumber;
    const since = new Date(Date.now()-parseInt(period)*24*3600*1000);
    const [categorySpend,monthlyTrend] = await Promise.all([
      Transaction.aggregate([{$match:{fromAccountNumber:acc,type:{$in:['transfer','debit']},createdAt:{$gte:since},status:'completed'}},{$group:{_id:'$category',total:{$sum:'$amount'},count:{$sum:1}}},{$sort:{total:-1}}]),
      Transaction.aggregate([{$match:{$or:[{fromAccountNumber:acc},{toAccountNumber:acc}],status:'completed',createdAt:{$gte:new Date(Date.now()-180*24*3600*1000)}}},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$createdAt'}},spent:{$sum:{$cond:[{$eq:['$fromAccountNumber',acc]},'$amount',0]}},received:{$sum:{$cond:[{$and:[{$eq:['$toAccountNumber',acc]},{$eq:['$type','credit']}]},'$amount',0]}}}},{$sort:{_id:1}}]),
    ]);
    res.json({ categoryBreakdown:categorySpend, monthlyTrend });
  } catch (err) { next(err); }
};

exports.requestReversal = async (req, res, next) => {
  try {
    const { transactionId, reason } = req.body;
    const tx = await Transaction.findById(transactionId);
    if (!tx||tx.fromUserId?.toString()!==req.user._id.toString()) return res.status(404).json({ error:'Transaction not found' });
    if (tx.status!=='completed') return res.status(400).json({ error:'Only completed transactions can be reversed' });
    if ((Date.now()-tx.createdAt)>24*3600*1000) return res.status(400).json({ error:'Reversal window (24h) expired' });
    const exists = await TransactionReversal.findOne({ originalTransactionId:transactionId });
    if (exists) return res.status(409).json({ error:'Reversal already requested', status:exists.status });
    const reversal = await TransactionReversal.create({ originalTransactionId:transactionId, requestedBy:req.user._id, reason });
    res.status(201).json({ message:'Reversal submitted. Admin will review within 24 hours.', reversalId:reversal._id });
  } catch (err) { next(err); }
};
