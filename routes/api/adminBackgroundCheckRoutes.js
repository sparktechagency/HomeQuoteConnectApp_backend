// routes/api/adminBackgroundCheckRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const {
  getAllBackgroundChecks,
  getBackgroundCheckById,
  approveBackgroundCheck,
  rejectBackgroundCheck,
  requestResubmission,
  getBackgroundCheckStats
} = require('../../controllers/adminBackgroundCheckController');

// All routes are admin only
// router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/background-checks/stats
// @desc    Get background check statistics
// @access  Private (Admin only)
router.get('/stats', getBackgroundCheckStats);

// @route   GET /api/admin/background-checks
// @desc    Get all background checks with filters
// @access  Private (Admin only)
router.get('/', getAllBackgroundChecks);

// @route   GET /api/admin/background-checks/:id
// @desc    Get single background check details
// @access  Private (Admin only)
router.get('/:id', getBackgroundCheckById);

// @route   PUT /api/admin/background-checks/:id/approve
// @desc    Approve background check
// @access  Private (Admin only)
router.put('/:id/approve', approveBackgroundCheck);

// @route   PUT /api/admin/background-checks/:id/reject
// @desc    Reject background check
// @access  Private (Admin only)
router.put('/:id/reject', rejectBackgroundCheck);

// @route   PUT /api/admin/background-checks/:id/request-resubmission
// @desc    Request resubmission of background check
// @access  Private (Admin only)
router.put('/:id/request-resubmission', requestResubmission);

module.exports = router;
