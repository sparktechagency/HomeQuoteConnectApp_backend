// models/SupportTicket.js
const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  // Ticket Information
  title: {
    type: String,
    required: [true, 'Ticket title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Ticket description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: {
    type: String,
    enum: ['client', 'provider'],
    required: true
  },
  
  // Ticket Details
  category: {
    type: String,
    enum: ['technical', 'billing', 'account', 'service', 'general', 'report'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  
  // Admin Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin user
  },
  
  // Live Chat Session
  chatSession: {
    sessionId: String,
    isActive: {
      type: Boolean,
      default: false
    },
    joinedAt: Date,
    endedAt: Date
  },
  
  // Resolution
  resolution: {
    notes: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
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

// Indexes for performance
supportTicketSchema.index({ user: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: -1 });
supportTicketSchema.index({ category: 1 });
supportTicketSchema.index({ createdAt: -1 });

// Virtual for time since creation
supportTicketSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
});

// Method to assign to admin
supportTicketSchema.methods.assignToAdmin = async function(adminId) {
  this.assignedTo = adminId;
  this.status = 'in_progress';
  await this.save();
};

// Method to mark as resolved
supportTicketSchema.methods.markAsResolved = async function(adminId, notes) {
  this.status = 'resolved';
  this.resolution = {
    notes,
    resolvedBy: adminId,
    resolvedAt: new Date()
  };
  await this.save();
};

module.exports = mongoose.model('SupportTicket', supportTicketSchema);