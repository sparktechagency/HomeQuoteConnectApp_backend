// Update the main socket handler to include chat and authentication
const { socketHandler } = require('./socketHandler');
const chatHandler = require('./chatHandler');
const { verifyToken } = require('../utils/generateToken');

const initializeSocket = (io) => {
  // Authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Initialize handlers
  socketHandler(io);
  chatHandler(io);
};

module.exports = initializeSocket;