// models/SupportMessage.js
const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
  // Message Information
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  
  // Message Content
  content: {
    text: String,
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'document', 'file'],
        required: true
      },
      public_id: String,
      url: String,
      filename: String,
      size: Number,
      mimeType: String
    }]
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'document', 'file', 'system'],
    default: 'text'
  },
  
  // System Messages
  systemMessageType: {
    type: String,
    enum: ['ticket_created', 'assigned', 'status_changed', 'resolved']
  },
  
  // Read Status
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
supportMessageSchema.index({ ticket: 1, createdAt: -1 });
supportMessageSchema.index({ sender: 1 });
supportMessageSchema.index({ isRead: 1 });

// Virtual for time ago
supportMessageSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
});

// Method to mark as read
supportMessageSchema.methods.markAsRead = async function(userId) {
  if (!this.readBy.some(read => read.user.toString() === userId.toString())) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    this.isRead = this.readBy.length > 0;
    await this.save();
  }
};

module.exports = mongoose.model('SupportMessage', supportMessageSchema);