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
  deleteJob
} = require('../../controllers/jobController');
const { protect } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// All routes are protected
router.use(protect);

// Job routes
router.post(
  '/',
  uploadMultiple('photos', 10),
  handleUploadErrors,
  createJob
);

router.get('/', getJobs);
router.get('/today', getTodayJobs);
router.get('/active', getActiveJobs);
router.get('/my-jobs', getMyJobs);
router.get('/popular-categories', getPopularCategories);
router.get('/category/:categoryId', getJobsByCategory);
router.get('/:id', getJob);
router.put('/:id/cancel', cancelJob);
// Update job (client only)
router.put(
  '/:id',
  uploadMultiple('photos', 10),
  handleUploadErrors,
  updateJob
);

// Delete job
router.delete('/:id', deleteJob);

module.exports = router;