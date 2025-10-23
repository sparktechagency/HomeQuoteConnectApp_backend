// routes/paymentRoutes.js
const express = require('express');
const {
  createPayment,
  confirmCashPayment,
  handleWebhook,
  setupStripeConnect,
  getWallet,
  requestWithdrawal
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Webhook route (no protection needed)
router.post('/webhook', express.raw({type: 'application/json'}), handleWebhook);

// Protected routes
router.use(protect);

router.post('/create-payment-intent', createPayment);
router.put('/cash/:transactionId/confirm', confirmCashPayment);
router.post('/setup-connect', setupStripeConnect);
router.get('/wallet', getWallet);
router.post('/withdraw', requestWithdrawal);

module.exports = router;