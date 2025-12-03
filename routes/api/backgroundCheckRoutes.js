// routes/api/backgroundCheckRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');

console.log('✅ [BackgroundCheckRoutes] Provider background check routes loaded (NO authorize middleware)');

const { uploadFields } = require('../../config/multer');
const {
  submitBackgroundCheck,
  getMyBackgroundCheckStatus
} = require('../../controllers/backgroundCheckController');

// Apply only protect — role check is done inside controller
router.use(protect);

// Debug log
router.use((req, res, next) => {
  console.log('[BackgroundCheck] Access attempt:', {
    userId: req.user._id,
    role: req.user.role,
    path: req.originalUrl
  });
  next();
});

router.post(
  '/submit',
  uploadFields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'consentForm', maxCount: 1 }
  ]),
  submitBackgroundCheck
);

router.get('/status', getMyBackgroundCheckStatus);

// Debug endpoint
router.get('/debug', (req, res) => {
  res.json({
    success: true,
    message: 'Background check route working',
    user: { id: req.user._id, role: req.user.role }
  });
});

module.exports = router;