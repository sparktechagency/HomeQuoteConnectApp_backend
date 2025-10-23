// routes/profileRoutes.js
const express = require('express');
const {
  getMyProfile,
  updateProfile,
  updateProfilePhoto,
  uploadVerificationDocuments,
  updateNotificationSettings,
  changePassword,
  deleteAccount,
  updateOnlineStatus
} = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const { uploadSingle, uploadFields, handleUploadErrors } = require('../config/multer');

const router = express.Router();

// All routes are protected
router.use(protect);

// Profile routes
router.get('/me', getMyProfile);
router.put('/update', updateProfile);
router.put('/online-status', updateOnlineStatus);

// File upload routes
router.put(
  '/photo',
  uploadSingle('profilePhoto'),
  handleUploadErrors,
  updateProfilePhoto
);

router.post(
  '/verification-documents',
  uploadFields([
    { name: 'businessLicense', maxCount: 1 },
    { name: 'certificate', maxCount: 1 }
  ]),
  handleUploadErrors,
  uploadVerificationDocuments
);

// Settings routes
router.put('/notification-settings', updateNotificationSettings);
router.put('/change-password', changePassword);
router.delete('/delete-account', deleteAccount);

module.exports = router;