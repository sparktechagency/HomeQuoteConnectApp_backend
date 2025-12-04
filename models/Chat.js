// models/Chat.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["client", "provider"],
          required: true,
        },
        lastRead: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
    },
    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    blockedUsers: [
      {
        blockedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        blockedUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        blockedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

/* ============================================================
   ✅ FIXED UNIQUE INDEX ISSUE
   Previously: job: { $exists: true } → allowed null values
   Now: excludes null, so only unique for chats linked to real jobs
============================================================ */
chatSchema.index(
  { "participants.user": 1, job: 1 },
  {
    unique: true,
    partialFilterExpression: { job: { $exists: true, $ne: null } },
  }
);

// Other useful indexes
chatSchema.index({ "participants.user": 1 });
chatSchema.index({ job: 1 });
chatSchema.index({ updatedAt: -1 });

/* ============================================================
   ✅ Utility Methods
============================================================ */

// Get the other participant in a chat
chatSchema.methods.getOtherParticipant = function (userId) {
  return this.participants.find(
    (p) => p.user.toString() !== userId.toString()
  );
};

// Update last read timestamp for a user
chatSchema.methods.updateLastRead = async function (userId) {
  const participant = this.participants.find(
    (p) => p.user.toString() === userId.toString()
  );
  if (participant) {
    participant.lastRead = new Date();
    await this.save();
  }
  return this;
};

/* ============================================================
   ✅ Find or Create Chat
   Prevents duplicate creation when job is null
============================================================ */
chatSchema.statics.findOrCreate = async function (
  participant1,
  participant2,
  jobId = null,
  quoteId = null
) {
  const participants = [
    { user: participant1.userId, role: participant1.role },
    { user: participant2.userId, role: participant2.role },
  ].sort((a, b) => a.user.toString().localeCompare(b.user.toString()));

  // Find existing chat — if jobId is null, match on both users only
  const chat = await this.findOne({
    "participants.user": { $all: [participant1.userId, participant2.userId] },
    ...(jobId ? { job: jobId } : { job: null }),
  });

  if (chat) {
    return chat.populate(
      "participants.user",
      "fullName profilePhoto role isOnline lastActive"
    );
  }

  // Create new chat only if not exists
  const newChat = await this.create({
    participants,
    job: jobId || null,
    quote: quoteId || null,
  });

  return newChat.populate(
    "participants.user",
    "fullName profilePhoto role isOnline lastActive"
  );
};

module.exports = mongoose.model("Chat", chatSchema);
