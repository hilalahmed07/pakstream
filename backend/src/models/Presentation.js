const mongoose = require('mongoose');

const PRESENTATION_TITLE_MAX_LENGTH = 90;
const PRESENTATION_DESCRIPTION_MAX_LENGTH = 180;
const PRESENTATION_MAX_TAGS = 3;

const presentationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: PRESENTATION_TITLE_MAX_LENGTH,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: PRESENTATION_DESCRIPTION_MAX_LENGTH,
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
  slides: [{
    slideNumber: Number,
    imagePath: String,
    thumbnailPath: String,
    notes: String
  }],
  totalSlides: {
    type: Number,
    default: 0
  },
  duration: {
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
    enum: ['business', 'education', 'marketing', 'technology', 'design', 'other'],
    default: 'other'
  },
  tags: {
    type: [String],
    validate: {
      validator: function validateTags(tags) {
        return !Array.isArray(tags) || tags.length <= PRESENTATION_MAX_TAGS;
      },
      message: `A presentation can have at most ${PRESENTATION_MAX_TAGS} tags`,
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

presentationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Presentation', presentationSchema);
