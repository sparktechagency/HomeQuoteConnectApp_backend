// routes/adminReportRoutes.js
const express = require('express');
const {
  getReports,
  getReportDetails,
  addReportNote,
  resolveReport,
  updateReportStatus,
  getReportStatistics
} = require('../../controllers/adminReportController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/reports', getReports);
router.get('/reports/statistics', getReportStatistics);
router.get('/reports/:id', getReportDetails);
router.post('/reports/:id/notes', addReportNote);
router.put('/reports/:id/resolve', resolveReport);
router.put('/reports/:id/status', updateReportStatus);

module.exports = router;