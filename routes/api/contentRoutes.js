// routes/contentRoutes.js
const express = require('express');
const {
  getContent,
  getContentByType,
  updateContent,
  getContentHistory
} = require('../../controllers/contentController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// Public routes
router.get('/content/:type', getContentByType);

// Protected admin routes
router.use(protect);
router.use(authorize('admin'));

router.get('/admin/content', getContent);
router.put('/admin/content/:type', updateContent);
router.get('/admin/content/:type/history', getContentHistory);

module.exports = router;