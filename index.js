const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { PORT, NODE_ENV } = require('./config/env');

// Initialize Express
const app = express();
const server = http.createServer(app);

// ✅ Correct CORS DOMAIN
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ✅ Socket.IO CORS fixed
const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// DB Connect
connectDB();

// ✅ Security setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ Use ONLY one CORS config — not duplicated
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

// ✅ Stripe webhook route must accept raw body – placed BEFORE express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// ✅ Normal JSON parser for all other routes
app.use(express.json({ limit: '10mb' }));

// ✅ Logging
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// ✅ Attach socket globally
app.set('io', io);
require('./socket/initializeSockets')(io);

// ✅ Routes
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
// Admin payment routes (separate file for payment management)
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
app.use('/api/categories', require('./routes/api/categoryRoutes'));
app.use('/api/webhooks', require('./routes/api/webhookRoutes'));

// ✅ Error handlers
const { errorHandler, notFound } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ✅ Set HOST properly for local + LAN support
const HOST = process.env.HOST || '0.0.0.0';

// ✅ Start Server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
