// models/BackgroundCheck.js
const mongoose = require('mongoose');

const backgroundCheckSchema = new mongoose.Schema({
  // Provider Information
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One background check per provider
  },
  
  // ID Documents
  idFront: {
    public_id: String,
    url: String,
    uploadedAt: Date
  },
  idBack: {
    public_id: String,
    url: String,
    uploadedAt: Date
  },
  
  // Consent Form
  consentForm: {
    public_id: String,
    url: String,
    uploadedAt: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resubmission_required'],
    default: 'pending'
  },
  
  // Admin Review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin user
  },
  reviewedAt: Date,
  reviewNotes: String,
  rejectionReason: String,
  
  // Submission History
  submittedAt: {
    type: Date,
    default: Date.now
  },
  resubmittedAt: Date,
  
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
// Note: provider field already has unique:true which creates an index, so we don't need to add it again
backgroundCheckSchema.index({ status: 1 });
backgroundCheckSchema.index({ submittedAt: -1 });

// Pre-save middleware to update timestamp
backgroundCheckSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BackgroundCheck', backgroundCheckSchema);
