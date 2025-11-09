// routes/reportRoutes.js
const express = require('express');
const {
  submitReport,
  getMyReports,
  getReportDetails,
  addReportEvidence,
  getReportReasons
} = require('../../controllers/reportController');
const { protect } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/reasons', getReportReasons);
router.get('/my-reports', getMyReports);
router.get('/:id', getReportDetails);

router.post(
  '/',
  uploadMultiple('evidence', 5),
  handleUploadErrors,
  submitReport
);

router.post(
  '/:id/evidence',
  uploadMultiple('evidence', 3),
  handleUploadErrors,
  addReportEvidence
);

module.exports = router;