// models/Quote.js
const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  // Basic Information
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Quote Details
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  description: {
    type: String,
    required: [true, 'Quote description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  
  // Availability
  isAvailable: {
    type: Boolean,
    default: true
  },
  proposedDate: Date,
  proposedTime: String,
  
  // Warranty & Guarantee
  warranty: {
    hasWarranty: {
      type: Boolean,
      default: false
    },
    duration: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'months', 'years']
      }
    },
    details: String
  },
  guarantee: {
    hasGuarantee: {
      type: Boolean,
      default: false
    },
    details: String
  },
  
  // Quote Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'updated', 'cancelled', 'expired'],
    default: 'pending'
  },
  
  // Update History
  originalQuote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },
  isUpdated: {
    type: Boolean,
    default: false
  },
  updateReason: String,
  
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for unique quote per job per provider
quoteSchema.index({ job: 1, provider: 1 }, { unique: true });

// Indexes for performance
quoteSchema.index({ provider: 1 });
quoteSchema.index({ status: 1 });
quoteSchema.index({ createdAt: -1 });
quoteSchema.index({ job: 1, status: 1 });

// Virtual for time ago
quoteSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
});

// Pre-save middleware to update job quote count
quoteSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Job = require('./Job');
    await Job.findByIdAndUpdate(this.job, { 
      $inc: { quoteCount: 1 },
      $addToSet: { quotes: this._id }
    });
  }
  next();
});

// Pre-remove middleware to update job quote count
quoteSchema.pre('remove', async function(next) {
  const Job = require('./Job');
  await Job.findByIdAndUpdate(this.job, { 
    $inc: { quoteCount: -1 },
    $pull: { quotes: this._id }
  });
  next();
});

// Method to create updated quote
quoteSchema.methods.createUpdatedQuote = async function(updateData) {
  const updatedQuote = this.constructor({
    ...updateData,
    job: this.job,
    provider: this.provider,
    originalQuote: this._id,
    isUpdated: true,
    status: 'updated'
  });
  
  this.status = 'cancelled';
  await this.save();
  
  return await updatedQuote.save();
};

module.exports = mongoose.model('Quote', quoteSchema);