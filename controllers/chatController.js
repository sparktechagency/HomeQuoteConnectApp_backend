// controllers/chatController.js
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const Job = require('../models/Job');
const Quote = require('../models/Quote');

// @desc    Get user's chats
// @route   GET /api/chats
// @access  Private
const getChats = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const chats = await Chat.find({
      'participants.user': req.user._id,
      isActive: true
    })
    .populate('participants.user', 'fullName profilePhoto role isOnline lastActive')
    .populate('job', 'title serviceCategory')
    .populate('quote')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Get unread counts for each chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          receiver: req.user._id,
          isRead: false
        });

        const lastMessage = await Message.findOne({ chat: chat._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'fullName profilePhoto');

        return {
          ...chat.toObject(),
          unreadCount,
          lastMessage
        };
      })
    );

    const total = await Chat.countDocuments({
      'participants.user': req.user._id,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        chats: chatsWithUnread,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chats',
      error: error.message
    });
  }
};

// @desc    Get or create chat
// @route   POST /api/chats
// @access  Private
const getOrCreateChat = async (req, res) => {
  try {
    const { otherUserId, jobId, quoteId } = req.body;

    // Validate other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate job if provided
    if (jobId) {
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }
    }

    // Validate messaging rules
    if (req.user.role === 'provider' && otherUser.role === 'client') {
      const hasAcceptedQuote = await checkProviderCanMessageClient(
        req.user._id,
        otherUser._id,
        jobId
      );
      
      if (!hasAcceptedQuote) {
        return res.status(403).json({
          success: false,
          message: 'You can only message clients after they have accepted your quote'
        });
      }
    }

    // Create participants
    const participant1 = {
      userId: req.user._id,
      role: req.user.role
    };

    const participant2 = {
      userId: otherUser._id,
      role: otherUser.role
    };

    // Find or create chat
    const chat = await Chat.findOrCreate(participant1, participant2, jobId, quoteId);

    res.status(200).json({
      success: true,
      data: { chat }
    });

  } catch (error) {
    console.error('Get or create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chat',
      error: error.message
    });
  }
};

// @desc    Get chat messages
// @route   GET /api/chats/:id/messages
// @access  Private
const getChatMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: id,
      'participants.user': req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    const messages = await Message.find({ chat: id })
      .populate('sender', 'fullName profilePhoto role')
      .populate('receiver', 'fullName profilePhoto role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark messages as read
    await Message.updateMany(
      {
        chat: id,
        receiver: req.user._id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Update last read
    await chat.updateLastRead(req.user._id);

    const total = await Message.countDocuments({ chat: id });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

// @desc    Send message
// @route   POST /api/chats/:id/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text', media } = req.body;

    // Verify user is part of the chat
    const chat = await Chat.findById(id).populate('participants.user');
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const isParticipant = chat.participants.some(
      p => p.user._id.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this chat'
      });
    }

    // Get receiver
    const receiver = chat.participants.find(
      p => p.user._id.toString() !== req.user._id.toString()
    );

    // Validate messaging rules for providers
    if (req.user.role === 'provider' && receiver.user.role === 'client') {
      const hasAcceptedQuote = await checkProviderCanMessageClient(
        req.user._id,
        receiver.user._id,
        chat.job
      );
      
      if (!hasAcceptedQuote) {
        return res.status(403).json({
          success: false,
          message: 'You can only message clients after they have accepted your quote'
        });
      }
    }

    // Create message
    const message = await Message.create({
      chat: id,
      sender: req.user._id,
      receiver: receiver.user._id,
      content: {
        text: content,
        media: media || []
      },
      messageType
    });

    // Populate message
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'fullName profilePhoto role')
      .populate('receiver', 'fullName profilePhoto role');

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').to(id).emit('new-message', populatedMessage);
      
      // Notify receiver
      req.app.get('io').to(receiver.user._id.toString()).emit('message-notification', {
        message: populatedMessage,
        chatId: id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: populatedMessage }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

// @desc    Get unread message count
// @route   GET /api/chats/unread/count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
};

// Helper function to check if provider can message client
const checkProviderCanMessageClient = async (providerId, clientId, jobId) => {
  if (!jobId) return false;
  
  const acceptedQuote = await Quote.findOne({
    job: jobId,
    provider: providerId,
    status: 'accepted'
  });
  
  return !!acceptedQuote;
};

// Exports (placed after helper and direct message function)

// @desc    Client -> Provider direct message (create chat if needed and send message)
// @route   POST /api/chats/direct
// @access  Private (Clients only)
const sendDirectMessageToProvider = async (req, res) => {
  try {
    // Only clients may use this shortcut
    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can send direct messages via this endpoint' });
    }

    // Guard against missing body
    const { providerId, content, messageType = 'text', media, jobId, quoteId } = req.body || {};

    // Validate request payload
    if (!providerId) {
      return res.status(400).json({ success: false, message: 'providerId is required' });
    }
    if (!content || (typeof content === 'object' && !content.text && !(content.media && content.media.length))) {
      return res.status(400).json({ success: false, message: 'content is required' });
    }

    // Validate provider
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== 'provider') {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Create or find chat
    const participant1 = { userId: req.user._id, role: req.user.role };
    const participant2 = { userId: provider._id, role: provider.role };
    const chat = await Chat.findOrCreate(participant1, participant2, jobId || null, quoteId || null);

    // Create message
    const message = await Message.create({
      chat: chat._id,
      sender: req.user._id,
      receiver: provider._id,
      content: { text: content, media: media || [] },
      messageType
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'fullName profilePhoto role')
      .populate('receiver', 'fullName profilePhoto role');

    // Emit socket events
    if (req.app.get('io')) {
      req.app.get('io').to(chat._id.toString()).emit('new-message', populatedMessage);
      req.app.get('io').to(provider._id.toString()).emit('message-notification', {
        message: populatedMessage,
        chatId: chat._id
      });
    }

    res.status(201).json({ success: true, message: 'Message sent', data: { message: populatedMessage, chat } });
  } catch (error) {
    console.error('Send direct message error:', error);
    res.status(500).json({ success: false, message: 'Error sending direct message', error: error.message });
  }
};

module.exports = {
  getChats,
  getOrCreateChat,
  getChatMessages,
  sendMessage,
  getUnreadCount,
  sendDirectMessageToProvider
};