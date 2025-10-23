// routes/providerRoutes.js
const express = require('express');
const {
  getNearbyJobs,
  getAcceptedJobs,
  getTodayJobs,
  markJobAsComplete,
  getProviderDashboard
} = require('../../controllers/providerController');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// All routes are protected and for providers only
router.use(protect);

// Provider job management
router.get('/nearby-jobs', getNearbyJobs);
router.get('/accepted-jobs', getAcceptedJobs);
router.get('/today-jobs', getTodayJobs);
router.get('/dashboard', getProviderDashboard);
router.put('/jobs/:id/complete', markJobAsComplete);

module.exports = router;