// models/Wallet.js
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Balances
  totalEarned: {
    type: Number,
    default: 0
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  pendingBalance: {
    type: Number,
    default: 0
  },
  withdrawnBalance: {
    type: Number,
    default: 0
  },
  
  // Stripe Connect for providers
  stripeAccountId: String,
  stripeAccountStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  
  // Withdrawal settings
  withdrawalMethod: {
    type: String,
    enum: ['bank_transfer', 'stripe', 'paypal'],
    default: 'stripe'
  },
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    bankName: String,
    routingNumber: String,
    iban: String
  },
  
  // Security
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
// `user` field is declared with `unique: true` above which creates the index,
// so we avoid declaring the same index again to prevent duplicate-index warnings.
walletSchema.index({ availableBalance: -1 });

// Method to add earnings
walletSchema.methods.addEarnings = async function(amount, isPending = false) {
  this.totalEarned += amount;
  
  if (isPending) {
    this.pendingBalance += amount;
  } else {
    this.availableBalance += amount;
  }
  
  return this.save();
};

// Method to release pending balance
walletSchema.methods.releasePendingBalance = async function(amount) {
  if (this.pendingBalance < amount) {
    throw new Error('Insufficient pending balance');
  }
  
  this.pendingBalance -= amount;
  this.availableBalance += amount;
  
  return this.save();
};

// Method to process withdrawal
walletSchema.methods.processWithdrawal = async function(amount) {
  if (this.availableBalance < amount) {
    throw new Error('Insufficient available balance');
  }
  
  this.availableBalance -= amount;
  this.withdrawnBalance += amount;
  
  return this.save();
};

// Static method to get or create wallet
walletSchema.statics.getOrCreate = async function(userId) {
  let wallet = await this.findOne({ user: userId });
  
  if (!wallet) {
    wallet = await this.create({ user: userId });
  }
  
  return wallet;
};

module.exports = mongoose.model('Wallet', walletSchema);