require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const { body }   = require('express-validator');
const validate   = require('./middleware/validate');
const { protect }= require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { connectDB } = require('./config/database');
const logger     = require('./utils/logger');
const authCtrl   = require('./controllers/authController');
const txCtrl     = require('./controllers/transactionController');
const ctrl       = require('./controllers/mainController');
const { OTP, Beneficiary, BNPLPlan } = require('./models/index');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy:{ policy:'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials:true }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs:15*60*1000, max:300 }));
app.use('/api/auth/login', rateLimit({ windowMs:15*60*1000, max:10, skipSuccessfulRequests:true }));
app.use('/api/auth/login/verify-otp', rateLimit({ windowMs:15*60*1000, max:10 }));
app.use('/api/transactions/otp', rateLimit({ windowMs:60*1000, max:3 }));
app.use('/api/transactions/transfer', rateLimit({ windowMs:60*1000, max:5 }));

// ── Swagger (simple) ──────────────────────────────────────────────────────────
try {
  const swaggerUi = require('swagger-ui-express');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup({ openapi:'3.0.0', info:{ title:'GK Capital Bank API v3', version:'3.0.0' }, servers:[{ url:`http://localhost:${process.env.PORT||5000}` }] }));
} catch {}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status:'healthy', version:'3.0.0', timestamp:new Date(), uptime:process.uptime() }));

// ─────────────────────── AUTH ROUTES ─────────────────────────────────────────
app.post('/api/auth/register', [body('firstName').notEmpty(), body('lastName').notEmpty(), body('email').isEmail().normalizeEmail(), body('phone').isLength({min:10,max:10}).withMessage('10-digit phone required'), body('password').isLength({min:8}).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Need upper, lower & number')], validate, authCtrl.register);
app.post('/api/auth/login', [body('identifier').notEmpty(), body('password').notEmpty()], validate, authCtrl.login);
app.post('/api/auth/login/verify-otp', [body('tempToken').notEmpty(), body('otp').isLength({min:6,max:6})], validate, authCtrl.verifyLoginOTP);
app.post('/api/auth/refresh-token', authCtrl.refreshToken);
app.post('/api/auth/logout',          protect, authCtrl.logout);
app.post('/api/auth/verify-email',    authCtrl.verifyEmail);
app.post('/api/auth/forgot-password', authCtrl.forgotPassword);
app.post('/api/auth/reset-password',  authCtrl.resetPassword);
app.get('/api/auth/me',               protect, authCtrl.me);

// ─────────────────────── ACCOUNT ROUTES ──────────────────────────────────────
app.get('/api/accounts/dashboard', protect, ctrl.getDashboard);
app.get('/api/accounts/balance',   protect, ctrl.getBalance);

// ─────────────────────── TRANSACTION ROUTES ───────────────────────────────────
app.post('/api/transactions/otp/send', protect, txCtrl.sendTransactionOTP);
app.post('/api/transactions/transfer',  protect, [body('toAccountNumber').notEmpty(), body('amount').isFloat({min:1}), body('otp').isLength({min:6,max:6})], validate, txCtrl.transfer);
app.get('/api/transactions/history',    protect, txCtrl.getHistory);
app.get('/api/transactions/insights',   protect, txCtrl.getInsights);
app.post('/api/transactions/reversal/request', protect, [body('transactionId').notEmpty(), body('reason').isLength({min:10})], validate, txCtrl.requestReversal);

// ─────────────────────── BENEFICIARY ROUTES ───────────────────────────────────
app.get('/api/beneficiaries', protect, async (req, res, next) => {
  try { res.json(await Beneficiary.find({userId:req.user._id}).sort({createdAt:-1}).lean()); } catch(e) { next(e); }
});
app.post('/api/beneficiaries', protect, [body('name').notEmpty(), body('accountNumber').notEmpty(), body('ifscCode').notEmpty()], validate, async (req, res, next) => {
  try {
    const { name,accountNumber,ifscCode,bankName,nickname }=req.body;
    const exists=await Beneficiary.findOne({userId:req.user._id,accountNumber});
    if(exists) return res.status(409).json({ error:'Beneficiary already exists' });
    res.status(201).json(await Beneficiary.create({userId:req.user._id,name,accountNumber,ifscCode,bankName:bankName||'GKC',nickname}));
  } catch(e) { next(e); }
});
app.delete('/api/beneficiaries/:id', protect, async (req, res, next) => {
  try { const b=await Beneficiary.findOneAndDelete({_id:req.params.id,userId:req.user._id}); if(!b) return res.status(404).json({error:'Not found'}); res.json({message:'Removed'}); } catch(e) { next(e); }
});

// ─────────────────────── PROFILE ROUTES ──────────────────────────────────────
app.get('/api/profile',                    protect, ctrl.getProfile);
app.patch('/api/profile',                  protect, ctrl.updateProfile);
app.post('/api/profile/change-password',   protect, ctrl.changePassword);

// ─────────────────────── OTP ──────────────────────────────────────────────────
app.post('/api/otp/send', protect, txCtrl.sendTransactionOTP);

// ─────────────────────── BNPL ROUTES ─────────────────────────────────────────
app.post('/api/bnpl/convert', protect, [body('amount').isFloat({min:1000}), body('tenure').isIn([3,6,12,24])], validate, async (req, res, next) => {
  try {
    const { amount,tenure,description }=req.body;
    const r=12/12/100, emi=Math.ceil((amount*r*Math.pow(1+r,tenure))/(Math.pow(1+r,tenure)-1));
    const installments=Array.from({length:tenure},(_,i)=>({ number:i+1, amount:emi, status:'pending', dueDate:new Date(Date.now()+(i+1)*30*24*3600*1000) }));
    const plan=await BNPLPlan.create({ userId:req.user._id, originalAmount:amount, emiAmount:emi, tenure, totalAmount:emi*tenure, interestRate:12, description:description||'BNPL Plan', nextDueDate:installments[0].dueDate, installments });
    res.status(201).json({ plan, summary:{ emiAmount:emi, tenure, totalAmount:emi*tenure, totalInterest:emi*tenure-amount } });
  } catch(e) { next(e); }
});
app.get('/api/bnpl/plans', protect, async (req, res, next) => { try { res.json(await BNPLPlan.find({userId:req.user._id}).sort({createdAt:-1}).lean()); } catch(e) { next(e); } });

// ─────────────────────── AI ROUTES ───────────────────────────────────────────
app.get('/api/ai/credit-score',     protect, ctrl.getCreditScore);
app.get('/api/ai/carbon-footprint', protect, ctrl.getCarbonFootprint);

// ─────────────────────── STATEMENT ROUTES ────────────────────────────────────
app.get('/api/statements/:year/:month/summary',  protect, ctrl.getStatementSummary);
app.get('/api/statements/:year/:month/download', protect, ctrl.downloadStatement);

// ─────────────────────── SCHEDULED ROUTES ────────────────────────────────────
app.post('/api/scheduled',    protect, [body('toAccountNumber').notEmpty(), body('amount').isFloat({min:1}), body('scheduledAt').isISO8601()], validate, ctrl.createScheduled);
app.get('/api/scheduled',     protect, ctrl.getScheduled);
app.delete('/api/scheduled/:id', protect, ctrl.cancelScheduled);

// ─────────────────────── AGENT ROUTES ────────────────────────────────────────
app.post('/api/agent/command',  protect, ctrl.agentCommand);
app.get('/api/agent/cashflow',  protect, ctrl.cashFlowPredict);

// ─────────────────────── ANALYTICS ROUTES ────────────────────────────────────
app.get('/api/analytics',       protect, ctrl.getAnalytics);
app.get('/api/analytics/ledger',protect, ctrl.getLedger);
app.get('/api/analytics/geo',   protect, ctrl.getGeoAnomalies);

// ─────────────────────── SESSION ROUTES ──────────────────────────────────────
app.get('/api/sessions',               protect, ctrl.getSessions);
app.delete('/api/sessions/:sessionId', protect, ctrl.revokeSession);
app.delete('/api/sessions',            protect, ctrl.revokeAllSessions);

// ─────────────────────── KYC ROUTES ──────────────────────────────────────────
app.post('/api/kyc/upload', protect, ctrl.uploadKYC);
app.get('/api/kyc/status',  protect, ctrl.getKYCStatus);

// ─────────────────────── ADMIN ROUTES ────────────────────────────────────────
app.get('/api/admin/dashboard',          protect, ctrl.getAdminDashboard);
app.get('/api/admin/users',              protect, ctrl.listUsers);
app.post('/api/admin/freeze',            protect, ctrl.freezeAccount);
app.post('/api/admin/unfreeze',          protect, ctrl.unfreezeAccount);
app.get('/api/admin/fraud/alerts',       protect, ctrl.getFraudAlerts);
app.patch('/api/admin/fraud/:id',        protect, ctrl.reviewFraudAlert);
app.get('/api/admin/audit-logs',         protect, ctrl.getAuditLogs);
app.get('/api/admin/reversals',          protect, ctrl.getReversals);
app.post('/api/admin/reversals/process', protect, ctrl.processReversal);

app.use('*', (req, res) => res.status(404).json({ error:'Route not found' }));
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`\n🏦 GK Capital Bank Server v3.0 → http://localhost:${PORT}`);
    logger.info(`📚 Swagger → http://localhost:${PORT}/api-docs`);
    logger.info(`📱 OTP Provider: ${process.env.SMS_PROVIDER || 'console'}`);
    logger.info(`🤖 AI Agent: ${process.env.AI_USE_OPENAI==='true'?'OpenAI GPT':'Keyword Parser'}\n`);
  });

  // Start scheduler
  try { const { registerJobs } = require('./workers/schedulerWorker'); registerJobs(); }
  catch (e) { logger.warn('Scheduler worker not loaded: ' + e.message); }
};

start().catch(err => { logger.error(err); process.exit(1); });
module.exports = app;
