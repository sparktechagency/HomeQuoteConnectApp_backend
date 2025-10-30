const Category = require('../models/Category');
const Specialization = require('../models/Specialization');
const Job = require('../models/Job');

// @desc    Public - Get active categories with optional search and stats
// @route   GET /api/categories
// @access  Public
const getPublicCategories = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const categories = await Category.find(filter)
      .sort({ popularity: -1, createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    const total = await Category.countDocuments(filter);

    // Attach simple stats for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const jobCount = await Job.countDocuments({
          serviceCategory: category._id,
          status: { $in: ['pending', 'in_progress'] }
        });

        const specializationIds = await Specialization.find({ category: category._id }).select('_id');
        const providerCount = await require('../models/User').countDocuments({
          role: 'provider',
          specializations: { $in: specializationIds }
        });

        return {
          ...category.toObject(),
          stats: {
            jobCount,
            providerCount,
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
          current: parseInt(page, 10),
          pages: Math.ceil(total / parseInt(limit, 10)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get public categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// @desc    Public - Get specializations for a given category
// @route   GET /api/categories/:id/specializations
// @access  Public
const getPublicCategorySpecializations = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;

    // Only filter by active specializations and optional search
    const filter = { isActive: true };
    if (search) filter.title = { $regex: search, $options: 'i' };

    const specializations = await Specialization.find(filter)
      .sort({ title: 1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    const total = await Specialization.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        specializations,
        pagination: {
          current: parseInt(page, 10),
          pages: Math.ceil(total / parseInt(limit, 10)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching specializations',
      error: error.message
    });
  }
};

module.exports = {
  getPublicCategories,
  getPublicCategorySpecializations
};
