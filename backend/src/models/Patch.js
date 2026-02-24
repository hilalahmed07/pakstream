const mongoose = require('mongoose');

const patchSchema = new mongoose.Schema({
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
    mimetype: String
  },
  fileType: {
    type: String,
    enum: ['exe', 'msi', 'msp', 'msu', 'cab', 'def'],
    required: true
  },
  patchType: {
    type: String,
    enum: ['security', 'feature', 'bugfix', 'driver', 'update', 'other'],
    default: 'other'
  },
  version: {
    type: String,
    trim: true,
    maxlength: 50
  },
  targetOs: [{
    type: String,
    enum: ['win10', 'win11', 'server2019', 'server2022', 'all', 'windows 10', 'windows 11', 'windows server 2019', 'windows server 2022']
  }],
  architecture: {
    type: String,
    enum: ['x86', 'x64', 'arm64', 'all'],
    default: 'x64'
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
  downloads: {
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
    enum: ['security', 'system', 'application', 'driver', 'other'],
    default: 'other'
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: true
  },
  sha256Hash: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    index: true
  },
  virusScanStatus: {
    type: String,
    enum: ['pending', 'safe', 'warning', 'threat'],
    default: 'pending'
  },
  virusScanResult: {
    scanner: String,
    scanTime: Date,
    threats: [String],
    details: String
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

patchSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
patchSchema.index({ title: 'text', description: 'text' });
patchSchema.index({ uploadedBy: 1, createdAt: -1 });
patchSchema.index({ status: 1 });
patchSchema.index({ isPublic: 1 });
patchSchema.index({ fileType: 1 });
patchSchema.index({ patchType: 1 });
patchSchema.index({ targetOs: 1 });
patchSchema.index({ architecture: 1 });
patchSchema.index({ category: 1 });
patchSchema.index({ virusScanStatus: 1 });

module.exports = mongoose.model('Patch', patchSchema);
