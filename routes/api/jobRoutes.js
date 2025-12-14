// routes/jobRoutes.js
const express = require('express');
const {
  createJob,
  getJobs,
  getTodayJobs,
  getActiveJobs,
  getJob,
  getMyJobs,
  cancelJob,
  getPopularCategories,
  getJobsByCategory,
  updateJob,
  deleteJob,
  getJobInvoice
} = require('../../controllers/jobController');
const { protect } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// Public routes (no authentication required)
router.get('/today', getTodayJobs);
router.get('/active', getActiveJobs);
router.get('/popular-categories', getPopularCategories);
router.get('/category/:categoryId', getJobsByCategory);

// Protected routes (authentication required)
router.post(
  '/',
  protect,
  uploadMultiple('photos', 10),
  handleUploadErrors,
  createJob
);

router.get('/', protect, getJobs);

router.get('/my-jobs', protect, getMyJobs);
router.get('/:id', protect, getJob);
router.get('/:id', getJob);

router.put('/:id/cancel', protect, cancelJob);
// Update job (client only)
router.put(
  '/:id',
  protect,
  uploadMultiple('photos', 10),
  handleUploadErrors,
  updateJob
);

router.get('/:id/invoice', protect, getJobInvoice);
// Delete job
router.delete('/:id', protect, deleteJob);

module.exports = router;