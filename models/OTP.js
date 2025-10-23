// models/OTP.js
const mongoose = require('mongoose');
const { OTP_EXPIRE_MINUTES } = require('../config/env');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['signup', 'forgot-password', 'change-email'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  isUsed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for automatic expiry
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to generate OTP
otpSchema.statics.generateOTP = function(email, purpose) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);
  
  return this.create({
    email,
    otp,
    purpose,
    expiresAt
  });
};

// Method to verify OTP
otpSchema.methods.verifyOTP = function(enteredOTP) {
  if (this.isUsed) {
    throw new Error('OTP has already been used');
  }
  
  if (this.expiresAt < new Date()) {
    throw new Error('OTP has expired');
  }
  
  if (this.attempts >= 5) {
    throw new Error('Too many failed attempts');
  }
  
  this.attempts += 1;
  
  if (this.otp !== enteredOTP) {
    this.save();
    throw new Error('Invalid OTP');
  }
  
  this.isUsed = true;
  return this.save();
};

module.exports = mongoose.model('OTP', otpSchema);