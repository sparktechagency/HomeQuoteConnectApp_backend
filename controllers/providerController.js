// controllers/providerController.js
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Quote = require('../models/Quote');
const User = require('../models/User');
const Review = require('../models/Review');
const Wallet = require('../models/Wallet');

// @desc    Get nearby jobs for providers
// @route   GET /api/provider/nearby-jobs
// @access  Private (Providers only)
const getNearbyJobs = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access nearby jobs'
      });
    }

    const {
      latitude,
      longitude,
      radius = 20000, // 20km default
      serviceCategory,
      specializations,
      minPrice,
      maxPrice,
      urgency,
      page = 1,
      limit = 10
    } = req.query;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const coordinates = [parseFloat(longitude), parseFloat(latitude)];
    const radiusInRadians = parseFloat(radius) / 6371000; // Convert meters to radians

    // Build filter object
    const filter = {
      'location.coordinates': {
        $geoWithin: {
          $centerSphere: [coordinates, radiusInRadians]
        }
      },
      status: 'pending',
      expiresAt: { $gt: new Date() }
    };

    // Additional filters
    if (serviceCategory) {
      filter.serviceCategory = serviceCategory;
    }

    if (specializations) {
      const specArray = Array.isArray(specializations) ? specializations : specializations.split(',');
      filter.specializations = { $in: specArray };
    }

    if (minPrice || maxPrice) {
      filter['priceRange.from'] = {};
      if (minPrice) filter['priceRange.from'].$gte = parseInt(minPrice);
      if (maxPrice) filter['priceRange.from'].$lte = parseInt(maxPrice);
    }

    if (urgency) {
      filter.urgency = urgency;
    }

    // Exclude jobs where provider has already quoted
    const providerQuotes = await Quote.find({
      provider: req.user._id,
      status: { $in: ['pending', 'updated', 'accepted'] }
    }).select('job');

    const quotedJobIds = providerQuotes.map(quote => quote.job.toString());
    if (quotedJobIds.length > 0) {
      filter._id = { $nin: quotedJobIds };
    }

    const jobs = await Job.find(filter)
      .populate('client', 'fullName profilePhoto averageRating totalReviews')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title')
      .sort({ urgency: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        location: {
          coordinates,
          radius: parseInt(radius)
        }
      }
    });

  } catch (error) {
    console.error('Get nearby jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching nearby jobs',
      error: error.message
    });
  }
};

// @desc    Get provider's accepted jobs
// @route   GET /api/provider/accepted-jobs
// @access  Private (Providers only)
const getAcceptedJobs = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access accepted jobs'
      });
    }

    const { status = 'in_progress', page = 1, limit = 10 } = req.query;

    // Find quotes that are accepted and belong to this provider
    const quotes = await Quote.find({
      provider: req.user._id,
      status: 'accepted'
    }).select('job');

    const jobIds = quotes.map(quote => quote.job);

    const jobs = await Job.find({
      _id: { $in: jobIds },
      status: status
    })
    .populate('client', 'fullName profilePhoto email phoneNumber averageRating totalReviews')
    .populate('serviceCategory', 'title image')
    .populate('specializations', 'title')
    .populate('acceptedQuote')
    .sort({ updatedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Job.countDocuments({
      _id: { $in: jobIds },
      status: status
    });

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get accepted jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching accepted jobs',
      error: error.message
    });
  }
};

// @desc    Get today's jobs for provider
// @route   GET /api/provider/today-jobs
// @access  Private (Providers only)
const getTodayJobs = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access today\'s jobs'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find accepted quotes for today's jobs
    const quotes = await Quote.find({
      provider: req.user._id,
      status: 'accepted'
    }).select('job');

    const jobIds = quotes.map(quote => quote.job);

    const jobs = await Job.find({
      _id: { $in: jobIds },
      preferredDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'in_progress'
    })
    .populate('client', 'fullName profilePhoto email phoneNumber')
    .populate('serviceCategory', 'title image')
    .populate('acceptedQuote')
    .sort({ preferredTime: 1 });

    res.status(200).json({
      success: true,
      data: { jobs }
    });

  } catch (error) {
    console.error('Get today jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s jobs',
      error: error.message
    });
  }
};

// @desc    Mark job as completed (Provider)
// @route   PUT /api/provider/jobs/:id/complete
// @access  Private (Providers only)
const markJobAsComplete = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the job and verify provider has accepted quote
    const job = await Job.findOne({
      _id: id,
      status: 'in_progress'
    }).populate('acceptedQuote');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or not in progress'
      });
    }

    // Verify provider owns the accepted quote
    if (job.acceptedQuote.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to mark this job as complete'
      });
    }

    // Update job status
    job.status = 'completed';
    await job.save();

    // Notify client about job completion
    if (req.app.get('io')) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(req.app.get('io'), job.client, {
        type: 'job_completed',
        title: 'Job Completed',
        message: `Your job "${job.title}" has been marked as completed by the provider`,
        jobId: job._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job marked as completed successfully',
      data: { job }
    });

  } catch (error) {
    console.error('Mark job as complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking job as complete',
      error: error.message
    });
  }
};

// @desc    Get provider dashboard statistics
// @route   GET /api/provider/dashboard
// @access  Private (Providers only)
const getProviderDashboard = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access dashboard'
      });
    }

    const { period = 'this_month' } = req.query;

    // Calculate date ranges based on period
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
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(0); // Beginning of time
        endDate = new Date();
    }

    // Get accepted quotes in the period
    const acceptedQuotes = await Quote.find({
      provider: req.user._id,
      status: 'accepted',
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('job');

    // Calculate statistics
    const totalBookings = acceptedQuotes.length;
    const totalEarnings = acceptedQuotes.reduce((sum, quote) => sum + quote.price, 0);
    
    // Get previous period for trends
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    const timeDiff = endDate - startDate;
    prevStartDate.setTime(prevStartDate.getTime() - timeDiff);
    prevEndDate.setTime(prevEndDate.getTime() - timeDiff);

    const prevAcceptedQuotes = await Quote.find({
      provider: req.user._id,
      status: 'accepted',
      createdAt: { $gte: prevStartDate, $lte: prevEndDate }
    });

    const prevTotalBookings = prevAcceptedQuotes.length;
    const prevTotalEarnings = prevAcceptedQuotes.reduce((sum, quote) => sum + quote.price, 0);

    const bookingTrend = prevTotalBookings === 0 ? 100 : ((totalBookings - prevTotalBookings) / prevTotalBookings) * 100;
    const earningsTrend = prevTotalEarnings === 0 ? 100 : ((totalEarnings - prevTotalEarnings) / prevTotalEarnings) * 100;

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalBookings,
          totalEarnings,
          bookingTrend: Math.round(bookingTrend),
          earningsTrend: Math.round(earningsTrend),
          availableCredits: req.user.credits,
          averageRating: req.user.averageRating,
          totalCompletedJobs: req.user.totalCompletedJobs
        },
        period: {
          current: { startDate, endDate },
          previous: { startDate: prevStartDate, endDate: prevEndDate }
        }
      }
    });

  } catch (error) {
    console.error('Get provider dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
};
// @desc    Get public provider details (profile, ratings, recent jobs, stats)
// @route   GET /api/providers/:id
// @access  Public (some fields are admin/owner-only)
const getProviderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid provider id' });
    }

    const provider = await User.findById(id)
      .populate('specializations', 'title')
      .lean();

    if (!provider || provider.role !== 'provider') {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Recent reviews (last 5)
    const recentReviews = await Review.find({ reviewedUser: id, isActive: true, reviewType: 'client_to_provider' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('reviewer', 'fullName profilePhoto')
      .lean();

    // Quotes and recent jobs (find jobs related to this provider via quotes)
    const providerQuotes = await Quote.find({ provider: id }).select('job status price createdAt').lean();
    const jobIds = Array.from(new Set(providerQuotes.map(q => q.job && q.job.toString()).filter(Boolean)));

    const recentJobs = await Job.find({ _id: { $in: jobIds } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('client', 'fullName profilePhoto')
      .lean();

    // Acceptance rate
    const totalQuotes = await Quote.countDocuments({ provider: id });
    const acceptedQuotes = await Quote.countDocuments({ provider: id, status: 'accepted' });
    const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

    // Wallet summary (safe getter)
    let walletSummary = null;
    try {
      const wallet = await Wallet.getOrCreate(id);
      walletSummary = {
        availableBalance: wallet.availableBalance || 0,
        pendingBalance: wallet.pendingBalance || 0,
        totalEarned: wallet.totalEarned || 0,
        stripeAccountStatus: wallet.stripeAccountStatus || 'pending'
      };
    } catch (e) {
      // Non-fatal: wallet may not exist or fail; continue without it
      walletSummary = null;
    }

    // Compose response
    const result = {
      profile: {
        _id: provider._id,
        fullName: provider.fullName,
        businessName: provider.businessName,
        bio: provider.bio,
        profilePhoto: provider.profilePhoto,
        experienceLevel: provider.experienceLevel,
        specializations: provider.specializations || [],
        serviceAreas: provider.serviceAreas || [],
        workingHours: provider.workingHours || {},
        isVerified: provider.isVerified,
        verificationStatus: provider.verificationStatus,
        averageRating: provider.averageRating || 0,
        totalReviews: provider.totalReviews || 0,
        totalCompletedJobs: provider.totalCompletedJobs || 0,
        isOnline: provider.isOnline || false,
        lastActive: provider.lastActive,
        createdAt: provider.createdAt
      },
      recentReviews,
      recentJobs,
      acceptanceRate,
      wallet: walletSummary
    };

    // Hide sensitive fields unless requester is admin or the owner
    const isOwnerOrAdmin = req.user && (req.user.role === 'admin' || req.user._id.toString() === id.toString());

    if (isOwnerOrAdmin) {
      // attach contact & verification documents for owner/admin
      result.profile.email = provider.email;
      result.profile.phoneNumber = provider.phoneNumber;
      result.profile.verificationDocuments = provider.verificationDocuments || {};
      result.profile.subscription = provider.subscription || {};
      result.profile.credits = provider.credits || 0;
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Get provider details error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching provider details', error: error.message });
  }
};

module.exports = {
  getNearbyJobs,
  getAcceptedJobs,
  getTodayJobs,
  markJobAsComplete,
  getProviderDashboard,
  getProviderDetails
};

