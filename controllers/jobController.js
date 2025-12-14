// controllers/jobController.js
const Job = require('../models/Job');
const Quote = require('../models/Quote');
const Category = require('../models/Category');
const User = require('../models/User');
const Review = require('../models/Review');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const { uploadMultipleImages } = require('../utils/fileUtils');
const { sendNotification } = require('../socket/notificationHandler');

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

    // Parse location safely
    let locationData;
    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'Location is required'
      });
    }

    if (typeof location === 'string') {
      try {
        locationData = JSON.parse(location);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location format. Must be JSON object.'
        });
      }
    } else if (typeof location === 'object') {
      locationData = location;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid location data type'
      });
    }

    // Validate coordinates
    if (
      !locationData.coordinates ||
      !Array.isArray(locationData.coordinates) ||
      locationData.coordinates.length !== 2
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates are required [longitude, latitude]'
      });
    }

    // Ensure address is a string
    if (typeof locationData.address !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Location address must be a string'
      });
    }

    // Create job data
    const jobData = {
      title,
      description: specificInstructions || description,
      client: req.user._id,
      serviceCategory,
      specializations: Array.isArray(specializations)
        ? specializations
        : JSON.parse(specializations || '[]'),
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
    await Category.findByIdAndUpdate(serviceCategory, { $inc: { popularity: 1 } });

    // Notify nearby providers (socket)
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
  const filter = {
      status: 'pending',
      $or: [
        { isDirectBooking: false },          // normal public jobs
        { provider: req.user._id }           // direct booking only for assigned provider
      ]
    };


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

    // Location-based filter using $geoWithin
    if (latitude && longitude) {
      const earthRadiusInMeters = 6378137;
      const radiusInMeters = parseInt(radius);
      filter['location'] = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(longitude), parseFloat(latitude)],
            radiusInMeters / earthRadiusInMeters
          ]
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
// @access  Public
const getTodayJobs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build query based on authentication status
    const query = {
      preferredDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'pending'
    };

    // If user is authenticated, show both public jobs and their direct jobs
    // If not authenticated, only show public jobs
    if (req.user && req.user._id) {
      query.$or = [
        { isDirectBooking: false },       // visible to all
        { provider: req.user._id }        // direct job only for assigned provider
      ];
    } else {
      query.isDirectBooking = false;     // only public jobs for unauthenticated users
    }

    const jobs = await Job.find(query)
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
// @access  Public
const getActiveJobs = async (req, res) => {
  try {
    // Build query based on authentication status
    const query = {
      status: { $in: ['pending', 'in_progress'] },
      expiresAt: { $gt: new Date() }
    };

    // If user is authenticated, show both public jobs and their direct jobs
    // If not authenticated, only show public jobs
    if (req.user && req.user._id) {
      query.$or = [
        { isDirectBooking: false },       // anyone can see
        { provider: req.user._id }        // direct job only visible to assigned provider
      ];
    } else {
      query.isDirectBooking = false;     // only public jobs for unauthenticated users
    }

    const jobs = await Job.find(query)
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
          select: [
            'fullName',
            'profilePhoto',
            'businessName',
            'averageRating',
            'totalReviews',
            'experienceLevel',
            'specializations',
            'credits',
            'subscription',
            'verificationStatus',
            'serviceAreas',
            'workingHours',
            'location',
            'bio'
          ].join(' ')
          ,
          populate: {
            path: 'specializations',
            select: 'title category'
          }
        }
      })
      .populate({
        path: 'acceptedQuote',
        populate: {
          path: 'provider',
          select: [
            'fullName',
            'profilePhoto',
            'businessName',
            'averageRating',
            'totalReviews',
            'experienceLevel',
            'specializations',
            'credits',
            'subscription',
            'verificationStatus',
            'serviceAreas',
            'workingHours',
            'location',
            'bio'
          ].join(' '),
          populate: {
            path: 'specializations',
            select: 'title category'
          }
        }
      })
      .populate('acceptedQuote'); // keep original populate if acceptedQuote has other fields to populate


    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // ❗ Siecurity check for direct booking jobs
    // if (job.isDirectBooking === true && job.provider?.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'You are not allowed to view this job'
    //   });
    // }

    // Increment view count
    job.viewCount += 1;
    await job.save();

    // Fetch reviews for this job
    const Review = require('../models/Review');
    
    // Client to Provider review
    const clientToProviderReview = await Review.findOne({
      job: job._id,
      reviewType: 'client_to_provider'
    })
      .populate('reviewer', 'fullName profilePhoto')
      .populate('reviewedUser', 'fullName profilePhoto businessName')
      .lean();

    // Provider to Client review
    const providerToClientReview = await Review.findOne({
      job: job._id,
      reviewType: 'provider_to_client'
    })
      .populate('reviewer', 'fullName profilePhoto businessName')
      .populate('reviewedUser', 'fullName profilePhoto')
      .lean();

    res.status(200).json({
      success: true,
      data: { 
        job,
        reviews: {
          client_to_provider: clientToProviderReview || null,
          provider_to_client: providerToClientReview || null
        }
      }
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
      .populate('client', 'fullName email phone profilePhoto')
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

    // Fetch reviews for each job
    const jobsWithReviews = await Promise.all(
      jobs.map(async (job) => {
        const jobObj = job.toObject();



        // Get client_to_provider review (client reviewing the provider)
        const clientToProviderReview = await Review.findOne({
          job: job._id,
          reviewType: 'client_to_provider',
          reviewer: req.user._id
        })
          .populate('reviewedUser', 'fullName profilePhoto businessName')
          .lean();

        // Get provider_to_client review (provider reviewing the client)
        const providerToClientReview = await Review.findOne({
          job: job._id,
          reviewType: 'provider_to_client',
          reviewedUser: req.user._id
        })
          .populate('reviewer', 'fullName profilePhoto businessName')
          .lean();

        return {
          ...jobObj,
          reviews: {
            client_to_provider: clientToProviderReview || null,
            provider_to_client: providerToClientReview || null
          }
        };
      })
    );

    // Filter out jobs with no valid quotes (price > 0)
    const validJobs = jobsWithReviews.filter(job => job !== null);

    // Update total count to reflect filtered jobs
    const totalValidJobs = validJobs.length;

    res.status(200).json({
      success: true,
      data: {
        jobs: validJobs,
        pagination: {
          current: page,
          pages: Math.ceil(totalValidJobs / limit),
          total: totalValidJobs
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

   if (!['pending', 'in_progress'].includes(job.status)) {
  return res.status(400).json({
    success: false,
    message: 'You can only cancel jobs that are pending or in progress'
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
          sendNotification(req.app.get('io'), quote.provider._id, {
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

// exports moved to bottom to include functions defined later

// @desc    Update a job
// @route   PUT /api/jobs/:id
// @access  Private (Client only)
const updateJob = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can update jobs' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    // Don't allow edits if a provider has been accepted
    if (job.acceptedQuote) {
      return res.status(400).json({ success: false, message: 'Cannot edit job after a provider has been accepted' });
    }

    if (job.status && job.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending jobs can be edited' });
    }

    // Safely read fields from req.body
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
    } = req.body || {};

    // Update text fields
    if (title !== undefined) job.title = title;
    if (description !== undefined || specificInstructions !== undefined) {
      job.description = specificInstructions || description || job.description;
    }
    if (serviceCategory !== undefined) job.serviceCategory = serviceCategory;
    if (specializations !== undefined) {
      job.specializations = Array.isArray(specializations) 
        ? specializations 
        : JSON.parse(specializations || '[]');
    }
    if (urgency !== undefined) job.urgency = urgency;
    if (preferredDate !== undefined) {
      job.preferredDate = preferredDate ? new Date(preferredDate) : undefined;
    }
    if (preferredTime !== undefined) job.preferredTime = preferredTime;
    if (priceRange !== undefined) {
      job.priceRange = typeof priceRange === 'string' ? JSON.parse(priceRange) : priceRange;
    }

    // Handle location
    if (location !== undefined) {
      let locationData;
      if (typeof location === 'string') {
        try {
          locationData = JSON.parse(location);
        } catch (err) {
          return res.status(400).json({ success: false, message: 'Invalid location format. Must be JSON object.' });
        }
      } else if (typeof location === 'object' && location !== null) {
        locationData = location;
      }

      if (locationData) {
        if (!locationData.coordinates || !Array.isArray(locationData.coordinates) || locationData.coordinates.length !== 2) {
          return res.status(400).json({ success: false, message: 'Valid coordinates are required [longitude, latitude]' });
        }
        if (typeof locationData.address !== 'string') {
          return res.status(400).json({ success: false, message: 'Location address must be a string' });
        }
        job.location = locationData;
      }
    }

    // === KEY CHANGE: REPLACE photos instead of appending ===
    if (req.files && req.files.length > 0) {
      // Upload new images
      const uploaded = await uploadMultipleImages(req.files);

      // Optional: Delete old images from cloud/storage (e.g., Cloudinary, AWS S3)
      if (job.photos && job.photos.length > 0) {
        for (const photoUrl of job.photos) {
          try {
            const publicId = extractPublicIdFromUrl(photoUrl); // You need to implement this based on your storage
            await deleteImageFromCloud(publicId); // e.g., cloudinary.uploader.destroy(publicId)
          } catch (err) {
            console.warn('Failed to delete old image:', photoUrl, err);
            // Don't fail the whole request if deletion fails
          }
        }
      }

      // Replace with new images only
      job.photos = uploaded;
    }
    // If no files uploaded → keep existing photos (or you can clear them if needed)

    await job.save();

    const populatedJob = await Job.findById(job._id)
      .populate('client', 'fullName profilePhoto email phoneNumber')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title category')
      .populate('quotes')
      .populate('acceptedQuote');

    // Notify providers who quoted
    if (job.quotes && job.quotes.length > 0 && req.app.get('io')) {
      const quotes = await Quote.find({ job: job._id }).populate('provider');
      quotes.forEach(q => {
        sendNotification(req.app.get('io'), q.provider._id, {
          type: 'job_updated',
          title: 'Job Updated',
          message: `Job "${job.title}" has been updated by the client.`,
          jobId: job._id
        });
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: { job: populatedJob }
    });

  } catch (error) {
    console.error('Update job error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating job',
      error: error.message
    });
  }
};

// @desc    Delete a job
// @route   DELETE /api/jobs/:id
// @access  Private (Client only)
const deleteJob = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can delete jobs' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    if (job.acceptedQuote) {
      return res.status(400).json({ success: false, message: 'Cannot delete job after a provider has been accepted' });
    }

    if (job.status && job.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending jobs can be deleted' });
    }

    // Delete photos from cloudinary if any
    if (job.photos && job.photos.length > 0) {
      const publicIds = job.photos.map(p => p.public_id).filter(Boolean);
      const { deleteMultipleFiles } = require('../utils/fileUtils');
      if (publicIds.length > 0) {
        try {
          await deleteMultipleFiles(publicIds);
        } catch (err) {
          console.error('Failed to delete job photos from Cloudinary:', err.message);
        }
      }
    }

  // Remove associated quotes
  await Quote.deleteMany({ job: job._id });

  // Delete the job document (use model method to avoid issues if job is a plain object)
  await Job.findByIdAndDelete(job._id);

    res.status(200).json({ success: true, message: 'Job deleted successfully' });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ success: false, message: 'Error deleting job', error: error.message });
  }
};

  // @desc    Get invoice for completed job
// @route   GET /api/jobs/:id/invoice
// @access  Private (Client or Provider)
const getJobInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the job
    const job = await Job.findById(id)
      .populate('client', 'fullName email phoneNumber location')
      .populate('provider', 'fullName email phoneNumber location businessName')
      .populate('acceptedQuote')
      .populate('serviceCategory', 'title');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Verify user is either client or provider
    const isClient = job.client._id.toString() === req.user._id.toString();
    const isProvider = job.provider && job.provider._id.toString() === req.user._id.toString();

    if (!isClient && !isProvider) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this invoice'
      });
    }

    // Check if job is completed
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Invoice can only be generated for completed jobs'
      });
    }

    // Validate accepted quote exists
    if (!job.acceptedQuote) {
      return res.status(400).json({
        success: false,
        message: 'No accepted quote found for this job'
      });
    }

    // Validate provider exists
    if (!job.provider) {
      return res.status(400).json({
        success: false,
        message: 'No provider assigned to this job'
      });
    }

    // Find the transaction for this job
    const transaction = await Transaction.findOne({
      job: job._id,
      status: 'completed'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'No completed transaction found for this job'
      });
    }

    // Check if invoice already exists
    let invoice = await Invoice.findOne({ job: job._id })
      .populate('provider', 'fullName email phoneNumber location businessName')
      .populate('client', 'fullName email phoneNumber location')
      .populate('job', 'title description location')
      .populate('quote', 'price description');

    // If invoice doesn't exist, create it
    if (!invoice) {
      invoice = await Invoice.create({
        job: job._id,
        quote: job.acceptedQuote._id,
        transaction: transaction._id,
        provider: job.provider._id,
        client: job.client._id,
        pricing: {
          subtotal: transaction.amount,
          platformCommission: transaction.platformCommission,
          platformCommissionRate: transaction.platformCommission / transaction.amount,
          total: transaction.providerAmount
        },
        payment: {
          paidAmount: transaction.amount,
          paymentMethod: transaction.paymentMethod,
          paymentStatus: transaction.status,
          paidAt: transaction.paidAt || transaction.completedAt
        },
        issuedDate: new Date(),
        status: 'paid'
      });

      // Populate the newly created invoice
      invoice = await Invoice.findById(invoice._id)
        .populate('provider', 'fullName email phoneNumber location businessName')
        .populate('client', 'fullName email phoneNumber location')
        .populate('job', 'title description location')
        .populate('quote', 'price description');
    }

    // Build invoice response
    const invoiceData = {
      invoiceId: invoice.invoiceId,
      issuedDate: invoice.issuedDate,
      
      // Service Provider Information
      serviceProvider: {
        name: invoice.provider?.businessName || invoice.provider?.fullName || 'N/A',
        fullName: invoice.provider?.fullName || 'N/A',
        email: invoice.provider?.email || 'N/A',
        phoneNumber: invoice.provider?.phoneNumber || 'N/A',
        address: invoice.provider?.location?.address || 
                 `${invoice.provider?.location?.city || ''}, ${invoice.provider?.location?.state || ''}, ${invoice.provider?.location?.zipCode || ''}`.trim() || 'N/A'
      },
      
      // Customer Information
      customer: {
        name: invoice.client?.fullName || 'N/A',
        email: invoice.client?.email || 'N/A',
        phoneNumber: invoice.client?.phoneNumber || 'N/A',
        address: invoice.client?.location?.address || 
                 `${invoice.client?.location?.city || ''}, ${invoice.client?.location?.state || ''}, ${invoice.client?.location?.zipCode || ''}`.trim() || 'N/A'
      },
      
      // Job Information
      jobDetails: {
        jobTitle: invoice.job?.title || job.title || 'N/A',
        jobDescription: invoice.job?.description || job.description || 'N/A',
        jobLocation: invoice.job?.location?.address || job.location?.address ||
                    `${invoice.job?.location?.details?.completeAddress || job.location?.details?.completeAddress || ''}, ${invoice.job?.location?.details?.city || job.location?.details?.city || ''}, ${invoice.job?.location?.details?.state || job.location?.details?.state || ''}`.trim() || 'N/A',
        serviceCategory: job.serviceCategory?.title || 'N/A'
      },
      
      // Pricing Breakdown
      pricing: {
        subtotal: invoice.pricing.subtotal,
        platformCommission: invoice.pricing.platformCommission,
        platformCommissionRate: `${(invoice.pricing.platformCommissionRate * 100).toFixed(0)}%`,
        total: invoice.pricing.total
      },
      
      // Payment Information
      payment: {
        paidAmount: invoice.payment.paidAmount,
        paymentMethod: invoice.payment.paymentMethod,
        paymentStatus: invoice.payment.paymentStatus,
        paidAt: invoice.payment.paidAt
      },
      
      // Metadata
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Invoice retrieved successfully',
      data: invoiceData
    });

  } catch (error) {
    console.error('Get job invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving invoice',
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
    getJobsByCategory,
    updateJob,
    deleteJob,
    getJobInvoice
  };
