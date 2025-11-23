// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Report Information
  reportType: {
    type: String,
    enum: ['user', 'job', 'review', 'message', 'payment', 'other',"crime"],
    required: true
  },
  reason: {
    type: String,
    required: [true, 'Report reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot be more than 500 characters']
  },
  description: {
    type: String,
    required: [true, 'Report description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  
  // Users Involved
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reportedJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  reportedReview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  },
  
  // Evidence
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'screenshot'],
      required: true
    },
    public_id: String,
    url: String,
    filename: String,
    description: String
  }],
  
  // Status & Resolution
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Resolution Details
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin user
  },
  resolution: {
    notes: String,
    action: {
      type: String,
      enum: ['warning', 'suspension', 'ban', 'content_removal', 'no_action', 'payment_refund']
    },
    duration: { // For suspensions
      value: Number,
      unit: {
        type: String,
        enum: ['hours', 'days', 'weeks', 'months']
      }
    },
    resolvedAt: Date
  },
  
  // Admin Notes
  adminNotes: [{
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
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

// Indexes for performance
reportSchema.index({ status: 1 });
reportSchema.index({ priority: -1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ reportType: 1 });

// Virtual for time ago
reportSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
});

// Method to add admin note
reportSchema.methods.addAdminNote = async function(adminId, note) {
  this.adminNotes.push({
    admin: adminId,
    note: note
  });
  return this.save();
};

// Method to resolve report
reportSchema.methods.resolveReport = async function(adminId, resolutionData) {
  this.status = 'resolved';
  this.resolvedBy = adminId;
  this.resolution = {
    ...resolutionData,
    resolvedAt: new Date()
  };
  return this.save();
};

// Static method to get report statistics
reportSchema.statics.getReportStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = await this.countDocuments();
  const pending = await this.countDocuments({ status: 'pending' });
  
  return {
    total,
    pending,
    byStatus: stats
  };
};

module.exports = mongoose.model('Report', reportSchema);