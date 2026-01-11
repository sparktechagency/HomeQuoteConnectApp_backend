const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { NODE_ENV } = require('./config/env');

const app = express();
const server = http.createServer(app);

// ✅ Correct CORS DOMAIN
const allowedOrigins = [
  "http://localhost:5173",
  "https://quoto.ca",
  "http://localhost:3000",
  "https://raza-homequote-dashboard.vercel.app",
  "https://myqoute-eudjatd9a3f8eua8.southeastasia-01.azurewebsites.net"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ✅ Socket.IO CORS fixed
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"]
});

// DB Connect
connectDB();

// ✅ Security setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Stripe webhook - raw body আগে
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// JSON parser
app.use(express.json({ limit: '10mb' }));

// Logging
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// Socket global
app.set('io', io);
require('./socket/initializeSockets')(io);

// ========================
//         ROUTES
// ========================

// সবচেয়ে নির্দিষ্ট admin sub-routes প্রথমে (এগুলো ওভাররাইট হবে না)
app.use('/api/admin/credits', require('./routes/api/adminCreditRoutes.js'));
app.use('/api/admin/subscriptions', require('./routes/api/adminSubscriptionRoutes'));
app.use('/api/admin/categories', require('./routes/api/adminCategoryRoutes'));
app.use('/api/admin/background-checks', require('./routes/api/adminBackgroundCheckRoutes'));

// অন্যান্য সব রুট (যেভাবে ছিল ঠিক সেভাবে রাখা, শুধু অর্ডার পরিবর্তন)
app.use('/api/reports', require('./routes/api/reportRoutes'));
app.use('/api/health', require('./routes/api/healthRoutes'));
app.use('/api/auth', require('./routes/api/authRoutes'));
app.use('/api/chats', require('./routes/api/chatRoutes'));
app.use('/api/payments', require('./routes/api/paymentRoutes'));
app.use('/api/reviews', require('./routes/api/reviewRoutes'));
app.use('/api/support', require('./routes/api/supportRoutes'));
app.use('/api/subscriptions', require('./routes/api/subscriptionRoutes'));
app.use('/api/popular', require('./routes/api/popularRoutes'));
app.use('/api/project-gallery', require('./routes/api/projectGalleryRoutes'));

// Background check (তোমার অরিজিনাল অবস্থান অনুযায়ী আগে রাখা)
app.use('/api/background-check', require('./routes/api/backgroundCheckRoutes.js'));
app.use('/api/api/background-check', require('./routes/api/backgroundCheckRoutes.js'));

// সাধারণ admin route — এটা **সব specific admin route এর পরে** আসবে
app.use('/api/admin', require('./routes/api/adminRoutes'));
app.use('/api/admin', require('./routes/api/adminCategoryRoutes'));
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
app.use('/api/admin', require('./routes/api/adminNotificationRoutes'));
app.use('/api/admin', require('./routes/api/adminReportRoutes'));
app.use('/api/admin', require('./routes/api/adminSupportRoutes.js'));

// বাকি সব রুট (ডুপ্লিকেট থাকলেও রাখা হলো, express নিজে হ্যান্ডেল করবে)
app.use('/api/profile', require('./routes/api/profileRoutes'));
app.use('/api/notifications', require('./routes/api/notificationRoutes'));
app.use('/api/jobs', require('./routes/api/jobRoutes'));
app.use('/api/quotes', require('./routes/api/quoteRoutes'));
app.use('/api/provider', require('./routes/api/providerRoutes'));
app.use('/api/providers', require('./routes/api/publicProviderRoutes.js'));
app.use('/api/categories', require('./routes/api/categoryRoutes'));
app.use('/api/webhooks', require('./routes/api/webhookRoutes'));
app.use('/api', require('./routes/api/contentRoutes'));

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'MyQuote API is live! Use /api/health' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'MyQuote backend is running!' });
});

// Error handlers — সবশেষে
const { errorHandler, notFound } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});