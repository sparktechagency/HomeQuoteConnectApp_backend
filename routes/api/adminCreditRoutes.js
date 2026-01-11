const express = require('express');
const { protect, authorize } = require('../../middleware/auth');
const { getCredits } = require('../../controllers/adminSubscriptionController');
const {
  getCreditSettings,
  updateCreditSettings,
  adjustUserCredits,
  getUserCredits,
  bulkAdjustCredits,
  getCreditStatistics
} = require('../../controllers/adminCreditController');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

// Credit activity history
router.get('/', getCredits);

// System credit settings
router.get('/settings', getCreditSettings);
router.put('/settings', updateCreditSettings);

// User credit management
router.get('/user/:userId', getUserCredits);
router.post('/adjust', adjustUserCredits);
router.post('/bulk-adjust', bulkAdjustCredits);

// Credit statistics
router.get('/statistics', getCreditStatistics);

module.exports = router;
