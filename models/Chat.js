// models/Chat.js
const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['client', 'provider'],
      required: true
    },
    lastRead: {
      type: Date,
      default: Date.now
    }
  }],
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },
  isActive: {
    type: Boolean,
    default: true
  },
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

// Compound index for unique chat between users for a job
chatSchema.index({ 
  'participants.user': 1, 
  job: 1 
}, { 
  unique: true,
  partialFilterExpression: { job: { $exists: true } }
});

// Index for participant lookup
chatSchema.index({ 'participants.user': 1 });
chatSchema.index({ job: 1 });
chatSchema.index({ updatedAt: -1 });

// Method to get other participant
chatSchema.methods.getOtherParticipant = function(userId) {
  return this.participants.find(participant => 
    participant.user.toString() !== userId.toString()
  );
};

// Method to update last read
chatSchema.methods.updateLastRead = function(userId) {
  const participant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  );
  if (participant) {
    participant.lastRead = new Date();
  }
  return this.save();
};

// Static method to find or create chat
chatSchema.statics.findOrCreate = async function(participant1, participant2, jobId = null, quoteId = null) {
  const participants = [
    { user: participant1.userId, role: participant1.role },
    { user: participant2.userId, role: participant2.role }
  ].sort((a, b) => a.user.toString().localeCompare(b.user.toString()));

  let chat = await this.findOne({
    'participants.user': { $all: [participant1.userId, participant2.userId] },
    ...(jobId && { job: jobId })
  });

  if (!chat) {
    chat = await this.create({
      participants,
      job: jobId,
      quote: quoteId
    });
  }

  return chat.populate('participants.user', 'fullName profilePhoto role isOnline lastActive');
};

module.exports = mongoose.model('Chat', chatSchema);