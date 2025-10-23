// controllers/jobController.js
const Job = require('../models/Job');
const Quote = require('../models/Quote');
const Category = require('../models/Category');
const User = require('../models/User');
const { uploadMultipleImages } = require('../utils/fileUtils');
const { sendNotificationToUser } = require('../socket/socketHandler');

// @desc    Create a new job post
// @route   POST /api/jobs
// @access  Private (Clients only)
const createJob = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can create job posts'
      });
    }

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

    // Parse location data
    let locationData;
    try {
      locationData = typeof location === 'string' ? JSON.parse(location) : location;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location data format'
      });
    }

    // Validate coordinates
    if (!locationData.coordinates || !Array.isArray(locationData.coordinates) || locationData.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates are required [longitude, latitude]'
      });
    }

    // Create job data
    const jobData = {
      title,
      description: specificInstructions || description,
      client: req.user._id,
      serviceCategory,
      specializations: Array.isArray(specializations) ? specializations : JSON.parse(specializations || '[]'),
      location: locationData,
      urgency,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      preferredTime,
      priceRange: typeof priceRange === 'string' ? JSON.parse(priceRange) : priceRange
    };

    // Upload photos if provided
    if (req.files && req.files.length > 0) {
      jobData.photos = await uploadMultipleImages(req.files);
    }

    const job = await Job.create(jobData);

    // Populate the created job
    const populatedJob = await Job.findById(job._id)
      .populate('client', 'fullName profilePhoto email phoneNumber')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title category');

    // Update category popularity
    await Category.findByIdAndUpdate(serviceCategory, {
      $inc: { popularity: 1 }
    });

    // Notify nearby providers (socket implementation)
    if (req.app.get('io')) {
      req.app.get('io').emit('new-job-available', {
        job: populatedJob,
        location: jobData.location
      });
    }

    res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      data: { job: populatedJob }
    });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating job post',
      error: error.message
    });
  }
};

// @desc    Get all jobs with filtering and pagination
// @route   GET /api/jobs
// @access  Private
const getJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      serviceType,
      urgency,
      minPrice,
      maxPrice,
      rating,
      experienceLevel,
      specializations,
      availability,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      latitude,
      longitude,
      radius = 20000 // 20km default
    } = req.query;

    // Build filter object
    const filter = { status: 'pending' };

    // Service type filter
    if (serviceType) {
      filter.serviceCategory = serviceType;
    }

    // Urgency filter
    if (urgency) {
      filter.urgency = urgency;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter['priceRange.from'] = {};
      if (minPrice) filter['priceRange.from'].$gte = parseInt(minPrice);
      if (maxPrice) filter['priceRange.from'].$lte = parseInt(maxPrice);
    }

    // Specializations filter
    if (specializations) {
      const specArray = Array.isArray(specializations) ? specializations : specializations.split(',');
      filter.specializations = { $in: specArray };
    }

    // Search filter
    if (search) {
      filter.$text = { $search: search };
    }

    // Location-based filter
    if (latitude && longitude) {
      filter['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius)
        }
      };
    }

    // Availability filter (based on preferred date)
    if (availability) {
      const today = new Date();
      switch (availability) {
        case 'today':
          filter.preferredDate = {
            $gte: new Date(today.setHours(0, 0, 0, 0)),
            $lt: new Date(today.setHours(23, 59, 59, 999))
          };
          break;
        case 'this_week':
          const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          filter.preferredDate = {
            $gte: startOfWeek,
            $lte: endOfWeek
          };
          break;
        case 'next_week':
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          const endNextWeek = new Date(nextWeek);
          endNextWeek.setDate(endNextWeek.getDate() + 6);
          filter.preferredDate = {
            $gte: nextWeek,
            $lte: endNextWeek
          };
          break;
      }
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const jobs = await Job.find(filter)
      .populate('client', 'fullName profilePhoto email phoneNumber averageRating totalReviews')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title category')
      .populate('quotes')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Job.countDocuments(filter);

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
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      error: error.message
    });
  }
};

// @desc    Get today's jobs
// @route   GET /api/jobs/today
// @access  Private
const getTodayJobs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const jobs = await Job.find({
      preferredDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'pending'
    })
    .populate('client', 'fullName profilePhoto email phoneNumber')
    .populate('serviceCategory', 'title image')
    .populate('specializations', 'title category')
    .sort({ createdAt: -1 })
    .limit(50);

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

// @desc    Get active jobs
// @route   GET /api/jobs/active
// @access  Private
const getActiveJobs = async (req, res) => {
  try {
    const jobs = await Job.find({
      status: { $in: ['pending', 'in_progress'] },
      expiresAt: { $gt: new Date() }
    })
    .populate('client', 'fullName profilePhoto email phoneNumber')
    .populate('serviceCategory', 'title image')
    .populate('specializations', 'title category')
    .populate('quotes')
    .sort({ urgency: 1, createdAt: -1 })
    .limit(100);

    res.status(200).json({
      success: true,
      data: { jobs }
    });

  } catch (error) {
    console.error('Get active jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active jobs',
      error: error.message
    });
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Private
const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'fullName profilePhoto email phoneNumber averageRating totalReviews')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title category')
      .populate({
        path: 'quotes',
        populate: {
          path: 'provider',
          select: 'fullName profilePhoto businessName averageRating totalReviews experienceLevel specializations'
        }
      })
      .populate('acceptedQuote');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Increment view count
    job.viewCount += 1;
    await job.save();

    res.status(200).json({
      success: true,
      data: { job }
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching job',
      error: error.message
    });
  }
};

// @desc    Get client's jobs
// @route   GET /api/jobs/my-jobs
// @access  Private (Clients only)
const getMyJobs = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can access their jobs'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filter = { client: req.user._id };
    if (status) filter.status = status;

    const jobs = await Job.find(filter)
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title category')
      .populate({
        path: 'quotes',
        populate: {
          path: 'provider',
          select: 'fullName profilePhoto businessName averageRating totalReviews experienceLevel'
        }
      })
      .populate('acceptedQuote')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Job.countDocuments(filter);

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
    console.error('Get my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your jobs',
      error: error.message
    });
  }
};

// @desc    Cancel a job
// @route   PUT /api/jobs/:id/cancel
// @access  Private (Client only)
const cancelJob = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const job = await Job.findOne({
      _id: req.params.id,
      client: req.user._id
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you are not authorized to cancel this job'
      });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel job that is already in progress or completed'
      });
    }

    job.status = 'cancelled';
    job.cancellationReason = cancellationReason;
    await job.save();

    // Notify providers who quoted on this job
    if (job.quotes.length > 0) {
      const quotes = await Quote.find({ job: job._id }).populate('provider');
      
      quotes.forEach(quote => {
        if (req.app.get('io')) {
          sendNotificationToUser(req.app.get('io'), quote.provider._id, {
            type: 'job_cancelled',
            title: 'Job Cancelled',
            message: `Job "${job.title}" has been cancelled by the client`,
            jobId: job._id,
            reason: cancellationReason
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job cancelled successfully',
      data: { job }
    });

  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling job',
      error: error.message
    });
  }
};

// @desc    Get popular service categories
// @route   GET /api/jobs/popular-categories
// @access  Public
const getPopularCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ popularity: -1 })
      .limit(10)
      .populate('specializationsCount');

    res.status(200).json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    console.error('Get popular categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular categories',
      error: error.message
    });
  }
};

// @desc    Get jobs by category
// @route   GET /api/jobs/category/:categoryId
// @access  Private
const getJobsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const jobs = await Job.find({
      serviceCategory: categoryId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
    .populate('client', 'fullName profilePhoto email phoneNumber')
    .populate('serviceCategory', 'title image')
    .populate('specializations', 'title category')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Job.countDocuments({
      serviceCategory: categoryId,
      status: 'pending'
    });

    const category = await Category.findById(categoryId);

    res.status(200).json({
      success: true,
      data: {
        category,
        jobs,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get jobs by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs by category',
      error: error.message
    });
  }
};

module.exports = {
  createJob,
  getJobs,
  getTodayJobs,
  getActiveJobs,
  getJob,
  getMyJobs,
  cancelJob,
  getPopularCategories,
  getJobsByCategory
};