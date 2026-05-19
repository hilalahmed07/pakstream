const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  USERNAME_MESSAGE,
  EMAIL_MESSAGE,
  PASSWORD_MESSAGE,
  normalizeUsername,
  normalizeEmail,
  normalizePassword,
  isValidUsername,
  isValidEmail,
  isStrongPassword,
} = require('../utils/validation');

// Generate JWT token. The sessionToken claim is checked by auth middleware
// against the user's current sessionToken — a new login rotates the token
// and invalidates every previously issued JWT for that user.
const generateToken = (userId, sessionToken) => {
  return jwt.sign({ userId, sessionToken }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const LOCKOUT_DURATION_MS = LOCKOUT_MINUTES * 60 * 1000;

// Register new user
const register = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      role = 'user',
      organization,
      dateOfEnrollment,
      contactNumber,
      address
    } = req.body;

    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = normalizePassword(password);

    // Validation
    if (!normalizedUsername || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: USERNAME_MESSAGE
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: EMAIL_MESSAGE
      });
    }

    if (!isStrongPassword(normalizedPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_MESSAGE
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === normalizedEmail 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    const userData = {
      username: normalizedUsername,
      email: normalizedEmail,
      password: normalizedPassword,
      role
    };

    // Add optional fields if provided
    if (organization) userData.organization = organization;
    if (dateOfEnrollment) userData.dateOfEnrollment = new Date(dateOfEnrollment);
    if (contactNumber) userData.contactNumber = contactNumber;
    if (address) userData.address = address;

    const user = new User(userData);
    user.issueSessionToken();

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.sessionToken);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Register admin (special endpoint)
const registerAdmin = async (req, res) => {
  try {
    const { username, email, password, adminKey } = req.body;
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = normalizePassword(password);

    // Check admin key (you can set this in environment variables)
    const ADMIN_REGISTRATION_KEY = process.env.ADMIN_REGISTRATION_KEY || 'admin123';

    if (adminKey !== ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin registration key'
      });
    }

    // Validation
    if (!normalizedUsername || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: USERNAME_MESSAGE
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: EMAIL_MESSAGE
      });
    }

    if (!isStrongPassword(normalizedPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_MESSAGE
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === normalizedEmail 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create admin user
    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: normalizedPassword,
      role: 'admin'
    });
    user.issueSessionToken();

    await user.save();

    // Generate token
    const token = generateToken(user._id, user.sessionToken);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin registration failed',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Account locked: reject until lockUntil has passed
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMs = user.lockUntil - new Date();
      const remainingMins = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMins} minute(s).`
      });
    }

    // Lockout window expired: reset attempts so user can try again
    if (user.lockUntil && user.lockUntil <= new Date()) {
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save({ validateBeforeSave: false });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await user.save({ validateBeforeSave: false });
        return res.status(423).json({
          success: false,
          message: `Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
        });
      }
      await user.save({ validateBeforeSave: false });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Success: clear lockout, update lastLogin, rotate session token to
    // invalidate any existing sessions on other devices/browsers, then issue
    // a fresh JWT for this login.
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    user.issueSessionToken();
    await user.save({ validateBeforeSave: false });

    // Real-time eviction: any browser/tab still holding a socket for this
    // user gets `force-logout` immediately, so the old session signs out
    // without needing a manual page refresh.
    const socketHandler = req.app.get('socketHandler');
    if (socketHandler && typeof socketHandler.evictUserSessions === 'function') {
      socketHandler.evictUserSessions(user._id);
    }

    const token = generateToken(user._id, user.sessionToken);
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, preferences } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (firstName !== undefined) updateData['profile.firstName'] = firstName;
    if (lastName !== undefined) updateData['profile.lastName'] = lastName;
    if (bio !== undefined) updateData['profile.bio'] = bio;
    if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, select: '-password' }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;
    const normalizedCurrentPassword = normalizePassword(currentPassword);
    const normalizedNewPassword = normalizePassword(newPassword);

    if (!normalizedCurrentPassword || !normalizedNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (!isStrongPassword(normalizedNewPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_MESSAGE
      });
    }

    const user = await User.findById(userId);
    const isCurrentPasswordValid = await user.comparePassword(normalizedCurrentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = normalizedNewPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

module.exports = {
  register,
  registerAdmin,
  login,
  getProfile,
  updateProfile,
  changePassword
};
