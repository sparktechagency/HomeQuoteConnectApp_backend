const express = require('express');
const {
  getPublicCategories,
  getPublicCategorySpecializations
} = require('../../controllers/categoryController');

const router = express.Router();

// Public category routes
router.get('/', getPublicCategories);
router.get('/specializations', getPublicCategorySpecializations);

module.exports = router;
