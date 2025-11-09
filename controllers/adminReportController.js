// controllers/adminReportController.js
const Report = require('../models/Report');
const User = require('../models/User');
const Job = require('../models/Job');
const Review = require('../models/Review');
const { sendAdminNotification } = require('./adminNotificationController');

// @desc    Get all reports with filtering
// @route   GET /api/admin/reports
// @access  Private (Admin only)
const getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      reportType,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (reportType) filter.reportType = reportType;
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    // Search filter (reporter name or reason)
    if (search) {
      const users = await User.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      filter.$or = [
        { reportedBy: { $in: userIds } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reports = await Report.find(filter)
      .populate('reportedBy', 'fullName profilePhoto email phoneNumber')
      .populate('reportedUser', 'fullName profilePhoto email role')
      .populate('reportedJob', 'title')
      .populate('reportedReview', 'rating comment')
      .populate('resolvedBy', 'fullName profilePhoto')
      .populate('adminNotes.admin', 'fullName profilePhoto')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(filter);

    // Get report statistics
    const stats = await Report.getReportStats();

    res.status(200).json({
      success: true,
      data: {
        reports,
        statistics: stats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
};

// @desc    Get report details
// @route   GET /api/admin/reports/:id
// @access  Private (Admin only)
const getReportDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id)
      .populate('reportedBy', 'fullName profilePhoto email phoneNumber createdAt')
      .populate('reportedUser', 'fullName profilePhoto email role verificationStatus isBlocked')
      .populate('reportedJob', 'title description photos client serviceCategory')
      .populate('reportedReview', 'rating comment reviewer reviewedUser')
      .populate('resolvedBy', 'fullName profilePhoto')
      .populate('adminNotes.admin', 'fullName profilePhoto');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Get additional context based on report type
    let context = {};
    if (report.reportedUser) {
      const userStats = await User.findById(report.reportedUser).select(
        'totalCompletedJobs averageRating totalReviews isBlocked verificationStatus'
      );
      context.userStats = userStats;
    }

    if (report.reportedJob) {
      const job = await Job.findById(report.reportedJob)
        .populate('client', 'fullName profilePhoto')
        .populate('serviceCategory', 'title');
      context.jobDetails = job;
    }

    res.status(200).json({
      success: true,
      data: {
        report,
        context
      }
    });

  } catch (error) {
    console.error('Get report details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report details',
      error: error.message
    });
  }
};

// @desc    Add admin note to report
// @route   POST /api/admin/reports/:id/notes
// @access  Private (Admin only)
const addReportNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await report.addAdminNote(req.user._id, note);

    const updatedReport = await Report.findById(id)
      .populate('adminNotes.admin', 'fullName profilePhoto');

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: { 
        report: updatedReport,
        newNote: updatedReport.adminNotes[updatedReport.adminNotes.length - 1]
      }
    });

  } catch (error) {
    console.error('Add report note error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding note to report',
      error: error.message
    });
  }
};

// @desc    Resolve report
// @route   PUT /api/admin/reports/:id/resolve
// @access  Private (Admin only)
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes, duration } = req.body;

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (report.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Report is already resolved'
      });
    }

    const resolutionData = {
      action,
      notes,
      ...(duration && { duration })
    };

    await report.resolveReport(req.user._id, resolutionData);

    // Take action based on resolution
    await handleReportAction(report, action, req.user._id);

    const resolvedReport = await Report.findById(id)
      .populate('reportedBy', 'fullName email')
      .populate('reportedUser', 'fullName email')
      .populate('resolvedBy', 'fullName profilePhoto');

    // Send notification to reporter
    if (req.app.get('io')) {
      const { sendNotification } = require('../socket/notificationHandler');
      await sendNotification(req.app.get('io'), report.reportedBy, {
        type: 'report_resolved',
        title: 'Report Resolved',
        message: `Your report has been resolved. Action taken: ${action}`,
        data: {
          reportId: report._id,
          action: action
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Report resolved successfully',
      data: { report: resolvedReport }
    });

  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving report',
      error: error.message
    });
  }
};

// @desc    Update report status
// @route   PUT /api/admin/reports/:id/status
// @access  Private (Admin only)
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (status) report.status = status;
    if (priority) report.priority = priority;
    
    report.updatedAt = new Date();
    await report.save();

    const updatedReport = await Report.findById(id)
      .populate('reportedBy', 'fullName profilePhoto')
      .populate('reportedUser', 'fullName profilePhoto');

    res.status(200).json({
      success: true,
      message: 'Report status updated successfully',
      data: { report: updatedReport }
    });

  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating report status',
      error: error.message
    });
  }
};

// @desc    Get report statistics
// @route   GET /api/admin/reports/statistics
// @access  Private (Admin only)
const getReportStatistics = async (req, res) => {
  try {
    const { period = 'this_month' } = req.query;

    const { startDate, endDate } = calculateDateRange(period);

    const stats = await Report.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            status: '$status',
            type: '$reportType'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.status',
          byType: {
            $push: {
              type: '$_id.type',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      }
    ]);

    const resolutionStats = await Report.aggregate([
      {
        $match: {
          status: 'resolved',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$resolution.action',
          count: { $sum: 1 }
        }
      }
    ]);

    const timelineStats = await Report.aggregate([
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

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats,
        byResolution: resolutionStats,
        timeline: timelineStats,
        period: {
          startDate,
          endDate
        }
      }
    });

  } catch (error) {
    console.error('Get report statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report statistics',
      error: error.message
    });
  }
};

// Helper function to handle report actions
const handleReportAction = async (report, action, adminId) => {
  switch (action) {
    case 'warning':
      // Send warning to reported user
      if (report.reportedUser) {
        await User.findByIdAndUpdate(report.reportedUser, {
          $inc: { 'stats.warnings': 1 }
        });
      }
      break;
      
    case 'suspension':
      // Suspend user account
      if (report.reportedUser) {
        await User.findByIdAndUpdate(report.reportedUser, {
          isBlocked: true,
          blockedUntil: calculateBlockUntil(report.resolution.duration)
        });
      }
      break;
      
    case 'ban':
      // Permanently ban user
      if (report.reportedUser) {
        await User.findByIdAndUpdate(report.reportedUser, {
          isBlocked: true,
          permanentlyBanned: true
        });
      }
      break;
      
    case 'content_removal':
      // Remove reported content
      if (report.reportedJob) {
        await Job.findByIdAndUpdate(report.reportedJob, { isActive: false });
      }
      if (report.reportedReview) {
        await Review.findByIdAndUpdate(report.reportedReview, { isActive: false });
      }
      break;
      
    case 'payment_refund':
      // Process refund (would integrate with payment system)
      console.log('Payment refund action required for report:', report._id);
      break;
      
    default:
      break;
  }
};

// Helper function to calculate block until date
const calculateBlockUntil = (duration) => {
  if (!duration) return null;
  
  const blockUntil = new Date();
  switch (duration.unit) {
    case 'hours':
      blockUntil.setHours(blockUntil.getHours() + duration.value);
      break;
    case 'days':
      blockUntil.setDate(blockUntil.getDate() + duration.value);
      break;
    case 'weeks':
      blockUntil.setDate(blockUntil.getDate() + (duration.value * 7));
      break;
    case 'months':
      blockUntil.setMonth(blockUntil.getMonth() + duration.value);
      break;
  }
  
  return blockUntil;
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
      startDate = new Date(0);
      endDate = new Date();
  }

  return { startDate, endDate };
};

module.exports = {
  getReports,
  getReportDetails,
  addReportNote,
  resolveReport,
  updateReportStatus,
  getReportStatistics
};