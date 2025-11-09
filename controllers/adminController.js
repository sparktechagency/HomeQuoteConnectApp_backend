// controllers/adminController.js
const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const SupportTicket = require('../models/SupportTicket');
const Category = require('../models/Category');

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access dashboard'
      });
    }

    const { period = 'this_month' } = req.query;

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period);

    // Basic counts
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ 
      status: { $in: ['pending', 'in_progress'] } 
    });

    // Revenue calculations
    const revenueStats = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const revenue = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      totalCommission: 0,
      transactionCount: 0
    };

    // User growth data for chart
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          clients: {
            $sum: { $cond: [{ $eq: ['$role', 'client'] }, 1, 0] }
          },
          providers: {
            $sum: { $cond: [{ $eq: ['$role', 'provider'] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Recent activities
    const recentUsers = await User.find()
      .select('fullName email profilePhoto role isBlocked createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentTransactions = await Transaction.find({ status: 'completed' })
      .populate('user', 'fullName')
      .populate('job', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalClients,
          totalProviders,
          totalJobs,
          activeJobs,
          totalRevenue: revenue.totalRevenue,
          totalCommission: revenue.totalCommission,
          completedTransactions: revenue.transactionCount
        },
        userGrowth,
        recent: {
          users: recentUsers,
          transactions: recentTransactions
        },
        period: {
          startDate,
          endDate
        }
      }
    });

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Get all users with filtering
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access user list'
      });
    }

    const { 
      page = 1, 
      limit = 10, 
      role, 
      search, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'blocked') filter.isBlocked = true;
    
    // Search filter
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(filter)
      .select('fullName email profilePhoto role isVerified isBlocked isOnline lastActive createdAt')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// @desc    Block/unblock user
// @route   PUT /api/admin/users/:id/block
// @access  Private (Admin only)
const toggleUserBlock = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can block users'
      });
    }

    const { id } = req.params;
    const { block } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Cannot block admins
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot block admin users'
      });
    }

    user.isBlocked = block;
    await user.save();

    // Notify user if they're online
    if (req.app.get('io')) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(req.app.get('io'), user._id, {
        type: block ? 'account_blocked' : 'account_unblocked',
        title: block ? 'Account Blocked' : 'Account Unblocked',
        message: block ? 
          'Your account has been blocked. Please contact support.' :
          'Your account has been unblocked. You can now use the platform again.'
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${block ? 'blocked' : 'unblocked'} successfully`,
      data: { user }
    });

  } catch (error) {
    console.error('Toggle user block error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
};

// @desc    Verify provider documents
// @route   PUT /api/admin/providers/:id/verify
// @access  Private (Admin only)
const verifyProvider = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can verify providers'
      });
    }

    const { id } = req.params;
    const { status, notes } = req.body; // 'verified' or 'rejected'

    const provider = await User.findOne({
      _id: id,
      role: 'provider'
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    if (status === 'verified') {
      provider.verificationStatus = 'verified';
      // Give 25 free credits upon verification
      provider.credits += 25;
      // Mark individual verification documents as approved if present
      if (provider.verificationDocuments) {
        if (provider.verificationDocuments.businessLicense) {
          provider.verificationDocuments.businessLicense.status = 'approved';
        }
        if (provider.verificationDocuments.certificate) {
          provider.verificationDocuments.certificate.status = 'approved';
        }
      }
    } else if (status === 'rejected') {
      provider.verificationStatus = 'rejected';
      // Mark documents as rejected when overall verification is rejected
      if (provider.verificationDocuments) {
        if (provider.verificationDocuments.businessLicense) {
          provider.verificationDocuments.businessLicense.status = 'rejected';
        }
        if (provider.verificationDocuments.certificate) {
          provider.verificationDocuments.certificate.status = 'rejected';
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use "verified" or "rejected"'
      });
    }

    await provider.save();

    // Notify provider
    if (req.app.get('io')) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(req.app.get('io'), provider._id, {
        type: status === 'verified' ? 'verification_approved' : 'verification_rejected',
        title: status === 'verified' ? 'Verification Approved' : 'Verification Rejected',
        message: status === 'verified' ?
          'Your provider verification has been approved! You received 25 free credits.' :
          `Your verification was rejected. ${notes || 'Please submit valid documents.'}`
      });
    }

    res.status(200).json({
      success: true,
      message: `Provider verification ${status} successfully`,
      data: { provider }
    });

  } catch (error) {
    console.error('Verify provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying provider',
      error: error.message
    });
  }
};

// Helper function to calculate date ranges
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
      startDate = new Date(0); // All time
      endDate = new Date();
  }

  return { startDate, endDate };
};

// (exports moved to the end after all function declarations)

// @desc    Get providers list with verification documents and basic info
// @route   GET /api/admin/providers
// @access  Private (Admin only)
const getProviders = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access providers list'
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      verificationStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { role: 'provider' };

    if (verificationStatus) filter.verificationStatus = verificationStatus;

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const providers = await User.find(filter)
      .select('fullName phoneNumber email businessName verificationDocuments verificationStatus profilePhoto createdAt')
      .sort(sortOptions)
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        providers,
        pagination: {
          current: parseInt(page, 10),
          pages: Math.ceil(total / parseInt(limit, 10)),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching providers',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  toggleUserBlock,
  verifyProvider,
  getProviders
};