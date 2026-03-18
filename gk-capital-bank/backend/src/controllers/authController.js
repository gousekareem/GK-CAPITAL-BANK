const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OTP } = require('../models/index');
const { generateOTP, sendOTP } = require('../services/otpService');
const { sessionSvc } = require('../services/services');
const { notifySvc }  = require('../services/services');
const { auditSvc }   = require('../services/services');
const logger = require('../utils/logger');

const signAccess  = (id) => jwt.sign({ id }, process.env.JWT_SECRET,         { expiresIn:'1h' });
const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET,  { expiresIn:'7d' });

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, dateOfBirth, panNumber } = req.body;
    const exists = await User.findOne({ $or:[{email},{phone}] });
    if (exists) return res.status(409).json({ error: exists.email===email ? 'Email already registered' : 'Phone already registered' });
    const user = await User.create({ firstName, lastName, email, phone, password, dateOfBirth, panNumber, balance:1000 });
    const otp = generateOTP();
    await OTP.create({ identifier:email, otp, type:'email_verify', expiresAt:new Date(Date.now()+10*60*1000) });
    const result = await sendOTP({ email, name:firstName, otp, type:'email_verify' });
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.REGISTER, userId:user._id, metadata:{ email, phone }, ipAddress:req.ip });
    res.status(201).json({ message:'Account created. Check email/terminal for verification OTP.', customerId:user.customerId, accountNumber:user.accountNumber, ...(result.otp && { devOtp:result.otp }) });
  } catch (err) { next(err); }
};

// Step 1: Validate credentials → send OTP → return tempToken
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const ip = req.ip, ua = req.headers['user-agent'];
    const user = await User.findOne({ $or:[{email:identifier},{customerId:identifier}] });
    if (!user) { await auditSvc.auditLog({ action:auditSvc.ACTIONS.LOGIN_FAILED, metadata:{identifier,reason:'not found'}, ipAddress:ip, severity:'warn' }); return res.status(401).json({ error:'Invalid credentials' }); }
    if (user.isFrozen) return res.status(403).json({ error:'Account frozen. Call 1800-GK-2024.' });
    if (user.isLocked) return res.status(423).json({ error:'Account locked. Try again in 30 minutes.', lockUntil:user.lockUntil });
    const valid = await user.comparePassword(password);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts||0)+1;
      if (user.loginAttempts >= 5) user.lockUntil = new Date(Date.now()+30*60*1000);
      await user.save();
      await auditSvc.auditLog({ action:auditSvc.ACTIONS.LOGIN_FAILED, userId:user._id, metadata:{reason:'wrong password', attempts:user.loginAttempts}, ipAddress:ip, severity:'warn' });
      return res.status(401).json({ error:`Invalid credentials. ${Math.max(0,5-user.loginAttempts)} attempts left.` });
    }
    // Send 2FA OTP
    const otp = generateOTP();
    const identifier2 = user.phone || user.email;
    await OTP.deleteMany({ identifier:identifier2, type:'login' });
    await OTP.create({ identifier:identifier2, otp, type:'login', expiresAt:new Date(Date.now()+5*60*1000) });
    const result = await sendOTP({ phone:user.phone, email:user.email, name:user.firstName, otp, type:'login' });
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.OTP_SENT, userId:user._id, metadata:{ type:'login', provider:result.provider }, ipAddress:ip });
    const tempToken = jwt.sign({ id:user._id, step:'2fa_pending' }, process.env.JWT_SECRET, { expiresIn:'5m' });
    res.json({ message:'OTP sent. Enter it to complete login.', tempToken, phone:user.phone?`****${user.phone.slice(-4)}`:undefined, email:user.email?.replace(/(.{2}).+(@.+)/,'$1****$2'), ...(result.otp && { devOtp:result.otp }) });
  } catch (err) { next(err); }
};

// Step 2: Verify OTP → issue full JWT
exports.verifyLoginOTP = async (req, res, next) => {
  try {
    const { tempToken, otp } = req.body;
    let decoded;
    try { decoded = jwt.verify(tempToken, process.env.JWT_SECRET); } catch { return res.status(401).json({ error:'Session expired. Please login again.' }); }
    if (decoded.step !== '2fa_pending') return res.status(401).json({ error:'Invalid token' });
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error:'User not found' });
    const identifier = user.phone || user.email;
    const otpDoc = await OTP.findOne({ identifier, otp, type:'login', used:false });
    if (!otpDoc || otpDoc.expiresAt < new Date()) {
      user.loginAttempts = (user.loginAttempts||0)+1;
      await user.save();
      await auditSvc.auditLog({ action:auditSvc.ACTIONS.OTP_FAILED, userId:user._id, metadata:{type:'login'}, ipAddress:req.ip, severity:'warn' });
      return res.status(400).json({ error:'Invalid or expired OTP' });
    }
    otpDoc.used = true;
    await otpDoc.save();
    user.loginAttempts = 0; user.lockUntil = undefined; user.lastLogin = new Date();
    const accessToken = signAccess(user._id), refreshToken = signRefresh(user._id);
    user.refreshToken = refreshToken;
    await user.save();
    await sessionSvc.createSession(user._id, req.ip, req.headers['user-agent']).catch(()=>{});
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.LOGIN_SUCCESS, userId:user._id, accountNumber:user.accountNumber, metadata:{ ip:req.ip }, ipAddress:req.ip });
    notifySvc.notifyLogin(user, { ip:req.ip, userAgent:req.headers['user-agent'] }).catch(()=>{});
    res.json({ accessToken, refreshToken, user:user.toSafeObject() });
  } catch (err) { next(err); }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error:'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user||user.refreshToken!==refreshToken) return res.status(401).json({ error:'Invalid refresh token' });
    const newAccess=signAccess(user._id), newRefresh=signRefresh(user._id);
    user.refreshToken=newRefresh; await user.save();
    res.json({ accessToken:newAccess, refreshToken:newRefresh });
  } catch (err) { if (err.name==='JsonWebTokenError'||err.name==='TokenExpiredError') return res.status(401).json({ error:'Invalid or expired refresh token' }); next(err); }
};

exports.logout = async (req, res, next) => {
  try { await User.findByIdAndUpdate(req.user._id,{refreshToken:null}); await auditSvc.auditLog({ action:auditSvc.ACTIONS.LOGOUT, userId:req.user._id, ipAddress:req.ip }); res.json({ message:'Logged out' }); }
  catch (err) { next(err); }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const otpDoc = await OTP.findOne({ identifier:email, otp, type:'email_verify', used:false });
    if (!otpDoc||otpDoc.expiresAt<new Date()) return res.status(400).json({ error:'Invalid or expired OTP' });
    await User.findOneAndUpdate({ email },{ isEmailVerified:true });
    otpDoc.used=true; await otpDoc.save();
    res.json({ message:'Email verified' });
  } catch (err) { next(err); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ message:'If account exists, OTP has been sent' });
    const otp = generateOTP();
    await OTP.deleteMany({ identifier:email, type:'password_reset' });
    await OTP.create({ identifier:email, otp, type:'password_reset', expiresAt:new Date(Date.now()+10*60*1000) });
    await sendOTP({ email, name:user.firstName, otp, type:'password_reset' });
    res.json({ message:'If account exists, OTP has been sent' });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpDoc = await OTP.findOne({ identifier:email, otp, type:'password_reset', used:false });
    if (!otpDoc||otpDoc.expiresAt<new Date()) return res.status(400).json({ error:'Invalid or expired OTP' });
    const user = await User.findOne({ email });
    user.password=newPassword; await user.save();
    otpDoc.used=true; await otpDoc.save();
    await auditSvc.auditLog({ action:auditSvc.ACTIONS.PASSWORD_CHANGED, userId:user._id, ipAddress:req.ip });
    res.json({ message:'Password reset successfully' });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try { res.json((await User.findById(req.user._id)).toSafeObject()); } catch (err) { next(err); }
};
