const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
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
    mimetype: String,
    duration: Number
  },
  processedFiles: {
    hls: {
      masterPlaylist: String,
      segments: [String],
      variants: [{
        resolution: String,
        bitrate: Number,
        playlist: String,
        segments: [String]
      }]
    },
    thumbnails: [String],
    poster: String
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'error', 'failed'],
    default: 'uploading'
  },
  processingProgress: {
    type: Number,
    default: 0
  },
  processingError: String,
  duration: Number,
  resolution: String,
  fileSize: Number,
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  tags: [String],
  category: {
    type: String,
    enum: ['movie', 'tv-show', 'documentary', 'short-film', 'other'],
    default: 'other'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isForPremiere: {
    type: Boolean,
    default: false
  },
  sha256Hash: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for better query performance
videoSchema.index({ title: 'text', description: 'text' });
videoSchema.index({ uploadedBy: 1, createdAt: -1 });
videoSchema.index({ status: 1 });
videoSchema.index({ isPublic: 1, isFeatured: 1 });

module.exports = mongoose.model('Video', videoSchema);
