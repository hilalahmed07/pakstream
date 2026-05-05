const mongoose = require('mongoose');

const DOCUMENT_TITLE_MAX_LENGTH = 90;
const DOCUMENT_DESCRIPTION_MAX_LENGTH = 180;
const DOCUMENT_MAX_TAGS = 3;

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: DOCUMENT_TITLE_MAX_LENGTH
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: DOCUMENT_DESCRIPTION_MAX_LENGTH
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalFile: {
    filename: String,
    path: String,
    size: Number,
    mimetype: String
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'error'],
    default: 'processing'
  },
  processingProgress: {
    type: Number,
    default: 0
  },
  pageCount: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  category: {
    type: String,
    enum: ['academic', 'business', 'legal', 'technical', 'other'],
    default: 'other'
  },
  tags: {
    type: [String],
    validate: {
      validator: function validateTags(tags) {
        return !Array.isArray(tags) || tags.length <= DOCUMENT_MAX_TAGS;
      },
      message: `A document can have at most ${DOCUMENT_MAX_TAGS} tags`,
    },
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  thumbnail: String,
  sha256Hash: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

documentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
documentSchema.index({ title: 'text', description: 'text' });
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ status: 1 });
documentSchema.index({ isPublic: 1 });

module.exports = mongoose.model('Document', documentSchema);
