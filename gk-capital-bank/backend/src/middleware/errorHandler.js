const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name||'Error'}: ${err.message}`, { path:req.path });
  if (err.name==='ValidationError') return res.status(400).json({ error:'Validation failed', details:Object.values(err.errors).map(e=>e.message) });
  if (err.code===11000) { const f=Object.keys(err.keyValue||{})[0]||'field'; return res.status(409).json({ error:`${f} already exists` }); }
  if (err.name==='CastError') return res.status(400).json({ error:'Invalid ID format' });
  const status  = err.statusCode||err.status||500;
  const message = (process.env.NODE_ENV==='production'&&status===500) ? 'Internal server error' : err.message;
  res.status(status).json({ error:message });
};

module.exports = errorHandler;
