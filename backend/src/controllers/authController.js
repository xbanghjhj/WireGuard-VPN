const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_wireguard_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Đăng nhập hệ thống và cấp phát JWT token.
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Lấy user từ DB
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Ký JWT Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login controller error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
}

module.exports = {
  login
};
