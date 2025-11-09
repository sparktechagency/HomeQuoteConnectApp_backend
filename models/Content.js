// models/Content.js
const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  // Content Information
  type: {
    type: String,
    enum: ['about_us', 'privacy_policy', 'terms_conditions', 'faq', 'contact_info'],
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // SEO & Metadata
  metaTitle: String,
  metaDescription: String,
  keywords: [String],
  
  // History
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
contentSchema.index({ type: 1 });
contentSchema.index({ isActive: 1 });

// Pre-save middleware to increment version
contentSchema.pre('save', function(next) {
  if (this.isModified('content') || this.isModified('title')) {
    this.version += 1;
  }
  next();
});

module.exports = mongoose.model('Content', contentSchema);