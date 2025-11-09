// routes/adminNotificationRoutes.js
const express = require('express');
const {
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationStats
} = require('../../controllers/adminNotificationController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/notifications', getAdminNotifications);
router.get('/notifications/statistics', getNotificationStats);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/mark-all-read', markAllNotificationsAsRead);

module.exports = router;