// routes/chatRoutes.js
const express = require('express');
const {
  getChats,
  getOrCreateChat,
  getChatMessages,
  sendMessage,
  getUnreadCount,
  sendDirectMessageToProvider,
  blockUser,
  unblockUser
} = require('../../controllers/chatController');
const { protect } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// All routes are protected
router.use(protect);

// Chat routes
router.get('/', getChats);
router.post('/', getOrCreateChat);
router.post('/direct', uploadMultiple('media', 5), handleUploadErrors, sendDirectMessageToProvider);
router.get('/unread/count', getUnreadCount);
router.get('/:id/messages', getChatMessages);
router.post('/:id/messages', uploadMultiple('media', 5), handleUploadErrors, sendMessage);
router.post('/:id/block', blockUser);
router.post('/:id/unblock', unblockUser);

module.exports = router;