const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user'
      });
    }

    // Single-session enforcement: a newer login on another device/browser
    // rotates the user's sessionToken, so any older JWT (which still carries
    // the previous token) is rejected here and the client is forced to
    // re-authenticate.
    if (!decoded.sessionToken || decoded.sessionToken !== user.sessionToken) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_INVALIDATED',
        message: 'Your account has been signed in on another device or browser. For your security, this session has been ended.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Token verification failed' 
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// Check if user is admin or the user themselves
const requireAdminOrOwner = (req, res, next) => {
  if (req.user.role === 'admin' || req.user._id.toString() === req.params.userId) {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied' 
  });
};

// Optional authentication - doesn't fail if no token, but sets req.user if token is valid
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (
          user &&
          user.isActive &&
          decoded.sessionToken &&
          decoded.sessionToken === user.sessionToken
        ) {
          req.user = user;
        }
      } catch (error) {
        // Invalid token, but continue without user
        // Don't set req.user, just continue
      }
    }
    next();
  } catch (error) {
    // Continue without user on any error
    next();
  }
};

// Document file: inline/view is public (optional auth); ?download=true requires login
const authenticateWhenDocumentDownload = (req, res, next) => {
  if (String(req.query.download) === 'true') {
    return authenticateToken(req, res, next);
  }
  return optionalAuth(req, res, next);
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAdminOrOwner,
  optionalAuth,
  authenticateWhenDocumentDownload
};
