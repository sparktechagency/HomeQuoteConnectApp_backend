// controllers/popularController.js
const { getPopularProviders } = require('../utils/popularProviders');
const User = require('../models/User');
const Job = require('../models/Job');
const Review = require('../models/Review');

// @desc    Get popular service providers
// @route   GET /api/popular/providers
// @access  Public
const getPopularServiceProviders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      serviceCategory,
      specializations,
      minRating = 4,
      maxDistance,
      latitude,
      longitude,
      experienceLevel,
      sortBy = 'popularity'
    } = req.query;

    const result = await getPopularProviders({
      page: parseInt(page),
      limit: parseInt(limit),
      serviceCategory,
      specializations,
      minRating: parseFloat(minRating),
      maxDistance: maxDistance ? parseInt(maxDistance) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      experienceLevel,
      sortBy
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get popular providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular providers',
      error: error.message
    });
  }
};

// @desc    Get provider details for booking
// @route   GET /api/popular/providers/:id
// @access  Public
const getProviderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await User.findOne({
      _id: id,
      role: 'provider',
      verificationStatus: 'verified',
      isBlocked: false
    })
    .select('fullName profilePhoto businessName bio experienceLevel specializations serviceAreas workingHours averageRating totalReviews totalCompletedJobs verificationStatus location credits isOnline lastActive')
    .populate('specializations', 'title category');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Get recent reviews
    const reviews = await Review.find({
      reviewedUser: provider._id,
      reviewType: 'client_to_provider'
    })
    .populate('reviewer', 'fullName profilePhoto')
    .populate('job', 'title serviceCategory')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get portfolio/gallery images from ProjectGallery model
    const ProjectGallery = require('../models/ProjectGallery');
    const portfolio = await ProjectGallery.find({
      provider: provider._id,
      isActive: true,
      isPublic: true
    })
    .select('title description images featured projectDate createdAt location budget clientName clientRating')
    .sort({ featured: -1, createdAt: -1 })
    .lean();

    // Optionally include gallery stats
    const galleryStats = await ProjectGallery.getProviderStats(provider._id);

    // Get provider statistics
    const totalJobs = await Job.countDocuments({
      'acceptedQuote.provider': provider._id,
      status: 'completed'
    });

    const responseRate = await calculateResponseRate(provider._id);

    res.status(200).json({
      success: true,
      data: {
        provider: {
          ...provider.toObject(),
          totalJobs,
          responseRate,
          galleryStats
        },
        reviews,
        portfolio
      }
    });

  } catch (error) {
    console.error('Get provider details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching provider details',
      error: error.message
    });
  }
};

// @desc    Book provider directly
// @route   POST /api/popular/providers/:id/book
// @access  Private (Clients only)
const bookProviderDirectly = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can book providers directly'
      });
    }

    const { id } = req.params;
    const {
      title,
      description,
      serviceCategory,
      specializations,
      location,
      urgency,
      preferredDate,
      preferredTime,
      priceRange,
      specificInstructions
    } = req.body;

    // Verify provider exists and is available
    const provider = await User.findOne({
      _id: id,
      role: 'provider',
      verificationStatus: 'verified',
      isBlocked: false
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found or unavailable'
      });
    }

    // Create job with direct provider assignment
    const Job = require('../models/Job');
    const jobData = {
      title,
      description: specificInstructions || description,
      client: req.user._id,
      serviceCategory,
        provider: id,   //  FIX ADDED HERE

      specializations: Array.isArray(specializations) ? specializations : JSON.parse(specializations || '[]'),
      location: typeof location === 'string' ? JSON.parse(location) : location,
      urgency,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      preferredTime,
      priceRange: typeof priceRange === 'string' ? JSON.parse(priceRange) : priceRange,
      status: 'pending'
    };

    // Upload photos if provided
    if (req.files && req.files.length > 0) {
      const { uploadMultipleImages } = require('../utils/fileUtils');
      jobData.photos = await uploadMultipleImages(req.files);
    }

    const job = await Job.create(jobData);

    // Create direct quote from provider
    const Quote = require('../models/Quote');
    const quote = await Quote.create({
      job: job._id,
      provider: id,
      price: priceRange && priceRange.isPersonalized ? 0 : (priceRange?.from || 0),
      description: 'Direct booking - quote to be provided',
      // Description: 'Direct booking - quote to be provided',
      status: 'pending'
    });

    // Update job with the quote
    job.quotes = [quote._id];
    await job.save();

    // Notify provider about direct booking
    if (req.app.get('io')) {
      const { sendNotification } = require('../socket/notificationHandler');
      sendNotification(req.app.get('io'), provider._id, {
        type: 'direct_booking',
        title: 'Direct Booking Request',
        message: `You have received a direct booking request for "${title}"`,
        jobId: job._id,
        clientName: req.user.fullName
      });
    }

    // Populate job for response
    const populatedJob = await Job.findById(job._id)
      .populate('client', 'fullName profilePhoto email phoneNumber')
      .populate('provider', 'fullName email phoneNumber profilePhoto rating skills experience')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title category')
      .populate('quotes');

    res.status(201).json({
      success: true,
      message: 'Provider booked successfully. They will send you a quote shortly.',
      data: { job: populatedJob }
    });

  } catch (error) {
    console.error('Book provider directly error:', error);
    res.status(500).json({
      success: false,
      message: 'Error booking provider',
      error: error.message
    });
  }
};

// Helper function to calculate response rate
const calculateResponseRate = async (providerId) => {
  const Quote = require('../models/Quote');
  
  const totalQuotes = await Quote.countDocuments({ provider: providerId });
  const acceptedQuotes = await Quote.countDocuments({ 
    provider: providerId, 
    status: 'accepted' 
  });
  
  if (totalQuotes === 0) return 0;
  return Math.round((acceptedQuotes / totalQuotes) * 100);
};

module.exports = {
  getPopularServiceProviders,
  getProviderDetails,
  bookProviderDirectly
};