// socket/socketHandler.js - Enhanced Version
const User = require('../models/User');

// Store connected users for real-time status
const connectedUsers = new Map();

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User joins their personal room for notifications
    socket.on('user-join', async (userId) => {
      try {
        socket.join(userId);
        
        // Store user connection
        if (!connectedUsers.has(userId)) {
          connectedUsers.set(userId, new Set());
        }
        connectedUsers.get(userId).add(socket.id);

        // Update user online status only if this is the first connection
        if (connectedUsers.get(userId).size === 1) {
          await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastActive: new Date()
          });

          // Notify others about user online status
          socket.broadcast.emit('user-status-changed', {
            userId,
            isOnline: true,
            lastActive: new Date()
          });
        }

        console.log(`User ${userId} joined socket room. Active connections: ${connectedUsers.get(userId).size}`);
      } catch (error) {
        console.error('User join error:', error);
      }
    });

    // Handle user disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      
      // Find and remove user from connected users
      for (const [userId, sockets] of connectedUsers.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          
          // If no more connections, set user offline
          if (sockets.size === 0) {
            connectedUsers.delete(userId);
            
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastActive: new Date()
            });

            // Notify others about user offline status
            socket.broadcast.emit('user-status-changed', {
              userId,
              isOnline: false,
              lastActive: new Date()
            });
          }
          break;
        }
      }
    });

    // Handle manual online status change
    socket.on('set-online-status', async (data) => {
      try {
        const { userId, isOnline } = data;
        
        await User.findByIdAndUpdate(userId, {
          isOnline,
          lastActive: new Date()
        });

        // Broadcast status change
        socket.broadcast.emit('user-status-changed', {
          userId,
          isOnline,
          lastActive: new Date()
        });

      } catch (error) {
        console.error('Set online status error:', error);
      }
    });

    // Handle typing indicators for chat
    socket.on('typing-start', (data) => {
      socket.to(data.roomId).emit('user-typing', {
        userId: data.userId,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      socket.to(data.roomId).emit('user-typing', {
        userId: data.userId,
        isTyping: false
      });
    });

    // Handle notification settings updates
    socket.on('notification-settings-updated', (data) => {
      socket.broadcast.emit('user-notification-settings-changed', data);
    });
  });

  // Make io available to controllers
  io.app = io;

  return io;
};




module.exports = {
  socketHandler,
};