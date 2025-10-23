// routes/adminRoutes.js
const express = require('express');
const {
  getDashboardStats,
  getUsers,
  toggleUserBlock,
  verifyProvider
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

// Admin routes
router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.put('/users/:id/block', toggleUserBlock);
router.put('/providers/:id/verify', verifyProvider);

module.exports = router;