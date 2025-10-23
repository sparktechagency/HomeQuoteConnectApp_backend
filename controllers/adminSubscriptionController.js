// controllers/adminSubscriptionController.js
const Subscription = require('../models/Subscription');
const CreditPackage = require('../models/CreditPackage');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');

// @desc    Manage subscription plans
// @route   PUT /api/admin/subscriptions/plans
// @access  Private (Admin only)
const updateSubscriptionPlans = async (req, res) => {
  try {
    const { plans } = req.body; // Array of plan updates

    const results = await Promise.all(
      plans.map(async (plan) => {
        const { id, price, discount, isActive, isPopular } = plan;
        
        const updateData = {};
        if (price !== undefined) updateData.price = price;
        if (discount !== undefined) updateData.discount = discount;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isPopular !== undefined) updateData.isPopular = isPopular;

        return await Subscription.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
      })
    );

    res.status(200).json({
      success: true,
      message: 'Subscription plans updated successfully',
      data: { plans: results }
    });

  } catch (error) {
    console.error('Update subscription plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subscription plans',
      error: error.message
    });
  }
};

// @desc    Manage credit packages
// @route   PUT /api/admin/subscriptions/credit-packages
// @access  Private (Admin only)
const updateCreditPackages = async (req, res) => {
  try {
    const { packages } = req.body; // Array of package updates

    const results = await Promise.all(
      packages.map(async (pkg) => {
        const { id, price, discount, isActive, isPopular } = pkg;
        
        const updateData = {};
        if (price !== undefined) updateData.price = price;
        if (discount !== undefined) updateData.discount = discount;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isPopular !== undefined) updateData.isPopular = isPopular;

        return await CreditPackage.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
      })
    );

    res.status(200).json({
      success: true,
      message: 'Credit packages updated successfully',
      data: { packages: results }
    });

  } catch (error) {
    console.error('Update credit packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating credit packages',
      error: error.message
    });
  }
};

// @desc    Get subscription analytics
// @route   GET /api/admin/subscriptions/analytics
// @access  Private (Admin only)
const getSubscriptionAnalytics = async (req, res) => {
  try {
    const { period = 'this_month' } = req.query;

    const { startDate, endDate } = calculateDateRange(period);

    // Active subscriptions count by plan
    const subscriptionStats = await UserSubscription.aggregate([
      {
        $match: {
          status: 'active',
          endDate: { $gt: new Date() },
          startDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'subscription',
          foreignField: '_id',
          as: 'subscription'
        }
      },
      {
        $unwind: '$subscription'
      },
      {
        $group: {
          _id: '$subscription.type',
          count: { $sum: 1 },
          totalRevenue: {
            $sum: '$subscription.discountedPrice'
          }
        }
      }
    ]);

    // New subscriptions over time
    const newSubscriptions = await UserSubscription.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Total active subscribers
    const totalActiveSubscribers = await UserSubscription.countDocuments({
      status: 'active',
      endDate: { $gt: new Date() }
    });

    // Revenue from subscriptions
    const revenueStats = await UserSubscription.aggregate([
      {
        $match: {
          status: 'active',
          startDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'subscription',
          foreignField: '_id',
          as: 'subscription'
        }
      },
      {
        $unwind: '$subscription'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$subscription.discountedPrice' },
          avgRevenuePerUser: { $avg: '$subscription.discountedPrice' }
        }
      }
    ]);

    const revenue = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      avgRevenuePerUser: 0
    };

    res.status(200).json({
      success: true,
      data: {
        subscriptionStats,
        newSubscriptions,
        summary: {
          totalActiveSubscribers,
          totalRevenue: revenue.totalRevenue,
          avgRevenuePerUser: revenue.avgRevenuePerUser
        },
        period: {
          startDate,
          endDate
        }
      }
    });

  } catch (error) {
    console.error('Get subscription analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription analytics',
      error: error.message
    });
  }
};

// Helper function
const calculateDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'this_week':
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }

  return { startDate, endDate };
};

module.exports = {
  updateSubscriptionPlans,
  updateCreditPackages,
  getSubscriptionAnalytics
};