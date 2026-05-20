const express = require('express');
const router = express.Router();
const {
  register,
  registerAdmin,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Auth rate limiters are keyed off the submitted identifier (email for login,
// username for registration) rather than the client IP, so multiple users
// behind the same NAT/office network don't share a single bucket. Account
// lockout after repeated failures still lives in the login controller — this
// limiter just smooths bursts and protects the auth endpoints themselves.
// If no identifier was submitted (malformed request) we fall back to the IP
// via the library's helper so IPv6 addresses are normalised correctly.
const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts for this account, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count toward the limit. A user signing in
  // correctly five times in a row would previously trip the limiter even
  // though nothing brute-force-ish was happening.
  skipSuccessfulRequests: true,
  keyGenerator: (req, res) => {
    const email = normalize(req.body?.email);
    return email ? `login:email:${email}` : `login:ip:${ipKeyGenerator(req, res)}`;
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many registration attempts for this account, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const email = normalize(req.body?.email);
    const username = normalize(req.body?.username);
    if (email) return `register:email:${email}`;
    if (username) return `register:username:${username}`;
    return `register:ip:${ipKeyGenerator(req, res)}`;
  },
});
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', registerLimiter, register);
router.post('/register-admin', registerLimiter, registerAdmin);
router.post('/login', loginLimiter, login);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
