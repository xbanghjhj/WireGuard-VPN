const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { env } = require('../config/env');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const user = await db.get('SELECT id, username, password, role FROM users WHERE username = ?', [username]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    const claims = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    return res.json({ token, user: claims });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login };
