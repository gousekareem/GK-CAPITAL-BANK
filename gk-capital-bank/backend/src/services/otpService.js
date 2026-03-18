const nodemailer = require('nodemailer');
const axios      = require('axios');
const logger     = require('../utils/logger');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendViaTwilio = async (phone, message) => {
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const result = await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to: phone.startsWith('+') ? phone : `+91${phone}` });
  logger.info(`[OTP] Twilio sent. SID: ${result.sid}`);
  return { provider: 'twilio' };
};

const sendViaFast2SMS = async (phone, otp) => {
  const { data } = await axios.post('https://www.fast2sms.com/dev/bulkV2',
    { variables_values: otp, route: 'otp', numbers: phone },
    { headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' }, timeout: 6000 }
  );
  if (!data.return) throw new Error(`Fast2SMS: ${data.message}`);
  logger.info(`[OTP] Fast2SMS sent to ****${phone.slice(-4)}`);
  return { provider: 'fast2sms' };
};

let transporter;
const getTransporter = () => {
  if (!transporter && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  return transporter;
};

const sendEmailOTP = async (email, name, otp, type = 'transaction') => {
  const subjects = { transaction: '🏦 GK Capital Transaction OTP', login: '🔐 GKC Login OTP', email_verify: '✅ GKC Email Verification', password_reset: '🔑 GKC Password Reset' };
  const html = `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto"><div style="background:#1a4b96;padding:18px;text-align:center"><h2 style="color:#fff;margin:0">🏦 GK Capital Bank</h2></div><div style="padding:24px;background:#fff;border:1px solid #e5e7eb"><p style="color:#374151">Dear <strong>${name}</strong>,</p><p style="color:#6b7280">Your OTP for <strong>${type.replace(/_/g,' ')}</strong>:</p><div style="background:#f0f4ff;border:2px dashed #1a4b96;border-radius:10px;padding:20px;text-align:center;margin:16px 0"><span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#1a4b96;font-family:monospace">${otp}</span></div><p style="color:#92400e;background:#fef3c7;padding:10px;border-radius:6px;font-size:12px">⚠️ Valid for 5 minutes. Do not share with anyone. GK Capital Bank will never ask for your OTP.</p></div></div>`;
  const tp = getTransporter();
  if (tp) {
    await tp.sendMail({ from: process.env.EMAIL_FROM || '"GK Capital Bank" <noreply@gkcapital.in>', to: email, subject: subjects[type] || subjects.transaction, html });
    logger.info(`[OTP] Email sent to ${email}`);
    return { provider: 'email' };
  }
  throw new Error('Email not configured');
};

const sendOTP = async ({ phone, email, name, otp, type = 'transaction' }) => {
  const provider = process.env.SMS_PROVIDER || 'console';
  const message  = `GKC OTP: ${otp}. Valid 5 mins. Do NOT share. -GKCB`;

  // Always log in development
  if (process.env.NODE_ENV === 'development' || provider === 'console') {
    console.log('\n' + '='.repeat(55));
    console.log(`📲  OTP [${type.toUpperCase()}]`);
    console.log(`    Phone: ${phone || 'N/A'} | Email: ${email || 'N/A'}`);
    console.log(`    OTP CODE: ${otp}`);
    console.log('='.repeat(55) + '\n');
    logger.info(`[OTP][DEV] ${type} OTP for ${phone || email}: ${otp}`);
    if (provider === 'console') return { provider: 'console', otp };
  }

  if (provider === 'fast2sms' && phone) {
    try { return await sendViaFast2SMS(phone, otp); } catch (e) { logger.warn(`[OTP] Fast2SMS failed: ${e.message}`); }
  }
  if (provider === 'twilio' && phone) {
    try { return await sendViaTwilio(phone, message); } catch (e) { logger.warn(`[OTP] Twilio failed: ${e.message}`); }
  }
  if (email) {
    try { return await sendEmailOTP(email, name || 'Customer', otp, type); } catch (e) { logger.warn(`[OTP] Email failed: ${e.message}`); }
  }

  logger.info(`[OTP][FALLBACK] ${otp}`);
  return { provider: 'console', otp: process.env.NODE_ENV === 'development' ? otp : undefined };
};

const sendNotificationEmail = async (email, name, subject, htmlContent) => {
  const tp = getTransporter();
  if (!tp) return;
  try {
    await tp.sendMail({
      from: process.env.EMAIL_FROM || '"GK Capital Bank" <noreply@gkcapital.in>', to: email, subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto"><div style="background:#1a4b96;padding:16px 20px"><h2 style="color:#fff;margin:0">🏦 GK Capital Bank</h2></div><div style="padding:24px;background:#fff;border:1px solid #e5e7eb">${htmlContent}</div><div style="background:#f9fafb;padding:10px;text-align:center;font-size:11px;color:#9ca3af">© GK Capital Bank</div></div>`,
    });
  } catch (e) { logger.error(`[Notify] Email failed: ${e.message}`); }
};

module.exports = { generateOTP, sendOTP, sendEmailOTP, sendNotificationEmail };
