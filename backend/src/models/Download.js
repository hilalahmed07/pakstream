const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assetType: {
      type: String,
      enum: ['video', 'document', 'presentation', 'patch'],
      required: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
downloadSchema.index({ user: 1, downloadedAt: -1 });
downloadSchema.index({ assetType: 1, assetId: 1, downloadedAt: -1 });
downloadSchema.index({ downloadedAt: -1 });

module.exports = mongoose.model('Download', downloadSchema);

