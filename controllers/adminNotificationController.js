// controllers/adminNotificationController.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction');
const { sendNotification } = require('../socket/notificationHandler');

// @desc    Get admin notifications
// @route   GET /api/admin/notifications
// @access  Private (Admin only)
const getAdminNotifications = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      priority, 
      read, 
      type 
    } = req.query;

    // Build filter for admin notifications (system-wide or specific categories)
    const filter = {
      $or: [
        { user: req.user._id }, // Admin's personal notifications
        { category: { $in: ['system', 'user', 'payment', 'report'] } } // System notifications
      ]
    };

    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (read !== undefined) filter.read = read === 'true';
    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .populate('user', 'fullName profilePhoto email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(filter);

    // Get unread count for admin
    const unreadCount = await Notification.countDocuments({
      ...filter,
      read: false
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/admin/notifications/:id/read
// @access  Private (Admin only)
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id },
      { 
        read: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/admin/notifications/mark-all-read
// @access  Private (Admin only)
const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        $or: [
          { user: req.user._id },
          { category: { $in: ['system', 'user', 'payment', 'report'] } }
        ],
        read: false
      },
      { 
        read: true,
        readAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: error.message
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/admin/notifications/statistics
// @access  Private (Admin only)
const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $match: {
          $or: [
            { user: req.user._id },
            { category: { $in: ['system', 'user', 'payment', 'report'] } }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          urgentPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          }
        }
      }
    ]);

    const totalStats = await Notification.aggregate([
      {
        $match: {
          $or: [
            { user: req.user._id },
            { category: { $in: ['system', 'user', 'payment', 'report'] } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
          },
          today: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        byCategory: stats,
        totals: totalStats.length > 0 ? totalStats[0] : {
          total: 0,
          unread: 0,
          today: 0
        }
      }
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification statistics',
      error: error.message
    });
  }
};

// Utility function to send admin notifications (used by other controllers)
const sendAdminNotification = async (io, notificationData) => {
  try {
    // Get all admin users
    const admins = await User.find({ role: 'admin', isActive: true });
    
    // Send notification to each admin
    const notificationPromises = admins.map(admin => 
      sendNotification(io, admin._id, {
        ...notificationData,
        category: notificationData.category || 'system'
      })
    );
    
    await Promise.all(notificationPromises);
    
    return true;
  } catch (error) {
    console.error('Send admin notification error:', error);
    return false;
  }
};

module.exports = {
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationStats,
  sendAdminNotification
};