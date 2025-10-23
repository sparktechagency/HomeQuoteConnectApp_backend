// models/UserSubscription.js
const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  // Subscription Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  
  // Subscription Details
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  
  // Payment Information
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  stripeSubscriptionId: String,
  
  // Status
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'active'
  },
  
  // Usage Tracking
  quotesUsed: {
    type: Number,
    default: 0
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
userSubscriptionSchema.index({ user: 1 });
userSubscriptionSchema.index({ status: 1 });
userSubscriptionSchema.index({ endDate: 1 });

// Virtual for isActive
userSubscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.endDate > new Date();
});

// Virtual for daysRemaining
userSubscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to check if user can submit quote
userSubscriptionSchema.methods.canSubmitQuote = function() {
  if (!this.isActive) return false;
  
  const subscription = this.populated('subscription') || this.subscription;
  if (subscription.quoteLimit === 0) return true; // Unlimited
  
  return this.quotesUsed < subscription.quoteLimit;
};

// Method to increment quote usage
userSubscriptionSchema.methods.incrementQuoteUsage = async function() {
  this.quotesUsed += 1;
  await this.save();
};

// Pre-save middleware to populate subscription if not populated
userSubscriptionSchema.pre('save', async function(next) {
  if (this.isModified('subscription') && !this.populated('subscription')) {
    await this.populate('subscription');
  }
  next();
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);