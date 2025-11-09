// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Basic Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
  
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
 
  },
  
  
  // Payment Information
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformCommission: {
    type: Number,
    required: true,
    min: 0
  },
  providerAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Stripe Information
  stripePaymentIntentId: String,
  stripeChargeId: String,
  stripeTransferId: String,
  stripePayoutId: String,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  
  // Payment Method
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer'],
    required: true
  },
  
  // Cash Payment Specific
  cashPayment: {
    confirmedByProvider: {
      type: Boolean,
      default: false
    },
    confirmedAt: Date,
    confirmationPhoto: {
      public_id: String,
      url: String
    }
  },
  
  // Timeline
  paidAt: Date,
  completedAt: Date,
  refundedAt: Date,
  // Pending release timestamp (for platform-held funds)
  pendingReleaseAt: Date,
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ user: 1 });
transactionSchema.index({ job: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ stripePaymentIntentId: 1 });

// Virtual for net amount after commission
transactionSchema.virtual('netAmount').get(function() {
  return this.amount - this.platformCommission;
});

// Method to mark as completed
transactionSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to process refund
transactionSchema.methods.processRefund = function() {
  this.status = 'refunded';
  this.refundedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Transaction', transactionSchema);