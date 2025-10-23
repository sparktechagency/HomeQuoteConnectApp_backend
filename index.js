// server.js - Final Version
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { PORT, NODE_ENV } = require('./config/env');
const { errorHandler, notFound, authLimiter, apiLimiter } = require('./middleware/errorHandler');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Connect to Database
connectDB();

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true
}));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate Limiting
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Body Parsing Middleware
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Socket Handlers
const initializeSocket = require('./socket/initializeSockets');
initializeSocket(io);

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/health', require('./routes/api/healthRoutes'));
app.use('/api/auth', require('./routes/api/authRoutes'));
app.use('/api/profile', require('./routes/api/profileRoutes'));
app.use('/api/jobs', require('./routes/api/jobRoutes'));
app.use('/api/quotes', require('./routes/api/quoteRoutes'));
app.use('/api/provider', require('./routes/api/providerRoutes'));
app.use('/api/chats', require('./routes/api/chatRoutes'));
app.use('/api/payments', require('./routes/api/paymentRoutes'));
app.use('/api/reviews', require('./routes/api/reviewRoutes'));
app.use('/api/support', require('./routes/api/supportRoutes'));
app.use('/api/subscriptions', require('./routes/api/subscriptionRoutes'));
app.use('/api/popular', require('./routes/api/popularRoutes'));
app.use('/api/admin', require('./routes/api/adminRoutes'));
app.use('/api/admin', require('./routes/api/adminCategoryRoutes'));
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
app.use('/api/webhooks', require('./routes/api/webhookRoutes'));

// 404 Handler
app.use(notFound);

// Error Handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
});

module.exports = app;