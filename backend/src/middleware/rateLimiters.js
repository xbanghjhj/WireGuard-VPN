const rateLimit = require('express-rate-limit');

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-7', legacyHeaders: false
});
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Try again later.' }
});

module.exports = { apiRateLimiter, loginRateLimiter };
