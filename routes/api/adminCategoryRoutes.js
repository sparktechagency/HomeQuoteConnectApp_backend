// routes/adminCategoryRoutes.js
const express = require('express');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategorySpecializations,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization
} = require('../../controllers/adminCategoryController');
const { protect, authorize } = require('../../middleware/auth');
const { uploadSingle, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

// Category routes
router.get('/', getCategories);
router.post(
  '/',
  uploadSingle('image'),
  handleUploadErrors,
  createCategory
);
router.put(
  '/:id',
  uploadSingle('image'),
  handleUploadErrors,
  updateCategory
);
router.delete('/:id', deleteCategory);

// Specialization routes
router.get('/:id/specializations', getCategorySpecializations);
router.post('/specializations', createSpecialization);
router.put('/specializations/:id', updateSpecialization);
router.delete('/specializations/:id', deleteSpecialization);

module.exports = router;