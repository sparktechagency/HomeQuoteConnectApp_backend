// routes/quoteRoutes.js
const express = require('express');
const {
  submitQuote,
  updateQuote,
  acceptQuote,
  declineQuote,
  cancelQuote,
  getMyQuotes,
  getQuotesByJob
} = require('../controllers/quoteController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Quote management
router.post('/', submitQuote);
router.get('/my-quotes', getMyQuotes);
router.get('/job/:jobId', getQuotesByJob);
router.put('/:id', updateQuote);
router.put('/:id/accept', acceptQuote);
router.put('/:id/decline', declineQuote);
router.put('/:id/cancel', cancelQuote);

module.exports = router;