const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function verifyToken(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ message: 'A Bearer token is required.' });
  try {
    req.user = jwt.verify(match[1], env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Token is invalid or expired.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'Insufficient permissions.' });
}

module.exports = { verifyToken, requireRole };
