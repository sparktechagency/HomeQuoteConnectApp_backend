// socket/initializeSocket.js
const { socketHandler } = require('./socketHandler');
const chatHandler = require('./chatHandler');
const { verifyToken } = require('../utils/generateToken');
const { notificationHandler } = require('./notificationHandler');
const supportHandler = require('./supportHandler');

const initializeSocket = (io) => {
  // === AUTHENTICATION MIDDLEWARE (PERFECT FOR POSTMAN) ===
  io.use(async (socket, next) => {
    try {
      let token = null;

      // 1. Postman: Connection variables → auth: { token: "..." }
      token = socket.handshake.auth?.token;

      // 2. Postman: Headers → Authorization: Bearer xyz
      if (!token && socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        token = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;
      }

      // 3. Postman: Params → ?token=xyz
      if (!token && socket.handshake.query?.token) {
        token = socket.handshake.query.token;
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      console.log(`Socket authenticated: ${decoded.userId} (${decoded.role})`);
      next();
    } catch (error) {
      console.error('Socket auth failed:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // === INITIALIZE HANDLERS (FIXED SEMICOLON) ===
  socketHandler(io);
  chatHandler(io);
  notificationHandler(io);  // ← SEMICOLON ADDED!
  supportHandler(io);   // <-- ADD THIS!

  return io;
};

module.exports = initializeSocket;