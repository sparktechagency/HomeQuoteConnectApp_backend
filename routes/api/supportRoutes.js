// routes/supportRoutes.js
const express = require('express');
const {
  createSupportTicket,
  getUserTickets,
  getTicketMessages,
  sendSupportMessage,
  joinLiveChat,
  getSupportStatistics
} = require('../../controllers/supportController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// User routes
router.post('/tickets', createSupportTicket);
router.get('/tickets', getUserTickets);
router.get('/tickets/:id/messages', getTicketMessages);
router.post('/tickets/:id/messages', sendSupportMessage);
router.post('/tickets/:id/join-live', joinLiveChat);

// Admin only routes
router.get('/statistics', authorize('admin'), getSupportStatistics);

module.exports = router;