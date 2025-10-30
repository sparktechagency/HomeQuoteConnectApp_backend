// controllers/adminCategoryController.js
const Category = require('../models/Category');
const Specialization = require('../models/Specialization');
const Job = require('../models/Job');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// @desc    Get all categories with specializations
// @route   GET /api/admin/categories
// @access  Private (Admin only)
const getCategories = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const categories = await Category.find(filter)
      .populate('createdBy', 'fullName')
      .populate('specializationsCount')
      .sort({ popularity: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Category.countDocuments(filter);

    // Get job counts for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const jobCount = await Job.countDocuments({ 
          serviceCategory: category._id,
          status: { $in: ['pending', 'in_progress'] }
        });

        const activeProviders = await require('../models/User').countDocuments({
          role: 'provider',
          specializations: { $in: await Specialization.find({ category: category._id }).select('_id') }
        });

        return {
          ...category.toObject(),
          stats: {
            jobCount,
            activeProviders,
            popularity: category.popularity
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithStats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// @desc    Create new category
// @route   POST /api/admin/categories
// @access  Private (Admin only)
const createCategory = async (req, res) => {
  try {
    const { title, description } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      title: { $regex: new RegExp(`^${title}$`, 'i') } 
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this title already exists'
      });
    }

    let image = {};
    
    // Upload category image if provided
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        'raza-home-quote/categories'
      );
      image = {
        public_id: result.public_id,
        url: result.secure_url
      };
    }

    const category = await Category.create({
      title,
      description,
      image,
      createdBy: req.user._id
    });

    const populatedCategory = await Category.findById(category._id)
      .populate('createdBy', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category: populatedCategory }
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if title is being changed and if it already exists
    if (title && title !== category.title) {
      const existingCategory = await Category.findOne({ 
        title: { $regex: new RegExp(`^${title}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this title already exists'
        });
      }
      category.title = title;
    }

    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    // Update image if provided
    if (req.file) {
      // Delete old image
      if (category.image && category.image.public_id) {
        await deleteFromCloudinary(category.image.public_id);
      }

      // Upload new image
      const result = await uploadToCloudinary(
        req.file.buffer,
        'raza-home-quote/categories'
      );
      category.image = {
        public_id: result.public_id,
        url: result.secure_url
      };
    }

    await category.save();

    const populatedCategory = await Category.findById(category._id)
      .populate('createdBy', 'fullName')
      .populate('specializationsCount');

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category: populatedCategory }
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private (Admin only)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has associated jobs
    const jobCount = await Job.countDocuments({ serviceCategory: id });
    if (jobCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${jobCount} associated jobs.`
      });
    }

    // Check if category has specializations
    const specializationCount = await Specialization.countDocuments({ category: id });
    if (specializationCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${specializationCount} associated specializations.`
      });
    }

    // Delete category image from Cloudinary
    if (category.image && category.image.public_id) {
      await deleteFromCloudinary(category.image.public_id);
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};


const getCategorySpecializations = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search, isActive } = req.query;

    const filter = { category: id };
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const specializations = await Specialization.find(filter)
      .populate('category', 'title')
      .populate('createdBy', 'fullName')
      .sort({ title: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Specialization.countDocuments(filter);

    // Get provider counts for each specialization
    const specializationsWithStats = await Promise.all(
      specializations.map(async (spec) => {
        const providerCount = await require('../models/User').countDocuments({
          role: 'provider',
          specializations: spec._id
        });

        return {
          ...spec.toObject(),
          providerCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        specializations: specializationsWithStats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get category specializations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching specializations',
      error: error.message
    });
  }
};

// @desc    Create specialization
// @route   POST /api/admin/specializations
// @access  Private (Admin only)
const createSpecialization = async (req, res) => {
  try {
    const { title, description, categoryId } = req.body;

    // Check if specialization already exists in this category
    const existingSpecialization = await Specialization.findOne({
      title: { $regex: new RegExp(`^${title}$`, 'i') },
      category: categoryId
    });

    if (existingSpecialization) {
      return res.status(400).json({
        success: false,
        message: 'Specialization with this title already exists in this category'
      });
    }

    const specialization = await Specialization.create({
      title,
      description,
      category: categoryId,
      createdBy: req.user._id
    });

    const populatedSpecialization = await Specialization.findById(specialization._id)
      .populate('category', 'title')
      .populate('createdBy', 'fullName');

    res.status(201).json({
      success: true,
      message: 'Specialization created successfully',
      data: { specialization: populatedSpecialization }
    });

  } catch (error) {
    console.error('Create specialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating specialization',
      error: error.message
    });
  }
};

// @desc    Update specialization
// @route   PUT /api/admin/specializations/:id
// @access  Private (Admin only)
const updateSpecialization = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isActive, categoryId } = req.body;

    const specialization = await Specialization.findById(id);
    if (!specialization) {
      return res.status(404).json({
        success: false,
        message: 'Specialization not found'
      });
    }

    // Check if title is being changed and if it already exists in the category
    if (title && title !== specialization.title) {
      const existingSpecialization = await Specialization.findOne({
        title: { $regex: new RegExp(`^${title}$`, 'i') },
        category: categoryId || specialization.category,
        _id: { $ne: id }
      });

      if (existingSpecialization) {
        return res.status(400).json({
          success: false,
          message: 'Specialization with this title already exists in this category'
        });
      }
      specialization.title = title;
    }

    if (description !== undefined) specialization.description = description;
    if (isActive !== undefined) specialization.isActive = isActive;
    if (categoryId) specialization.category = categoryId;

    await specialization.save();

    const populatedSpecialization = await Specialization.findById(specialization._id)
      .populate('category', 'title')
      .populate('createdBy', 'fullName');

    res.status(200).json({
      success: true,
      message: 'Specialization updated successfully',
      data: { specialization: populatedSpecialization }
    });

  } catch (error) {
    console.error('Update specialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating specialization',
      error: error.message
    });
  }
};

// @desc    Delete specialization
// @route   DELETE /api/admin/specializations/:id
// @access  Private (Admin only)
const deleteSpecialization = async (req, res) => {
  try {
    const { id } = req.params;

    const specialization = await Specialization.findById(id);
    if (!specialization) {
      return res.status(404).json({
        success: false,
        message: 'Specialization not found'
      });
    }

    // Check if specialization has associated providers
    const providerCount = await require('../models/User').countDocuments({
      role: 'provider',
      specializations: id
    });

    if (providerCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete specialization. It has ${providerCount} associated providers.`
      });
    }

    await Specialization.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Specialization deleted successfully'
    });

  } catch (error) {
    console.error('Delete specialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting specialization',
      error: error.message
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategorySpecializations,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization
};