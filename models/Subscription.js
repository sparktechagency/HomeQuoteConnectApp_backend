// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // Subscription Information
  name: {
    type: String,
    required: [true, 'Subscription name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['monthly', '6months', 'yearly'],
    required: true
  },
  description: {
    type: String,
    required: [true, 'Subscription description is required']
  },
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Subscription price is required'],
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Features
  features: [{
    text: String,
    included: {
      type: Boolean,
      default: true
    }
  }],
  
  // Limits
  quoteLimit: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  priorityListing: {
    type: Boolean,
    default: false
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
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
subscriptionSchema.index({ type: 1 });
subscriptionSchema.index({ isActive: 1 });
subscriptionSchema.index({ price: 1 });

// Virtual for discounted price
subscriptionSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return this.price - (this.price * this.discount / 100);
  }
  return this.price;
});

// Virtual for savings
subscriptionSchema.virtual('savings').get(function() {
  if (this.discount > 0) {
    return this.price * this.discount / 100;
  }
  return 0;
});

module.exports = mongoose.model('Subscription', subscriptionSchema);