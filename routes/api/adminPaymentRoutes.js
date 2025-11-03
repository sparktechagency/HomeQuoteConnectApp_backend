// routes/adminPaymentRoutes.js
const express = require('express');
const {
  getTransactions,
  getTransactionDetails,
  releasePayment,
  processPendingReleases,
  processRefund,
  getProviderWallets,
  getPlatformEarnings
} = require('../../controllers/adminPaymentController');
const {
  updateSubscriptionPlans,
  updateCreditPackages,
  getSubscriptionAnalytics
} = require('../../controllers/adminSubscriptionController');
const { protect, authorize } = require('../../middleware/auth');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

// Transaction management
router.get('/payments/transactions', getTransactions);
router.get('/payments/transactions/:id', getTransactionDetails);
router.put('/payments/transactions/:id/release', releasePayment);
router.put('/payments/transactions/:id/refund', processRefund);
router.post('/payments/release-pending', processPendingReleases);

// Wallet management
router.get('/payments/wallets', getProviderWallets);

// Earnings and analytics
router.get('/payments/earnings', getPlatformEarnings);

// Subscription and credit management
router.put('/subscriptions/plans', updateSubscriptionPlans);
router.put('/subscriptions/credit-packages', updateCreditPackages);
router.get('/subscriptions/analytics', getSubscriptionAnalytics);

module.exports = router;