const express = require('express');
const { z } = require('zod');
const authController = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const { loginRateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();
const loginSchema = z.object({
  body: z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(1).max(256) }).strict(),
  params: z.object({}), query: z.object({})
});
router.post('/login', loginRateLimiter, validateRequest(loginSchema), authController.login);

module.exports = router;
