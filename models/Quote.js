const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
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
  isAvailable: {
    type: Boolean,
    default: true
  },
  proposedDate: Date,
  proposedTime: String,
  warranty: {
    hasWarranty: { type: Boolean, default: false },
    duration: {
      value: Number,
      unit: { type: String, enum: ['days', 'months', 'years'] }
    },
    details: String
  },
  guarantee: {
    hasGuarantee: { type: Boolean, default: false },
    details: String
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'updated', 'cancelled', 'expired'],
    default: 'pending'
  },
  originalQuote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  isUpdated: { type: Boolean, default: false },
  updateReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique quote per job per provider
quoteSchema.index(
  { job: 1, provider: 1, originalQuote: 1 },
  { unique: true, partialFilterExpression: { originalQuote: { $exists: false } } }
);

// Virtual for time ago
quoteSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = Math.floor((now - this.createdAt) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

// Fixed method to create updated quote
quoteSchema.methods.createUpdatedQuote = async function(updateData) {
  const Quote = this.constructor;

  // Cancel the current quote
  if (this.isModified === undefined) {
    await Quote.findByIdAndUpdate(this._id, { status: 'cancelled' });
  } else {
    this.status = 'cancelled';
    await this.save();
  }

  // Create new updated quote
  const newQuote = new Quote({
    ...this.toObject(),
    ...updateData,
    _id: undefined,           // Generate new ID
    originalQuote: this._id,
    isUpdated: true,
    status: 'updated',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Ensure nested objects are copied correctly
  newQuote.warranty = updateData.warranty || this.warranty;
  newQuote.guarantee = updateData.guarantee || this.guarantee;

  return await newQuote.save();
};

module.exports = mongoose.model('Quote', quoteSchema);
