const express = require('express');
const router = express.Router();
const {
  register,
  registerAdmin,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const rateLimit = require('express-rate-limit');

// Stricter limit for auth: fewer attempts per IP per window (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', authLimiter, register);
router.post('/register-admin', authLimiter, registerAdmin);
router.post('/login', authLimiter, login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
