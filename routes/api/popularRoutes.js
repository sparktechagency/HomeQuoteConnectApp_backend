// routes/popularRoutes.js
const express = require('express');
const {
  getPopularServiceProviders,
  getProviderDetails,
  bookProviderDirectly
} = require('../../controllers/popularController');
const { protect } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// Public routes
router.get('/providers', getPopularServiceProviders);
router.get('/providers/:id', getProviderDetails);

// Protected routes
router.use(protect);
router.post(
  '/providers/:id/book',
  uploadMultiple('photos', 10),
  handleUploadErrors,
  bookProviderDirectly
);

module.exports = router;