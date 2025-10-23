// models/CreditPackage.js
const mongoose = require('mongoose');

const creditPackageSchema = new mongoose.Schema({
  // Package Information
  name: {
    type: String,
    required: [true, 'Package name is required'],
    trim: true
  },
  credits: {
    type: Number,
    required: [true, 'Number of credits is required'],
    min: 1
  },
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Package price is required'],
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
  isPopular: {
    type: Boolean,
    default: false
  },
  description: String,
  
  // Status
  isActive: {
    type: Boolean,
    default: true
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
creditPackageSchema.index({ credits: 1 });
creditPackageSchema.index({ isActive: 1 });

// Virtual for discounted price
creditPackageSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return this.price - (this.price * this.discount / 100);
  }
  return this.price;
});

// Virtual for price per credit
creditPackageSchema.virtual('pricePerCredit').get(function() {
  const finalPrice = this.discountedPrice;
  return (finalPrice / this.credits).toFixed(2);
});

module.exports = mongoose.model('CreditPackage', creditPackageSchema);