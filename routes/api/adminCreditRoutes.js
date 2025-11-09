const express = require('express');
const { protect, authorize } = require('../../middleware/auth');
const { getCredits } = require('../../controllers/adminSubscriptionController');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

// Get credit activities
router.get('/', getCredits);

module.exports = router;
