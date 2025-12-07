// routes/api/notificationRoutes.js
const express = require('express');
const {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} = require('../../controllers/notificationController');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Notification routes
router.get('/', getNotifications);
router.get('/unread/count', getUnreadCount);
router.put('/:id/read', markNotificationAsRead);
router.put('/mark-all-read', markAllNotificationsAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;