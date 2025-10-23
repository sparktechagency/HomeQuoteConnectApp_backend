const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/webhookController');

// Stripe webhook endpoint (expects raw body middleware in index.js for '/api/webhooks/stripe')
router.post('/stripe', webhookController.handleStripeWebhook);

module.exports = router;
