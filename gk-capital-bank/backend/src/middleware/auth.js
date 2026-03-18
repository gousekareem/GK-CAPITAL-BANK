// ── auth middleware ────────────────────────────────────────────────────────────
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error:'Authentication required' });
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user || !user.isActive) return res.status(401).json({ error:'User not found or inactive' });
    if (user.changedPasswordAfter(decoded.iat)) return res.status(401).json({ error:'Password changed. Please login again.', code:'TOKEN_INVALID' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name==='TokenExpiredError') return res.status(401).json({ error:'Token expired', code:'TOKEN_EXPIRED' });
    if (err.name==='JsonWebTokenError')  return res.status(401).json({ error:'Invalid token' });
    next(err);
  }
};

module.exports = { protect };
