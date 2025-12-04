// models/Invoice.js
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // Unique 6-digit invoice ID
  invoiceId: {
    type: String,
    unique: true
    // Note: Not marked as required because it's auto-generated in pre-save hook
  },
  
  // Related Documents
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: true
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  
  // Service Provider Information
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Customer Information
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Pricing Breakdown
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    platformCommission: {
      type: Number,
      required: true
    },
    platformCommissionRate: {
      type: Number,
      required: true,
      default: 0.10
    },
    total: {
      type: Number,
      required: true
    }
  },
  
  // Payment Information
  payment: {
    paidAmount: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'cash', 'bank_transfer'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
      required: true
    },
    paidAt: Date
  },
  
  // Issued Date
  issuedDate: {
    type: Date,
    default: Date.now
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'issued', 'paid', 'cancelled'],
    default: 'issued'
  }
}, {
  timestamps: true
});

// Generate 6-digit unique invoice ID
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceId) {
    let isUnique = false;
    let invoiceId;
    
    while (!isUnique) {
      // Generate 6-digit number
      invoiceId = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Check if it exists
      const existing = await mongoose.model('Invoice').findOne({ invoiceId });
      if (!existing) {
        isUnique = true;
      }
    }
    
    this.invoiceId = invoiceId;
  }
  next();
});

// Indexes
invoiceSchema.index({ invoiceId: 1 }, { unique: true });
invoiceSchema.index({ job: 1 });
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ provider: 1 });
invoiceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
