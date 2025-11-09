// controllers/adminSubscriptionController.js
const Subscription = require('../models/Subscription');
const CreditPackage = require('../models/CreditPackage');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const { success, error } = require('../utils/response');

// @desc    Get all subscriptions with user details
// @route   GET /api/admin/subscriptions
// @access  Private/Admin
const getSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    // Filter by status if provided
    if (status && ['active', 'expired', 'cancelled', 'pending'].includes(status)) {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get subscriptions with populated user and subscription plan details
    const subscriptions = await UserSubscription.find(query)
      .populate({
        path: 'user',
        select: 'name email role profilePhoto',
        match: search ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        } : {}
      })
      .populate('subscription', 'name type description price duration quoteLimit')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Filter out subscriptions where user is null (due to search match)
    const filteredSubscriptions = subscriptions.filter(sub => sub.user);

    // Get total count for pagination
    const totalSubscriptions = await UserSubscription.countDocuments(query);

    // Format the response data
    const formattedSubscriptions = filteredSubscriptions.map(subscription => ({
      id: subscription._id,
      userName: subscription.user.name,
      profilePhoto: subscription.user.profilePhoto,
      userEmail: subscription.user.email,
      planName: subscription.subscription.name,
      planDescription: subscription.subscription.description,
      price: subscription.subscription.price,
      type: subscription.subscription.type,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      quotesUsed: subscription.quotesUsed,
      quoteLimit: subscription.subscription.quoteLimit,
      autoRenew: subscription.autoRenew,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    }));

    return success(res, {
      subscriptions: formattedSubscriptions,
      currentPage: page,
      totalPages: Math.ceil(totalSubscriptions / limit),
      totalSubscriptions,
      hasMore: page * limit < totalSubscriptions
    });
  } catch (err) {
    console.error('Error in getSubscriptions:', err);
    return error(res, 'Failed to fetch subscriptions', 500);
  }
};

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

// exports will be appended after all functions are defined

// @desc    Get credit activities (purchases) with user details
// @route   GET /api/admin/credits
// @access  Private (Admin only)
const getCredits = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type = 'purchase', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (type) query.type = type; // purchase, refund, bonus, etc.

    // Build search on user name or email
    let aggregate = [];

    // Match activity type
    aggregate.push({ $match: query });

    // Lookup user
    aggregate.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    });
    aggregate.push({ $unwind: '$user' });

    // Optionally filter by search term
    if (search) {
      const regex = new RegExp(search, 'i');
      aggregate.push({
        $match: {
          $or: [
            { 'user.fullName': regex },
            { 'user.email': regex }
          ]
        }
      });
    }

    // Lookup reference (if any)
    aggregate.push({
      $lookup: {
        from: 'creditpackages',
        localField: 'referenceId',
        foreignField: '_id',
        as: 'creditPackage'
      }
    });

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    aggregate.push({ $sort: sort });

    // Pagination
    aggregate.push({ $skip: (page - 1) * limit });
    aggregate.push({ $limit: parseInt(limit, 10) });

    // Project fields
    aggregate.push({
      $project: {
        _id: 1,
        creditChange: 1,
        newBalance: 1,
        type: 1,
        description: 1,
        metadata: 1,
        createdAt: 1,
        user: { _id: '$user._id', fullName: '$user.fullName', email: '$user.email', profilePhoto: '$user.profilePhoto', role: '$user.role' },
        creditPackage: { $arrayElemAt: ['$creditPackage', 0] }
      }
    });

    const CreditActivity = require('../models/CreditActivity');
    const results = await CreditActivity.aggregate(aggregate);

    // Count total for pagination (respecting initial query and search)
    const countAgg = [];
    countAgg.push({ $match: query });
    countAgg.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    });
    countAgg.push({ $unwind: '$user' });
    if (search) {
      const regex = new RegExp(search, 'i');
      countAgg.push({
        $match: {
          $or: [
            { 'user.fullName': regex },
            { 'user.email': regex }
          ]
        }
      });
    }
    countAgg.push({ $count: 'total' });

    const countRes = await CreditActivity.aggregate(countAgg);
    const total = countRes[0] ? countRes[0].total : 0;

    return success(res, {
      credits: results,
      pagination: { current: parseInt(page, 10), pages: Math.ceil(total / limit), total }
    });
  } catch (err) {
    console.error('Error in getCredits:', err);
    return error(res, 'Failed to fetch credit activities', 500);
  }
};

module.exports = {
  getSubscriptions,
  getCredits,
  updateSubscriptionPlans,
  updateCreditPackages,
  getSubscriptionAnalytics
};