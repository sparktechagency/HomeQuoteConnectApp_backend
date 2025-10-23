// routes/chatRoutes.js
const express = require('express');
const {
  getChats,
  getOrCreateChat,
  getChatMessages,
  sendMessage,
  getUnreadCount
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../config/multer');

const router = express.Router();

// All routes are protected
router.use(protect);

// Chat routes
router.get('/', getChats);
router.post('/', getOrCreateChat);
router.get('/unread/count', getUnreadCount);
router.get('/:id/messages', getChatMessages);
router.post('/:id/messages', sendMessage);

module.exports = router;