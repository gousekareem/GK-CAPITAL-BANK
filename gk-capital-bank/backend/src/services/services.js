// ── Session Service ───────────────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');
const { Session, GeoAnomaly, BehaviorProfile } = require('../models/index');
const logger = require('../utils/logger');

let geoip;
try { geoip = require('geoip-lite'); } catch { geoip = null; }

const getLocation = (ip) => {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || !geoip) return { city: 'Local', region: 'Dev', country: 'IN' };
  const geo = geoip.lookup(ip);
  return geo ? { city: geo.city || 'Unknown', region: geo.region, country: geo.country, lat: geo.ll?.[0] || 0, lon: geo.ll?.[1] || 0 } : { city: 'Unknown', region: '', country: 'Unknown' };
};

const parseDevice = (ua = '') => ({
  userAgent: ua.slice(0, 200),
  browser:   ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : 'Unknown',
  os:        ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : ua.includes('Linux') ? 'Linux' : 'Unknown',
  device:    ua.includes('Mobile') ? 'Mobile' : 'Desktop',
});

const createSession = async (userId, ip, userAgent) => {
  const sessionId  = uuidv4();
  const deviceInfo = parseDevice(userAgent);
  const location   = getLocation(ip);
  const expiresAt  = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const active = await Session.countDocuments({ userId, isActive: true });
  const maxS   = parseInt(process.env.MAX_SESSIONS_PER_USER) || 5;
  if (active >= maxS) {
    const oldest = await Session.findOne({ userId, isActive: true }).sort({ createdAt: 1 });
    if (oldest) { oldest.isActive = false; await oldest.save(); }
  }

  const session = await Session.create({ userId, sessionId, deviceInfo, ipAddress: ip, location, expiresAt });

  // Geo anomaly check
  try {
    const profile = await BehaviorProfile.findOne({ userId });
    if (profile?.knownCities?.length) {
      let riskScore = 0;
      if (!profile.knownCountries?.includes(location.country) && location.country !== 'Unknown') riskScore += 50;
      else if (!profile.knownCities?.includes(location.city) && location.city !== 'Unknown') riskScore += 25;
      if (riskScore >= 25) {
        await GeoAnomaly.create({ userId, event: 'new_location', fromCity: profile.knownCities?.slice(-1)[0], toCity: location.city, fromCountry: profile.knownCountries?.[0], toCountry: location.country, ipAddress: ip, riskScore });
        logger.warn(`[Geo] New location for ${userId}: ${location.city}, ${location.country}`);
      }
    }
    await BehaviorProfile.findOneAndUpdate({ userId }, { $addToSet: { knownCities: location.city, knownCountries: location.country, knownIPs: ip }, lastUpdated: new Date() }, { upsert: true });
  } catch {}

  return session;
};

const getUserSessions  = async (userId) => Session.find({ userId, isActive: true }).sort({ createdAt: -1 }).lean();
const revokeSession    = async (sessionId, userId) => Session.updateOne({ sessionId, userId }, { isActive: false });
const revokeAllSessions= async (userId) => { const r = await Session.updateMany({ userId, isActive: true }, { isActive: false }); return r.modifiedCount; };
const cleanupSessions  = async () => { await Session.updateMany({ isActive: true, expiresAt: { $lt: new Date() } }, { isActive: false }); };

module.exports.sessionSvc = { createSession, getUserSessions, revokeSession, revokeAllSessions, cleanupSessions, getLocation };


// ── Notification Service ──────────────────────────────────────────────────────
const { sendNotificationEmail } = require('./otpService');
const fmtCur = (n) => `Rs. ${(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const fmtDt  = (d) => new Date(d||Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

const notifyLogin = async (user, meta = {}) => {
  const html = `<p>Dear <strong>${user.firstName}</strong>,</p><p>Successful login at <strong>${fmtDt()}</strong>.</p><table style="font-size:13px;width:100%"><tr><td style="padding:4px"><b>IP</b></td><td>${meta.ip||'Unknown'}</td></tr><tr><td><b>Device</b></td><td>${meta.userAgent?.slice(0,60)||'Unknown'}</td></tr></table><p style="color:#dc2626">If this wasn't you, call <strong>1800-GK-2024</strong> immediately.</p>`;
  await sendNotificationEmail(user.email, user.firstName, '🔐 GKC Login Alert', html);
};

const notifyTransfer = async (sender, receiver, tx) => {
  const sHtml = `<p>Dear <strong>${sender.firstName}</strong>,</p><p>Transfer successful.</p><table style="font-size:13px;width:100%;border-collapse:collapse"><tr style="background:#f0f4ff"><td style="padding:6px"><b>Amount</b></td><td style="color:#dc2626;font-weight:700">${fmtCur(tx.amount)}</td></tr><tr><td style="padding:6px"><b>To</b></td><td>${tx.toAccountNumber}</td></tr><tr style="background:#f0f4ff"><td style="padding:6px"><b>Reference</b></td><td>${(tx.referenceNumber||'').slice(0,20)}</td></tr><tr><td style="padding:6px"><b>Balance</b></td><td style="font-weight:700">${fmtCur(tx.balanceAfter)}</td></tr></table>`;
  await sendNotificationEmail(sender.email, sender.firstName, `💸 GKC Debit: ${fmtCur(tx.amount)}`, sHtml);
  if (receiver?.email) {
    const rHtml = `<p>Dear <strong>${receiver.firstName}</strong>,</p><p><b style="color:#16a34a">${fmtCur(tx.amount)}</b> credited to your account from ${tx.fromAccountNumber}.</p>`;
    await sendNotificationEmail(receiver.email, receiver.firstName, `💰 GKC Credit: ${fmtCur(tx.amount)}`, rHtml);
  }
};

const notifySuspicious = async (user, fraud) => {
  const html = `<div style="background:#fef2f2;border:2px solid #dc2626;padding:14px;border-radius:8px;margin-bottom:14px"><h3 style="color:#dc2626;margin:0">🚨 Suspicious Activity</h3><p style="color:#7f1d1d">${fraud.reason}</p></div><p>Risk score: <strong>${fraud.riskScore}/100</strong></p><p>Flags: ${fraud.flags?.join(', ')}</p><p style="color:#dc2626"><strong>If not you, call 1800-GK-2024 immediately.</strong></p>`;
  await sendNotificationEmail(user.email, user.firstName, '🚨 GKC: Suspicious Activity Alert', html);
};

const notifyAccountFreeze = async (user, reason) => {
  const html = `<p>Dear <strong>${user.firstName}</strong>,</p><p>Your account has been temporarily frozen.</p><p><strong>Reason:</strong> ${reason}</p><p>Call <strong>1800-GK-2024</strong> to unfreeze.</p>`;
  await sendNotificationEmail(user.email, user.firstName, '🔒 GKC Account Frozen', html);
};

module.exports.notifySvc = { notifyLogin, notifyTransfer, notifySuspicious, notifyAccountFreeze };


// ── Audit Service ─────────────────────────────────────────────────────────────
const { AuditLog } = require('../models/index');

const ACTIONS = {
  LOGIN_SUCCESS:'LOGIN_SUCCESS', LOGIN_FAILED:'LOGIN_FAILED', LOGOUT:'LOGOUT',
  REGISTER:'REGISTER', OTP_SENT:'OTP_SENT', OTP_VERIFIED:'OTP_VERIFIED', OTP_FAILED:'OTP_FAILED',
  TRANSFER_SUCCESS:'TRANSFER_SUCCESS', TRANSFER_FAILED:'TRANSFER_FAILED', TRANSFER_REVERSED:'TRANSFER_REVERSED',
  ACCOUNT_FROZEN:'ACCOUNT_FROZEN', ACCOUNT_UNFROZEN:'ACCOUNT_UNFROZEN',
  PASSWORD_CHANGED:'PASSWORD_CHANGED', PROFILE_UPDATED:'PROFILE_UPDATED',
  BENEFICIARY_ADDED:'BENEFICIARY_ADDED', BENEFICIARY_REMOVED:'BENEFICIARY_REMOVED',
  FRAUD_FLAGGED:'FRAUD_FLAGGED', STATEMENT_GENERATED:'STATEMENT_GENERATED',
  SCHEDULED_TX_CREATED:'SCHEDULED_TX_CREATED', SCHEDULED_TX_EXECUTED:'SCHEDULED_TX_EXECUTED',
  ADMIN_ACTION:'ADMIN_ACTION', KYC_UPLOADED:'KYC_UPLOADED', SESSION_REVOKED:'SESSION_REVOKED',
};

const auditLog = async ({ action, userId, accountNumber, metadata = {}, ipAddress, userAgent, severity = 'info' }) => {
  try {
    await AuditLog.create({ action, userId, accountNumber, metadata, ipAddress, userAgent: userAgent?.slice(0,200), severity, timestamp: new Date() });
    const lvl = severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'info';
    logger[lvl](`[Audit] ${action} | user:${userId||'anon'}`);
  } catch {}
};

const getAuditLogs = async ({ userId, action, severity, startDate, endDate, page=1, limit=50 }) => {
  const filter = {};
  if (userId)   filter.userId   = userId;
  if (action)   filter.action   = action;
  if (severity) filter.severity = severity;
  if (startDate || endDate) { filter.timestamp = {}; if (startDate) filter.timestamp.$gte = new Date(startDate); if (endDate) filter.timestamp.$lte = new Date(endDate); }
  const [logs, total] = await Promise.all([AuditLog.find(filter).sort({ timestamp:-1 }).skip((page-1)*limit).limit(limit).populate('userId','firstName lastName email').lean(), AuditLog.countDocuments(filter)]);
  return { logs, total, page, pages: Math.ceil(total/limit) };
};

module.exports.auditSvc = { auditLog, getAuditLogs, ACTIONS };
