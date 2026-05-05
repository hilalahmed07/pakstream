const mongoose = require('mongoose');

const PREMIERE_TITLE_MAX_LENGTH = 90;
const PREMIERE_DESCRIPTION_MAX_LENGTH = 180;

const premiereSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: PREMIERE_TITLE_MAX_LENGTH
  },
  description: {
    type: String,
    default: '',
    maxlength: PREMIERE_DESCRIPTION_MAX_LENGTH
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended'],
    default: 'scheduled'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalViewers: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for active premieres
premiereSchema.index({ status: 1, isActive: 1 });
premiereSchema.index({ startTime: 1, endTime: 1 });

module.exports = mongoose.model('Premiere', premiereSchema);
