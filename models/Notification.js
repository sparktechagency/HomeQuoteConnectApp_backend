// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'new_quote',
      'quote_accepted',
      'quote_declined',
      'quote_updated',
      'quote_cancelled',
      'job_cancelled',
      'payment_successful',
      'payment_received',
      'payment_confirmed',
      'payment_failed',
      'refund_processed',
      'direct_booking',
      'support_message',
      'new_support_ticket',
      'verification_approved',
      'verification_rejected',
      'account_blocked',
      'account_unblocked',
      'stripe_account_verified',
      'subscription_activated',
      'credits_added',
      'payment_released',
      'job_completed',
      'new_user_registered',        // New user joined
      'profile_report_received',    // Profile report
      'new_payment_request',        // Payment request
      'new_report_submitted',       // General report
      'user_verification_request',  // Provider verification
      'withdrawal_request',         // Provider withdrawal
      'support_ticket_assigned',    // Support ticket
      'system_alert'                // System maintenance, etc.
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: Date,
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ priority: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
});
module.exports = mongoose.model('Notification', notificationSchema);