// controllers/reviewController.js
const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Submit a review
// @route   POST /api/reviews
// @access  Private
const submitReview = async (req, res) => {
  try {
    const { jobId, rating, comment, reviewType } = req.body;

    // Validate job exists and user is involved
    const job = await Job.findOne({
      _id: jobId,
      status: 'completed'
    }).populate('client acceptedQuote');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or not completed'
      });
    }

    // Determine reviewed user based on review type
    let reviewedUser;
    if (reviewType === 'client_to_provider') {
      if (job.client._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only the client can review the provider'
        });
      }
      reviewedUser = job.acceptedQuote.provider;
    } else if (reviewType === 'provider_to_client') {
      if (job.acceptedQuote.provider.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only the provider can review the client'
        });
      }
      reviewedUser = job.client._id;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid review type'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      job: jobId,
      reviewer: req.user._id,
      reviewType
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this job'
      });
    }

    // Verify payment was completed
    const transaction = await Transaction.findOne({
      job: jobId,
      status: 'completed'
    });

    if (!transaction) {
      return res.status(400).json({
        success: false,
        message: 'Cannot review job that has not been paid for'
      });
    }

    // Create review
    const review = await Review.create({
      job: jobId,
      reviewer: req.user._id,
      reviewedUser,
      rating,
      comment,
      reviewType
    });

    // Populate review
    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'fullName profilePhoto')
      .populate('reviewedUser', 'fullName profilePhoto');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review: populatedReview }
    });

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting review',
      error: error.message
    });
  }
};

// @desc    Get reviews for a user
// @route   GET /api/reviews/user/:userId
// @access  Public
const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, reviewType } = req.query;

    const filter = { 
      reviewedUser: userId,
      isActive: true
    };

    if (reviewType) {
      filter.reviewType = reviewType;
    }

    const reviews = await Review.find(filter)
      .populate('reviewer', 'fullName profilePhoto')
      .populate('job', 'title serviceCategory')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    // Get average rating
    const ratingStats = await Review.aggregate([
      {
        $match: filter
      },
      {
        $group: {
          _id: '$reviewedUser',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const stats = ratingStats.length > 0 ? ratingStats[0] : {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: []
    };

    // Calculate rating distribution
    const distribution = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: stats.ratingDistribution ? stats.ratingDistribution.filter(r => r === star).length : 0
    }));

    res.status(200).json({
      success: true,
      data: {
        reviews,
        statistics: {
          averageRating: Math.round(stats.averageRating * 10) / 10 || 0,
          totalReviews: stats.totalReviews || 0,
          distribution
        },
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// @desc    Respond to a review
// @route   PUT /api/reviews/:id/respond
// @access  Private
const respondToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    const review = await Review.findOne({
      _id: id,
      reviewedUser: req.user._id
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you are not authorized to respond'
      });
    }

    review.response = {
      comment: response,
      respondedAt: new Date()
    };

    await review.save();

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: { review }
    });

  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding response',
      error: error.message
    });
  }
};

// @desc    Get user's pending reviews
// @route   GET /api/reviews/pending
// @access  Private
const getPendingReviews = async (req, res) => {
  try {
    // Find completed jobs that don't have reviews from this user
    const completedJobs = await Job.find({
      $or: [
        { client: req.user._id, status: 'completed' }, // User is client
        { 'acceptedQuote.provider': req.user._id, status: 'completed' } // User is provider
      ]
    })
    .populate('client', 'fullName profilePhoto')
    .populate('acceptedQuote')
    .populate('serviceCategory', 'title');

    const jobsWithReviewStatus = await Promise.all(
      completedJobs.map(async (job) => {
        const reviewType = job.client._id.toString() === req.user._id.toString() 
          ? 'client_to_provider' 
          : 'provider_to_client';

        const existingReview = await Review.findOne({
          job: job._id,
          reviewer: req.user._id,
          reviewType
        });

        return {
          job,
          canReview: !existingReview,
          reviewType,
          existingReview
        };
      })
    );

    const pendingReviews = jobsWithReviewStatus.filter(item => item.canReview);

    res.status(200).json({
      success: true,
      data: { pendingReviews }
    });

  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending reviews',
      error: error.message
    });
  }
};

module.exports = {
  submitReview,
  getUserReviews,
  respondToReview,
  getPendingReviews
};