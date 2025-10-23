// routes/reviewRoutes.js
const express = require('express');
const {
  submitReview,
  getUserReviews,
  respondToReview,
  getPendingReviews
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public route
router.get('/user/:userId', getUserReviews);

// Protected routes
router.use(protect);

router.post('/', submitReview);
router.get('/pending', getPendingReviews);
router.put('/:id/respond', respondToReview);

module.exports = router;