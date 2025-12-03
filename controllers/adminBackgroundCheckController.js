// controllers/adminBackgroundCheckController.js
const BackgroundCheck = require('../models/BackgroundCheck');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');
const Notification = require('../models/Notification');

/**
 * @desc    Get all background checks with filters (Admin)
 * @route   GET /api/admin/background-checks
 * @access  Private (Admin only)
 */
const getAllBackgroundChecks = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 10,
      sortBy = '-submittedAt'
    } = req.query;

    // Build query
    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by provider name or email
    if (search) {
      const providers = await User.find({
        role: 'provider',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      query.provider = { $in: providers.map(p => p._id) };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const total = await BackgroundCheck.countDocuments(query);

    // Get background checks
    const backgroundChecks = await BackgroundCheck.find(query)
      .populate('provider', 'name email phone photo businessName')
      .populate('reviewedBy', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate pagination data
    const totalPages = Math.ceil(total / parseInt(limit));

    return successResponse(res, {
      backgroundChecks,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    }, 'Background checks retrieved successfully');
  } catch (error) {
    console.error('Error getting background checks:', error);
    return errorResponse(res, error.message || 'Error retrieving background checks');
  }
};

/**
 * @desc    Get single background check details (Admin)
 * @route   GET /api/admin/background-checks/:id
 * @access  Private (Admin only)
 */
const getBackgroundCheckById = async (req, res) => {
  try {
    const { id } = req.params;

    const backgroundCheck = await BackgroundCheck.findById(id)
      .populate('provider', 'name email phone photo businessName address certifications specializations')
      .populate('reviewedBy', 'name email')
      .lean();

    if (!backgroundCheck) {
      return errorResponse(res, 'Background check not found', 404);
    }

    return successResponse(res, backgroundCheck, 'Background check details retrieved successfully');
  } catch (error) {
    console.error('Error getting background check details:', error);
    return errorResponse(res, error.message || 'Error retrieving background check details');
  }
};

/**
 * @desc    Approve background check (Admin)
 * @route   PUT /api/admin/background-checks/:id/approve
 * @access  Private (Admin only)
 */
const approveBackgroundCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;
    const adminId = req.user.id;

    const backgroundCheck = await BackgroundCheck.findById(id);

    if (!backgroundCheck) {
      return errorResponse(res, 'Background check not found', 404);
    }

    if (backgroundCheck.status === 'approved') {
      return errorResponse(res, 'Background check is already approved', 400);
    }

    // Update background check
    backgroundCheck.status = 'approved';
    backgroundCheck.reviewedBy = adminId;
    backgroundCheck.reviewedAt = new Date();
    backgroundCheck.reviewNotes = reviewNotes || '';
    backgroundCheck.rejectionReason = null;

    await backgroundCheck.save();

    // Update provider's background check status
    await User.findByIdAndUpdate(backgroundCheck.provider, {
      backgroundCheckStatus: 'approved',
      backgroundCheckApprovedAt: new Date()
    });

    // Populate for response
    const populatedCheck = await BackgroundCheck.findById(backgroundCheck._id)
      .populate('provider', 'name email phone photo')
      .populate('reviewedBy', 'name email')
      .lean();

    // Notify provider
    try {
      const provider = await User.findById(backgroundCheck.provider);
      const admin = await User.findById(adminId);
      const io = req.app.get('io');

      const notification = await Notification.create({
        user: provider._id,
        title: 'Background Check Approved',
        message: 'Congratulations! Your background check has been approved. You can now receive job requests.',
        type: 'background_check',
        data: {
          backgroundCheckId: backgroundCheck._id,
          status: 'approved',
          reviewedBy: admin.name
        }
      });

      // Send real-time notification
      if (io) {
        io.to(`user_${provider._id}`).emit('notification', notification);
      }
    } catch (error) {
      console.error('Error sending provider notification:', error);
      // Continue even if notification fails
    }

    return successResponse(res, populatedCheck, 'Background check approved successfully');
  } catch (error) {
    console.error('Error approving background check:', error);
    return errorResponse(res, error.message || 'Error approving background check');
  }
};

/**
 * @desc    Reject background check (Admin)
 * @route   PUT /api/admin/background-checks/:id/reject
 * @access  Private (Admin only)
 */
const rejectBackgroundCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, reviewNotes } = req.body;
    const adminId = req.user.id;

    if (!rejectionReason) {
      return errorResponse(res, 'Please provide a reason for rejection', 400);
    }

    const backgroundCheck = await BackgroundCheck.findById(id);

    if (!backgroundCheck) {
      return errorResponse(res, 'Background check not found', 404);
    }

    // if (backgroundCheck.status === 'approved') {
    //   return errorResponse(res, 'Cannot reject an approved background check', 400);
    // }

    // Update background check
    backgroundCheck.status = 'rejected';
    backgroundCheck.reviewedBy = adminId;
    backgroundCheck.reviewedAt = new Date();
    backgroundCheck.reviewNotes = reviewNotes || '';
    backgroundCheck.rejectionReason = rejectionReason;

    await backgroundCheck.save();

    // Update provider's background check status
    await User.findByIdAndUpdate(backgroundCheck.provider, {
      backgroundCheckStatus: 'rejected'
    });

    // Populate for response
    const populatedCheck = await BackgroundCheck.findById(backgroundCheck._id)
      .populate('provider', 'name email phone photo')
      .populate('reviewedBy', 'name email')
      .lean();

    // Notify provider
    try {
      const provider = await User.findById(backgroundCheck.provider);
      const admin = await User.findById(adminId);
      const io = req.app.get('io');

      const notification = await Notification.create({
        user: provider._id,
        title: 'Background Check Rejected',
        message: `Your background check has been rejected. Reason: ${rejectionReason}`,
        type: 'background_check',
        data: {
          backgroundCheckId: backgroundCheck._id,
          status: 'rejected',
          rejectionReason,
          reviewedBy: admin.name
        }
      });

      // Send real-time notification
      if (io) {
        io.to(`user_${provider._id}`).emit('notification', notification);
      }
    } catch (error) {
      console.error('Error sending provider notification:', error);
      // Continue even if notification fails
    }

    return successResponse(res, populatedCheck, 'Background check rejected');
  } catch (error) {
    console.error('Error rejecting background check:', error);
    return errorResponse(res, error.message || 'Error rejecting background check');
  }
};

/**
 * @desc    Request resubmission of background check (Admin)
 * @route   PUT /api/admin/background-checks/:id/request-resubmission
 * @access  Private (Admin only)
 */
const requestResubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, reviewNotes } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return errorResponse(res, 'Please provide a reason for resubmission request', 400);
    }

    const backgroundCheck = await BackgroundCheck.findById(id);

    if (!backgroundCheck) {
      return errorResponse(res, 'Background check not found', 404);
    }

    if (backgroundCheck.status === 'approved') {
      return errorResponse(res, 'Cannot request resubmission for approved background check', 400);
    }

    // Update background check
    backgroundCheck.status = 'resubmission_required';
    backgroundCheck.reviewedBy = adminId;
    backgroundCheck.reviewedAt = new Date();
    backgroundCheck.reviewNotes = reviewNotes || '';
    backgroundCheck.rejectionReason = reason;

    await backgroundCheck.save();

    // Populate for response
    const populatedCheck = await BackgroundCheck.findById(backgroundCheck._id)
      .populate('provider', 'name email phone photo')
      .populate('reviewedBy', 'name email')
      .lean();

    // Notify provider
    try {
      const provider = await User.findById(backgroundCheck.provider);
      const admin = await User.findById(adminId);
      const io = req.app.get('io');

      const notification = await Notification.create({
        user: provider._id,
        title: 'Background Check - Resubmission Required',
        message: `Please resubmit your background check documents. Reason: ${reason}`,
        type: 'background_check',
        data: {
          backgroundCheckId: backgroundCheck._id,
          status: 'resubmission_required',
          reason,
          reviewedBy: admin.name
        }
      });

      // Send real-time notification
      if (io) {
        io.to(`user_${provider._id}`).emit('notification', notification);
      }
    } catch (error) {
      console.error('Error sending provider notification:', error);
      // Continue even if notification fails
    }

    return successResponse(res, populatedCheck, 'Resubmission requested successfully');
  } catch (error) {
    console.error('Error requesting resubmission:', error);
    return errorResponse(res, error.message || 'Error requesting resubmission');
  }
};

/**
 * @desc    Get background check statistics (Admin)
 * @route   GET /api/admin/background-checks/stats
 * @access  Private (Admin only)
 */
const getBackgroundCheckStats = async (req, res) => {
  try {
    const stats = await BackgroundCheck.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      resubmission_required: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    // Get recent submissions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await BackgroundCheck.countDocuments({
      submittedAt: { $gte: sevenDaysAgo }
    });

    formattedStats.recentSubmissions = recentSubmissions;

    return successResponse(res, formattedStats, 'Background check statistics retrieved successfully');
  } catch (error) {
    console.error('Error getting background check stats:', error);
    return errorResponse(res, error.message || 'Error retrieving statistics');
  }
};

module.exports = {
  getAllBackgroundChecks,
  getBackgroundCheckById,
  approveBackgroundCheck,
  rejectBackgroundCheck,
  requestResubmission,
  getBackgroundCheckStats
};
