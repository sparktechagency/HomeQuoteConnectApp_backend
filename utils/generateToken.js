const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/env');

// Generate token with both userId and role
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

// Verify token safely and return decoded payload
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return null;
  }
};

module.exports = { generateToken, verifyToken };
