// routes/subscriptionRoutes.js
const express = require('express');
const {
  getSubscriptions,
  purchaseSubscription,
  getMySubscription,
  getCreditPackages,
  purchaseCredits,
  getCreditActivity
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getSubscriptions);
router.get('/credits/packages', getCreditPackages);

// Protected routes
router.use(protect);

router.post('/purchase', purchaseSubscription);
router.get('/my-subscription', getMySubscription);
router.post('/credits/purchase', purchaseCredits);
router.get('/credits/activity', getCreditActivity);

module.exports = router;