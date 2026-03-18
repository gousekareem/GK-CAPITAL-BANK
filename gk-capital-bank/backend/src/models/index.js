const mongoose = require('mongoose');

// ── OTP ───────────────────────────────────────────────────────────────────────
const OTP = mongoose.model('OTP', new mongoose.Schema({
  identifier: { type: String, required: true },
  otp:        { type: String, required: true },
  type:       { type: String, enum: ['email_verify','password_reset','transaction','login'], required: true },
  expiresAt:  { type: Date,   required: true },
  used:       { type: Boolean, default: false },
  attempts:   { type: Number,  default: 0 },
}, { timestamps: true }));

// ── Beneficiary ───────────────────────────────────────────────────────────────
const Beneficiary = mongoose.model('Beneficiary', new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:          { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode:      { type: String, required: true },
  bankName:      { type: String, default: 'GKC' },
  nickname:      String,
  dailyLimit:    { type: Number, default: 100000 },
}, { timestamps: true }));

// ── Transaction ───────────────────────────────────────────────────────────────
const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  idempotencyKey:    { type: String, required: true, unique: true },
  fromAccountNumber: { type: String, required: true },
  toAccountNumber:   { type: String, required: true },
  fromUserId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUserId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount:            { type: Number, required: true, min: 1 },
  charges:           { type: Number, default: 0 },
  roundUpAmount:     { type: Number, default: 0 },
  type:              { type: String, enum: ['credit','debit','transfer','refund','emi','round_up'], required: true },
  category:          { type: String, enum: ['food','travel','shopping','utilities','healthcare','entertainment','education','fuel','salary','other'], default: 'other' },
  description:  String,
  merchant:     String,
  remarks:      String,
  status:       { type: String, enum: ['pending','processing','completed','failed','reversed'], default: 'pending' },
  failureReason:String,
  balanceBefore:Number,
  balanceAfter: Number,
  transferMode: { type: String, enum: ['NEFT','RTGS','IMPS','UPI','INTERNAL'], default: 'IMPS' },
  carbonKg:     { type: Number, default: 0 },
  riskScore:    { type: Number, default: 0 },
  processedAt:  Date,
  ipAddress:    String,
}, { timestamps: true }));

// ── Ledger (double-entry) ──────────────────────────────────────────────────────
const Ledger = mongoose.model('Ledger', new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  accountNumber: { type: String, required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  entryType:     { type: String, enum: ['debit','credit'], required: true },
  amount:        { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter:  { type: Number, required: true },
  description:   String,
  category:      String,
}, { timestamps: true }));

// ── FraudAlert ────────────────────────────────────────────────────────────────
const FraudAlert = mongoose.model('FraudAlert', new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accountNumber:   String,
  amount:          Number,
  toAccountNumber: String,
  transactionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  flags:           [String],
  riskScore:       { type: Number, default: 0 },
  reasons:         [String],
  severity:        { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  status:          { type: String, enum: ['open','reviewed','dismissed','blocked'], default: 'open' },
  blocked:         { type: Boolean, default: false },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote:      String,
  ipAddress:       String,
}, { timestamps: true }));

// ── AuditLog ──────────────────────────────────────────────────────────────────
const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({
  action:        { type: String, required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accountNumber: String,
  metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress:     String,
  userAgent:     String,
  severity:      { type: String, enum: ['info','warn','error'], default: 'info' },
  timestamp:     { type: Date, default: Date.now },
}));

// ── BehaviorProfile ───────────────────────────────────────────────────────────
const BehaviorProfile = mongoose.model('BehaviorProfile', new mongoose.Schema({
  userId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  accountNumber:        String,
  avgTypingSpeed:       { type: Number, default: 0 },
  avgMouseVelocity:     { type: Number, default: 0 },
  typingSpeedSamples:   [Number],
  knownIPs:             [String],
  knownCities:          [String],
  knownCountries:       [String],
  avgTransactionAmount: { type: Number, default: 0 },
  transactionAmounts:   [Number],
  totalTransactions:    { type: Number, default: 0 },
  recentTimestamps:     [Date],
  commonRecipients:     [String],
  suspiciousFlags:      { type: Number, default: 0 },
  lastUpdated:          { type: Date, default: Date.now },
}, { timestamps: true }));

// ── Session ───────────────────────────────────────────────────────────────────
const Session = mongoose.model('Session', new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId:   { type: String, required: true, unique: true },
  deviceInfo:  { userAgent: String, browser: String, os: String, device: String },
  ipAddress:   String,
  location:    { city: String, region: String, country: String, lat: Number, lon: Number },
  isActive:    { type: Boolean, default: true },
  lastActivity:{ type: Date, default: Date.now },
  expiresAt:   { type: Date, required: true },
}, { timestamps: true }));

// ── GeoAnomaly ────────────────────────────────────────────────────────────────
const GeoAnomaly = mongoose.model('GeoAnomaly', new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  event:       String,
  fromCity:    String, toCity: String,
  fromCountry: String, toCountry: String,
  ipAddress:   String,
  riskScore:   Number,
  resolved:    { type: Boolean, default: false },
}, { timestamps: true }));

// ── KYCDocument ───────────────────────────────────────────────────────────────
const KYCDocument = mongoose.model('KYCDocument', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  documents: [{
    type:       { type: String, enum: ['aadhaar','pan','passport','voter_id','driving_license'] },
    fileName:   String, filePath: String, mimeType: String, fileSize: Number,
    uploadedAt: { type: Date, default: Date.now },
    status:     { type: String, enum: ['pending','verified','rejected'], default: 'pending' },
    reviewNote: String,
  }],
  kycStatus: { type: String, enum: ['incomplete','pending','verified','rejected'], default: 'incomplete' },
}, { timestamps: true }));

// ── AgentLog ──────────────────────────────────────────────────────────────────
const AgentLog = mongoose.model('AgentLog', new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  input:      String, intent: String, entities: mongoose.Schema.Types.Mixed,
  action:     String, result: mongoose.Schema.Types.Mixed,
  confidence: Number, success: Boolean,
}, { timestamps: true }));

// ── QueueItem ─────────────────────────────────────────────────────────────────
const QueueItem = mongoose.model('QueueItem', new mongoose.Schema({
  type:        { type: String, required: true },
  payload:     mongoose.Schema.Types.Mixed,
  status:      { type: String, enum: ['pending','processing','done','failed'], default: 'pending' },
  attempts:    { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  error:       String,
  scheduledAt: { type: Date, default: Date.now },
  processedAt: Date,
}, { timestamps: true }));

// ── BNPLPlan ──────────────────────────────────────────────────────────────────
const BNPLPlan = mongoose.model('BNPLPlan', new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalAmount:   Number, emiAmount: Number, tenure: Number,
  interestRate:     { type: Number, default: 12 }, totalAmount: Number,
  paidInstallments: { type: Number, default: 0 }, nextDueDate: Date,
  status:           { type: String, enum: ['active','completed','defaulted'], default: 'active' },
  transactionRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  description:      String,
  installments: [{ number: Number, dueDate: Date, amount: Number, status: { type: String, default: 'pending' }, paidAt: Date }],
}, { timestamps: true }));

// ── ScheduledTransaction ──────────────────────────────────────────────────────
const ScheduledTransaction = mongoose.model('ScheduledTransaction', new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromAccountNumber: { type: String, required: true },
  toAccountNumber:   { type: String, required: true },
  amount:            { type: Number, required: true },
  description:       String,
  transferMode:      { type: String, default: 'IMPS' },
  category:          { type: String, default: 'other' },
  scheduledAt:       { type: Date, required: true },
  status:            { type: String, enum: ['pending','executed','failed','cancelled'], default: 'pending' },
  recurring:         { enabled: Boolean, frequency: String, endDate: Date, nextRunAt: Date },
  executedAt:        Date,
  transactionRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  failureReason:     String,
  retryCount:        { type: Number, default: 0 },
}, { timestamps: true }));

// ── TransactionReversal ───────────────────────────────────────────────────────
const TransactionReversal = mongoose.model('TransactionReversal', new mongoose.Schema({
  originalTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  requestedBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:                { type: String, required: true },
  status:                { type: String, enum: ['pending','approved','rejected','completed'], default: 'pending' },
  reversalTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  adminNote:             String, processedAt: Date,
}, { timestamps: true }));

module.exports = {
  OTP, Beneficiary, Transaction, Ledger, FraudAlert, AuditLog,
  BehaviorProfile, Session, GeoAnomaly, KYCDocument, AgentLog,
  QueueItem, BNPLPlan, ScheduledTransaction, TransactionReversal,
};
