// socket/chatHandler.js
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

const chatHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected to chat:', socket.id);

    // Join chat room
    socket.on('join-chat', async (payload) => {
      try {
        // Accept either a string chatId or an object { chatId }
        const chatId = typeof payload === 'string' ? payload : (payload && payload.chatId);
        if (!chatId) {
          socket.emit('error', { message: 'join-chat requires chatId' });
          return;
        }

        socket.join(chatId);
        console.log(`User joined chat room: ${chatId}`);

        // Mark messages as delivered
        await Message.updateMany(
          { 
            chat: chatId,
            receiver: socket.userId,
            delivered: false
          },
          { 
            delivered: true,
            deliveredAt: new Date()
          }
        );
      } catch (error) {
        console.error('Join chat error:', error);
      }
    });

    // Leave chat room
    socket.on('leave-chat', (payload) => {
      const chatId = typeof payload === 'string' ? payload : (payload && payload.chatId);
      if (!chatId) return;
      socket.leave(chatId);
      console.log(`User left chat room: ${chatId}`);
    });
    // Send message
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text' } = data;
        console.log('send-message triggered with:', data);
        
        // Verify user is part of the chat
        const chat = await Chat.findById(chatId).populate('participants.user');
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        const isParticipant = chat.participants.some(
          p => p.user._id.toString() === socket.userId
        );

        if (!isParticipant) {
          socket.emit('error', { message: 'Not authorized to send messages in this chat' });
          return;
        }

        // Get receiver
        const receiver = chat.participants.find(
          p => p.user._id.toString() !== socket.userId
        );

        // Validate messaging rules
        if (receiver.user.role === 'client' && socket.userRole === 'provider') {
          // Provider can only message client if they have an accepted quote
          const hasAcceptedQuote = await checkProviderCanMessageClient(
            socket.userId, 
            receiver.user._id, 
            chat.job
          );
          
          if (!hasAcceptedQuote) {
            socket.emit('error', { 
              message: 'You can only message clients after they have accepted your quote' 
            });
            return;
          }
        }

        // Validate content structure expected by Message schema
        // content should be an object: { text: string, media: Array }
        if (!content || typeof content !== 'object') {
          socket.emit('error', { message: "Invalid message payload: 'content' object is required." });
          return;
        }

        const text = typeof content.text === 'string' ? content.text : '';
        const mediaArr = Array.isArray(content.media) ? content.media : [];

        if (!text && mediaArr.length === 0) {
          socket.emit('error', { message: "Message must contain 'content.text' string or non-empty 'content.media' array." });
          return;
        }

     // Create message
const message = await Message.create({
  chat: chatId,
  sender: socket.userId,
  receiver: receiver.user._id,
  content: {
    text,
    media: mediaArr
  },
  messageType
});

// FIXED: Add .exec()
const populatedMessage = await Message.findById(message._id)
  .populate('sender', 'fullName profilePhoto role')
  .populate('receiver', 'fullName profilePhoto role')
  .exec();

// Emit to chat room
io.to(chatId).emit('new-message', populatedMessage);
console.log(`new-message emitted to room: ${chatId}`);
console.log(`Active sockets in room: ${io.sockets.adapter.rooms.get(chatId)?.size || 0}`);
socket.emit('new-message', populatedMessage); // Safe for Postman

// Emit to receiver for notification
socket.to(receiver.user._id.toString()).emit('message-notification', {
  message: populatedMessage,
  chatId,
  unreadCount: await getUnreadCount(receiver.user._id)
});



// Update chat's last read for sender
await chat.updateLastRead(socket.userId);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Typing indicators
    socket.on('typing-start', (data) => {
      const chatId = typeof data === 'string' ? data : (data && (data.roomId || data.chatId));
      if (!chatId) return;
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      const chatId = typeof data === 'string' ? data : (data && (data.roomId || data.chatId));
      if (!chatId) return;
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        isTyping: false
      });
    });

    // Mark messages as read
    socket.on('mark-messages-read', async (data) => {
      try {
        const chatId = typeof data === 'string' ? data : (data && data.chatId);
        if (!chatId) return;

        await Message.updateMany(
          {
            chat: chatId,
            receiver: socket.userId,
            isRead: false
          },
          {
            isRead: true,
            readAt: new Date()
          }
        );

        // Update chat last read
        const chat = await Chat.findById(chatId);
        if (chat) {
          await chat.updateLastRead(socket.userId);
        }

        socket.to(chatId).emit('messages-read', {
          userId: socket.userId,
          chatId
        });

      } catch (error) {
        console.error('Mark messages read error:', error);
      }
    });

    // Get online status
    socket.on('get-online-status', async (userId) => {
      try {
        const user = await User.findById(userId).select('isOnline lastActive');
        socket.emit('online-status', {
          userId,
          isOnline: user.isOnline,
          lastActive: user.lastActive
        });
      } catch (error) {
        console.error('Get online status error:', error);
      }
    });
  });
};

// Helper function to check if provider can message client
const checkProviderCanMessageClient = async (providerId, clientId, jobId) => {
  const Quote = require('../models/Quote');
  
 if (!jobId) {
    const existingChat = await Chat.findOne({
      'participants.user': { $all: [providerId, clientId] }
    });

    if (!existingChat) return false;

    const clientFirstMessage = await Message.findOne({
      chat: existingChat._id,
      sender: clientId
    });

    if (clientFirstMessage) return true;
    return false;
  }

  const acceptedQuote = await Quote.findOne({
    job: jobId,
    provider: providerId,
    client: clientId,
    status: 'accepted'
  });

  if (acceptedQuote) return true;

  const chat = await Chat.findOne({
    job: jobId,
    'participants.user': { $all: [providerId, clientId] }
  });

  if (chat) {
    const clientFirstMessage = await Message.findOne({
      chat: chat._id,
      sender: clientId
    });
    if (clientFirstMessage) return true;
  }

  return false;
};

// Helper function to get unread message count
const getUnreadCount = async (userId) => {
  const Message = require('../models/Message');
  
  return await Message.countDocuments({
    receiver: userId,
    isRead: false
  });
};

module.exports = chatHandler;