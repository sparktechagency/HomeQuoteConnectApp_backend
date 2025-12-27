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
  "http://localhost:5173",                    // ← Your local frontend
  "http://localhost:3000",                    // ← If you use port 3000
  "https://raza-homequote-dashboard.vercel.app", // ← Your live frontend
  "https://myqoute-eudjatd9a3f8eua8.southeastasia-01.azurewebsites.net" // optional
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
  transports: ["polling", "websocket"]  // ← Works even on Azure Free tier!
});

// DB Connect
connectDB();

// ✅ Security setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ Use ONLY one CORS config — not duplicated


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
// Background check routes mounted early to avoid admin middleware precedence
app.use('/api/background-check', require('./routes/api/backgroundCheckRoutes.js'));
// Temporary alias for frontend double /api prefix (SHOULD BE FIXED IN FRONTEND)
app.use('/api/api/background-check', require('./routes/api/backgroundCheckRoutes.js'));

// Admin routes
app.use('/api/admin', require('./routes/api/adminRoutes'));
app.use('/api/admin', require('./routes/api/adminCategoryRoutes'));
app.use('/api/categories',  require('./routes/api/categoryRoutes'));
// Admin payment routes (separate file for payment management)
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
app.use('/api/admin/categories', require('./routes/api/adminCategoryRoutes'));
app.use('/api/webhooks', require('./routes/api/webhookRoutes'));
app.use('/api/admin/subscriptions',  require('./routes/api/adminSubscriptionRoutes'));
app.use('/api/admin/credits', require('./routes/api/adminCreditRoutes.js'));
app.use('/api/admin', require('./routes/api/adminNotificationRoutes'));
app.use('/api/admin', require('./routes/api/adminReportRoutes'));
app.use('/api/quotes', require('./routes/api/quoteRoutes'));
app.use('/api/admin', require('./routes/api/adminSupportRoutes.js'));
app.use('/api/profile', require('./routes/api/profileRoutes'));
app.use('/api/notifications', require('./routes/api/notificationRoutes'));
app.use('/api/jobs', require('./routes/api/jobRoutes'));
app.use('/api/quotes', require('./routes/api/quoteRoutes'));
app.use('/api/provider', require('./routes/api/providerRoutes'));
app.use('/api/providers', require('./routes/api/publicProviderRoutes.js'));
app.use('/api/chats', require('./routes/api/chatRoutes'));
app.use('/api/payments', require('./routes/api/paymentRoutes'));
app.use('/api/reviews', require('./routes/api/reviewRoutes'));
app.use('/api/support', require('./routes/api/supportRoutes'));
app.use('/api/subscriptions', require('./routes/api/subscriptionRoutes'));
app.use('/api/popular', require('./routes/api/popularRoutes'));
app.use('/api/project-gallery', require('./routes/api/projectGalleryRoutes'));     
app.use('/api/admin', require('./routes/api/adminRoutes'));
app.use('/api/admin', require('./routes/api/adminCategoryRoutes'));
app.use('/api/categories',  require('./routes/api/categoryRoutes'));
// app.use('/api/admin/background-checks', require('./routes/api/adminBackgroundCheckRoutes'));

// Content and reports
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
app.use('/api/admin/categories', require('./routes/api/adminCategoryRoutes'));
app.use('/api/webhooks', require('./routes/api/webhookRoutes'));
app.use('/api/admin/subscriptions',  require('./routes/api/adminSubscriptionRoutes'));
app.use('/api/admin/credits', require('./routes/api/adminCreditRoutes.js'));
app.use('/api/admin', require('./routes/api/adminNotificationRoutes'));
app.use('/api/admin', require('./routes/api/adminReportRoutes')); 
app.use('/api/admin', require('./routes/api/adminSupportRoutes.js')); 
app.use('/api', require('./routes/api/contentRoutes'));
// app.use('/api/reports', require('./routes/api/reportRoutes'));
app.use('/api', require('./routes/api/contentRoutes'));
// app.use('/api/reports', require('./routes/api/reportRoutes'));
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
app.use('/api/admin/categories', require('./routes/api/adminCategoryRoutes'));
app.use('/api/webhooks', require('./routes/api/webhookRoutes'));
app.use('/api/admin/subscriptions',  require('./routes/api/adminSubscriptionRoutes'));
app.use('/api/admin/credits', require('./routes/api/adminCreditRoutes.js'));
app.use('/api/admin', require('./routes/api/adminNotificationRoutes'));
app.use('/api/admin', require('./routes/api/adminReportRoutes')); 
app.use('/api/admin', require('./routes/api/adminSupportRoutes.js')); 
app.use('/api', require('./routes/api/contentRoutes'));
// app.use('/api/background-check', ...);
// app.use('/api/api/background-check', ...);

app.use('/api/admin/background-checks', require('./routes/api/adminBackgroundCheckRoutes'));
app.get('/', (req, res) => {
  res.json({ message: 'MyQuote API is live! Use /api/health' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'MyQuote backend is running!' });
});



// ✅ Error handlers
const { errorHandler, notFound } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);


// ✅ Set HOST properly for local + LAN support
// const PORT = process.env.PORT || 3000;        // ← Azure sets process.env.PORT automatically
// const HOST = '0.0.0.0';                       // ← Required on Linux/Azure

// server.listen(PORT, HOST, () => {
//   console.log(`Server running on port ${PORT} (Azure + Local)`);
//   console.log(`→ Live at https://my-node-backend-akash.azurewebsites.net`);
// });

// ----------------thats for local host--------------

// const HOST = process.env.HOST || "0.0.0.0";

// server.listen("5000", HOST, () => {
//   console.log(`🚀 Server running at http://${HOST}:5000`);
// });



// ----------------thats for Live host when gitpush host--------------

const PORT = process.env.PORT || 3000;        
                  

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

