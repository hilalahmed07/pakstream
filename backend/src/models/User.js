const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  USERNAME_REGEX,
  EMAIL_REGEX,
  EMAIL_MAX_LENGTH,
  PASSWORD_REGEX,
  USERNAME_MESSAGE,
  EMAIL_MESSAGE,
  PASSWORD_MESSAGE,
} = require('../utils/validation');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [USERNAME_REGEX, USERNAME_MESSAGE],
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: EMAIL_MAX_LENGTH,
    match: [EMAIL_REGEX, EMAIL_MESSAGE],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    validate: {
      validator: function validatePassword(value) {
        // Allow existing hashed passwords loaded from DB to pass validation.
        if (typeof value === 'string' && value.startsWith('$2')) return true;
        return PASSWORD_REGEX.test(value);
      },
      message: PASSWORD_MESSAGE,
    },
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String
  },
  organization: {
    type: String,
    trim: true
  },
  dateOfEnrollment: {
    type: Date,
    default: Date.now
  },
  contactNumber: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  preferences: {
    theme: {
      type: String,
      default: 'dark'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
