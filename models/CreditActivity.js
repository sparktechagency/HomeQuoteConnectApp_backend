// models/CreditActivity.js
const mongoose = require('mongoose');

const creditActivitySchema = new mongoose.Schema({
  // Activity Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Credit Change
  creditChange: {
    type: Number,
    required: true
  },
  newBalance: {
    type: Number,
    required: true
  },
  
  // Activity Details
  type: {
    type: String,
    enum: ['purchase', 'quote_submission', 'refund', 'bonus', 'subscription', 'adjustment'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Reference
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Job', 'CreditPackage', 'UserSubscription', 'Transaction']
  },
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
creditActivitySchema.index({ user: 1, createdAt: -1 });
// Note: { type: 1 } index is not needed as 'type' field with enum already creates an index
creditActivitySchema.index({ referenceId: 1 });

// Static method to log credit activity
creditActivitySchema.statics.logActivity = async function(userId, creditChange, type, description, referenceId = null, referenceModel = null, metadata = {}) {
  const User = require('./User');
  
  // Get current balance
  const user = await User.findById(userId);
  const newBalance = user.credits + creditChange;
  
  // Create activity log
  const activity = await this.create({
    user: userId,
    creditChange,
    newBalance,
    type,
    description,
    referenceId,
    referenceModel,
    metadata
  });
  
  return activity;
};

module.exports = mongoose.model('CreditActivity', creditActivitySchema);