const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', isActive = '' } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }
    
    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalUsers: total,
          hasNext: skip + users.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Create new user (admin only)
const createUser = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      role = 'user', 
      profile, 
      preferences,
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
      role,
      profile: profile || {},
      preferences: preferences || {}
    };

    // Add new fields if provided
    if (organization) userData.organization = organization;
    if (dateOfEnrollment) userData.dateOfEnrollment = new Date(dateOfEnrollment);
    if (contactNumber) userData.contactNumber = contactNumber;
    if (address) userData.address = address;
    
    const user = new User(userData);
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      role, 
      profile, 
      preferences, 
      isActive,
      organization,
      dateOfEnrollment,
      contactNumber,
      address
    } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update fields
    if (username) user.username = username;
    if (email) user.email = email;
    if (role) user.role = role;
    if (profile) user.profile = { ...user.profile, ...profile };
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    // Update new fields
    if (organization !== undefined) user.organization = organization || null;
    if (dateOfEnrollment !== undefined) {
      user.dateOfEnrollment = dateOfEnrollment ? new Date(dateOfEnrollment) : null;
    }
    if (contactNumber !== undefined) user.contactNumber = contactNumber || null;
    if (address !== undefined) user.address = address || null;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Reset user password (admin only)
const resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Set new password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
};

// Activate/Block user (admin only)
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent blocking yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself'
      });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'blocked'} successfully`,
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status',
      error: error.message
    });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete yourself'
      });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
  toggleUserStatus,
  deleteUser
};

