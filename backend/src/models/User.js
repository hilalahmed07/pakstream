const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  // Server-side session token. A fresh value is generated on every successful
  // login and embedded in the issued JWT. Auth middleware rejects any token
  // whose sessionToken claim doesn't match this value, so logging in from a
  // second browser/device instantly invalidates the older session.
  sessionToken: {
    type: String,
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

// Issue a fresh session token. Older JWTs (carrying the previous token) will
// stop validating immediately, evicting any other browser/device sessions.
userSchema.methods.issueSessionToken = function() {
  this.sessionToken = crypto.randomBytes(24).toString('hex');
  return this.sessionToken;
};

// Remove password and session token from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.sessionToken;
  return user;
};

module.exports = mongoose.model('User', userSchema);
