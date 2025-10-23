// controllers/systemController.js
const mongoose = require('mongoose');
const os = require('os');

// @desc    System health check
// @route   GET /api/health
// @access  Public
const healthCheck = async (req, res) => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.loadavg(),
      database: 'Connected',
      services: {
        cloudinary: 'OK',
        stripe: 'OK',
        email: 'OK'
      }
    };

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      health.status = 'ERROR';
      health.database = 'Disconnected';
    }

    // Check Cloudinary (basic check)
    try {
      const { cloudinary } = require('../utils/cloudinary');
      await cloudinary.api.ping();
    } catch (error) {
      health.status = 'ERROR';
      health.services.cloudinary = 'Error: ' + error.message;
    }

    // Check Stripe (basic check)
    try {
      const { stripe } = require('../config/stripe');
      await stripe.accounts.list({ limit: 1 });
    } catch (error) {
      health.status = 'ERROR';
      health.services.stripe = 'Error: ' + error.message;
    }

    res.status(health.status === 'OK' ? 200 : 503).json({
      success: health.status === 'OK',
      data: health
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      message: 'Service Unavailable',
      error: error.message
    });
  }
};

// @desc    System statistics
// @route   GET /api/admin/system/stats
// @access  Private (Admin only)
const getSystemStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access system statistics'
      });
    }

    const User = require('../models/User');
    const Job = require('../models/Job');
    const Transaction = require('../models/Transaction');
    const SupportTicket = require('../models/SupportTicket');

    // Basic counts
    const [
      totalUsers,
      totalJobs,
      totalTransactions,
      activeJobs,
      pendingTickets
    ] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Transaction.countDocuments(),
      Job.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } })
    ]);

    // Revenue stats
    const revenueStats = await Transaction.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          todayRevenue: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);

    // System performance
    const systemStats = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    };

    // Database stats
    const dbStats = await mongoose.connection.db.stats();

    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalUsers,
          totalJobs,
          totalTransactions,
          activeJobs,
          pendingTickets
        },
        revenue: revenueStats.length > 0 ? revenueStats[0] : {
          totalRevenue: 0,
          totalCommission: 0,
          todayRevenue: 0
        },
        system: systemStats,
        database: {
          collections: dbStats.collections,
          objects: dbStats.objects,
          storageSize: dbStats.storageSize,
          indexSize: dbStats.indexSize
        }
      }
    });

  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system statistics',
      error: error.message
    });
  }
};

module.exports = {
  healthCheck,
  getSystemStats
};