const express = require('express');
const { protect, authorize } = require('../../middleware/auth');
const { getSubscriptions } = require('../../controllers/adminSubscriptionController');

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(authorize('admin'));

// Get all subscriptions with user details
router.get('/', getSubscriptions);

module.exports = router;