// controllers/reportController.js
const Report = require('../models/Report');
const User = require('../models/User');
const Job = require('../models/Job');
const Review = require('../models/Review');
const { sendAdminNotification } = require('./adminNotificationController');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @desc    Submit a report
// @route   POST /api/reports
// @access  Private
const submitReport = async (req, res) => {
  try {
    const {
      reportType,
      reason,
      description,
      reportedUserId,
      reportedJobId,
      reportedReviewId,
      priority = 'medium'
    } = req.body;

    // Validate required fields
    if (!reportType || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'Report type, reason, and description are required'
      });
    }

    // Validate report type
    const validReportTypes = ['user', 'job', 'review', 'message', 'payment', 'other'];
    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    // Validate that the reported entity exists
    let reportedEntity = null;
    let reportedUser = null;

    switch (reportType) {
      case 'user':
        if (!reportedUserId) {
          return res.status(400).json({
            success: false,
            message: 'Reported user ID is required for user reports'
          });
        }
        reportedUser = await User.findById(reportedUserId);
        if (!reportedUser) {
          return res.status(404).json({
            success: false,
            message: 'Reported user not found'
          });
        }
        // Users cannot report themselves
        if (reportedUserId === req.user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'You cannot report yourself'
          });
        }
        break;

      case 'job':
        if (!reportedJobId) {
          return res.status(400).json({
            success: false,
            message: 'Reported job ID is required for job reports'
          });
        }
        reportedEntity = await Job.findById(reportedJobId);
        if (!reportedEntity) {
          return res.status(404).json({
            success: false,
            message: 'Reported job not found'
          });
        }
        break;

      case 'review':
        if (!reportedReviewId) {
          return res.status(400).json({
            success: false,
            message: 'Reported review ID is required for review reports'
          });
        }
        reportedEntity = await Review.findById(reportedReviewId);
        if (!reportedEntity) {
          return res.status(404).json({
            success: false,
            message: 'Reported review not found'
          });
        }
        break;

      default:
        break;
    }

    // Check if user has already reported this entity recently (prevent spam)
    const recentReport = await Report.findOne({
      reportedBy: req.user._id,
      ...(reportedUserId && { reportedUser: reportedUserId }),
      ...(reportedJobId && { reportedJob: reportedJobId }),
      ...(reportedReviewId && { reportedReview: reportedReviewId }),
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    if (recentReport) {
      return res.status(429).json({
        success: false,
        message: 'You have already reported this recently. Please wait 24 hours before reporting again.'
      });
    }

    // Handle evidence uploads
    let evidence = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        const result = await uploadToCloudinary(
          file.buffer,
          'raza-home-quote/reports'
        );
        return {
          type: file.mimetype.startsWith('image/') ? 'image' : 'document',
          public_id: result.public_id,
          url: result.secure_url,
          filename: file.originalname,
          description: ''
        };
      });

      evidence = await Promise.all(uploadPromises);
    }

    // Create the report
    const report = await Report.create({
      reportType,
      reason,
      description,
      reportedBy: req.user._id,
      reportedUser: reportedUserId,
      reportedJob: reportedJobId,
      reportedReview: reportedReviewId,
      evidence,
      priority,
      status: 'pending'
    });

    // Populate the report for response
    const populatedReport = await Report.findById(report._id)
      .populate('reportedBy', 'fullName profilePhoto email')
      .populate('reportedUser', 'fullName profilePhoto email role')
      .populate('reportedJob', 'title')
      .populate('reportedReview', 'rating comment');

    // Send real-time notification to admins
    if (req.app.get('io')) {
      await sendAdminNotification(req.app.get('io'), {
        type: 'new_report_submitted',
        title: 'New Report Submitted',
        message: `New ${reportType} report: ${reason}`,
        data: {
          reportId: report._id,
          reportType: reportType,
          priority: priority,
          reportedBy: req.user.fullName
        },
        category: 'report',
        priority: priority
      });
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our team will review it shortly.',
      data: { report: populatedReport }
    });

  } catch (error) {
    console.error('Submit report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting report',
      error: error.message
    });
  }
};

// @desc    Get my submitted reports
// @route   GET /api/reports/my-reports
// @access  Private
const getMyReports = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      reportType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { reportedBy: req.user._id };
    
    if (status) filter.status = status;
    if (reportType) filter.reportType = reportType;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reports = await Report.find(filter)
      .populate('reportedUser', 'fullName profilePhoto email role')
      .populate('reportedJob', 'title serviceCategory')
      .populate('reportedReview', 'rating comment')
      .populate('resolvedBy', 'fullName profilePhoto')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(filter);

    // Get report statistics for the user
    const stats = await Report.aggregate([
      {
        $match: { reportedBy: req.user._id }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

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
    console.error('Get my reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your reports',
      error: error.message
    });
  }
};

// @desc    Get report details
// @route   GET /api/reports/:id
// @access  Private
const getReportDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findOne({
      _id: id,
      reportedBy: req.user._id
    })
    .populate('reportedBy', 'fullName profilePhoto email')
    .populate('reportedUser', 'fullName profilePhoto email role')
    .populate('reportedJob', 'title description photos client serviceCategory')
    .populate('reportedReview', 'rating comment reviewer reviewedUser')
    .populate('resolvedBy', 'fullName profilePhoto')
    .populate('adminNotes.admin', 'fullName profilePhoto');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: { report }
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

// @desc    Add evidence to existing report
// @route   POST /api/reports/:id/evidence
// @access  Private
const addReportEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    const report = await Report.findOne({
      _id: id,
      reportedBy: req.user._id,
      status: 'pending' // Can only add evidence to pending reports
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found, or you cannot add evidence to this report'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one file as evidence'
      });
    }

    // Upload new evidence files
    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadToCloudinary(
        file.buffer,
        'raza-home-quote/reports'
      );
      return {
        type: file.mimetype.startsWith('image/') ? 'image' : 'document',
        public_id: result.public_id,
        url: result.secure_url,
        filename: file.originalname,
        description: description || ''
      };
    });

    const newEvidence = await Promise.all(uploadPromises);
    report.evidence.push(...newEvidence);
    report.updatedAt = new Date();
    await report.save();

    // Notify admins about new evidence
    if (req.app.get('io')) {
      await sendAdminNotification(req.app.get('io'), {
        type: 'report_evidence_added',
        title: 'New Evidence Added',
        message: `New evidence added to report: ${report.reason}`,
        data: {
          reportId: report._id,
          reportType: report.reportType,
          evidenceCount: report.evidence.length
        },
        category: 'report',
        priority: 'medium'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Evidence added successfully',
      data: { 
        evidence: newEvidence,
        totalEvidence: report.evidence.length
      }
    });

  } catch (error) {
    console.error('Add report evidence error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding evidence to report',
      error: error.message
    });
  }
};

// @desc    Get report reasons (predefined options)
// @route   GET /api/reports/reasons
// @access  Private
const getReportReasons = async (req, res) => {
  try {
    const reportReasons = {
      user: [
        "Inappropriate behavior",
        "Harassment or bullying",
        "Fake profile",
        "Spam or suspicious activity",
        "Not responding to messages",
        "Requesting payment outside platform",
        "Other"
      ],
      job: [
        "Job posting contains inappropriate content",
        "Suspicious or fake job",
        "Requesting free work",
        "Asking for personal information",
        "Price seems unreasonable",
        "Other"
      ],
      review: [
        "Fake or misleading review",
        "Contains inappropriate language",
        "Personal attack or harassment",
        "Review is not related to the service",
        "Other"
      ],
      payment: [
        "Payment issue",
        "Unauthorized charge",
        "Refund not processed",
        "Payment method problem",
        "Other"
      ],
      message: [
        "Inappropriate content",
        "Harassment or threats",
        "Spam messages",
        "Requesting personal information",
        "Other"
      ],
      other: [
        "Technical issue",
        "Platform bug",
        "Feature request",
        "General feedback",
        "Other"
      ]
    };

    res.status(200).json({
      success: true,
      data: { reportReasons }
    });

  } catch (error) {
    console.error('Get report reasons error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report reasons',
      error: error.message
    });
  }
};

module.exports = {
  submitReport,
  getMyReports,
  getReportDetails,
  addReportEvidence,
  getReportReasons
};