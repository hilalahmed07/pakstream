const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { 
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

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    const userData = {
      username,
      email,
      password,
      role
    };

    // Add optional fields if provided
    if (organization) userData.organization = organization;
    if (dateOfEnrollment) userData.dateOfEnrollment = new Date(dateOfEnrollment);
    if (contactNumber) userData.contactNumber = contactNumber;
    if (address) userData.address = address;

    const user = new User(userData);

    await user.save();

    // Generate token
    const token = generateToken(user._id);

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

    // Check admin key (you can set this in environment variables)
    const ADMIN_REGISTRATION_KEY = process.env.ADMIN_REGISTRATION_KEY || 'admin123';

    if (adminKey !== ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin registration key'
      });
    }

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create admin user
    const user = new User({
      username,
      email,
      password,
      role: 'admin'
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

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

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email });
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

    // Success: clear lockout, update lastLogin, and return token
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
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

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(userId);
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
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
