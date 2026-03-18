const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  customerId:    { type: String, unique: true },
  firstName:     { type: String, required: true, trim: true },
  lastName:      { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, required: true, unique: true, trim: true },
  password:      { type: String, required: true, minlength: 8 },
  dateOfBirth:   Date,
  panNumber:     { type: String, uppercase: true },
  address: { line1: String, line2: String, city: String, state: String, pincode: String, country: { type: String, default: 'India' } },
  accountNumber:   { type: String, unique: true },
  accountType:     { type: String, enum: ['savings','current','salary'], default: 'savings' },
  balance:         { type: Number, default: 0, min: 0 },
  currency:        { type: String, default: 'INR' },
  ifscCode:        { type: String, default: 'GKCB0000001' },
  branchName:      { type: String, default: 'Main Branch' },
  isActive:        { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  isKYCDone:       { type: Boolean, default: false },
  isFrozen:        { type: Boolean, default: false },
  frozenReason:    String,
  isAdmin:         { type: Boolean, default: false },
  mfaEnabled:      { type: Boolean, default: true },
  loginAttempts:   { type: Number, default: 0 },
  lockUntil:       Date,
  lastLogin:       Date,
  passwordChangedAt: Date,
  creditScore:     { type: Number, default: 0 },
  roundUpEnabled:  { type: Boolean, default: false },
  roundUpBalance:  { type: Number, default: 0 },
  carbonFootprint: { type: Number, default: 0 },
  notificationPrefs: { sms: { type: Boolean, default: true }, email: { type: Boolean, default: true }, push: { type: Boolean, default: true } },
  refreshToken: String,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });
userSchema.virtual('isLocked').get(function () { return !!(this.lockUntil && this.lockUntil > Date.now()); });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.pre('save', function (next) {
  if (!this.customerId)    this.customerId    = 'GKC' + Date.now().toString().slice(-7) + Math.floor(Math.random()*1000).toString().padStart(3,'0');
  if (!this.accountNumber) this.accountNumber = '40' + Date.now().toString().slice(-9) + Math.floor(Math.random()*10);
  next();
});

userSchema.methods.comparePassword      = async function (c) { return bcrypt.compare(c, this.password); };
userSchema.methods.changedPasswordAfter = function (t) { return this.passwordChangedAt && parseInt(this.passwordChangedAt.getTime()/1000) > t; };
userSchema.methods.toSafeObject         = function () { const o = this.toObject(); delete o.password; delete o.refreshToken; return o; };

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ accountNumber: 1 });
userSchema.index({ customerId: 1 });

module.exports = mongoose.model('User', userSchema);
