// routes/projectGalleryRoutes.js - Enhanced Version
const express = require('express');
const {
  createProjectGallery,
  getMyProjectGallery,
  getPublicProjectGallery,
  getProjectDetails,
  updateProjectGallery,
  addProjectImages,
  updateImageMetadata,
  deleteProjectImage,
  deleteProjectGallery,
  likeProject,
  reorderProjectImages,
  setFeaturedImage,
  deleteMultipleProjectImages,
  updateProjectVisibility,
  toggleProjectFeatured,
  bulkDeleteProjects
} = require('../../controllers/projectGalleryController');
const { protect } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// Public routes
router.get('/', getPublicProjectGallery);
router.get('/:id', getProjectDetails);

// Protected routes
router.use(protect);

// Project CRUD operations
router.post(
  '/',
  uploadMultiple('images', 20),
  handleUploadErrors,
  createProjectGallery
);

router.get('/my-projects', getMyProjectGallery);

// Enhanced update route - supports both form data and JSON
router.put(
  '/:id',
  uploadMultiple('images', 10),
  handleUploadErrors,
  updateProjectGallery
);

// Project management routes
router.put('/:id/visibility', updateProjectVisibility);
router.put('/:id/featured', toggleProjectFeatured);
router.delete('/:id', deleteProjectGallery);

// Bulk operations
router.delete('/bulk-delete', bulkDeleteProjects);

// Image management routes
router.post(
  '/:id/images',
  uploadMultiple('images', 10),
  handleUploadErrors,
  addProjectImages
);

router.put('/:id/images/:imageIndex', updateImageMetadata);
router.delete('/:id/images/:imageIndex', deleteProjectImage);

// Enhanced image operations
router.delete('/:id/images', deleteMultipleProjectImages);
router.put('/:id/reorder-images', reorderProjectImages);
router.put('/:id/featured-image', setFeaturedImage);

// Social features
router.post('/:id/like', likeProject);

module.exports = router;