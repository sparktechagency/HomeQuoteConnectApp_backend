// controllers/adminSupportController.js
const SupportTicket = require('../models/SupportTicket');
const SupportMessage = require('../models/SupportMessage');
const { sendNotification } = require('../socket/notificationHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Helper to process uploaded attachments (Multer files)

const processAttachments = async (files) => {
  if (!files || !Array.isArray(files) || files.length === 0) return [];

  const uploadPromises = files.map(async (file) => {
    // Upload buffer to Cloudinary
    const result = await uploadToCloudinary(file.buffer, 'raza-home-quote/support-attachments');

    // Determine type from mimetype
    const type = file.mimetype && file.mimetype.startsWith('image/') ? 'image' : 'document';

    return {
      type,
      public_id: result.public_id,
      url: result.secure_url,
      filename: file.originalname || file.fieldname,
      size: file.size,
      mimeType: file.mimetype
    };
  });

  return await Promise.all(uploadPromises);
};

// @desc    Get all support tickets for admin
// @route   GET /api/admin/support/tickets
// @access  Private (Admin only)

const getTicketMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const ticket = await SupportTicket.findById(id)
      .populate('user', 'fullName email profilePhoto')
      .populate('assignedTo', 'fullName profilePhoto');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const messages = await SupportMessage.find({ ticket: id })
      .populate('sender', 'fullName profilePhoto role')
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SupportMessage.countDocuments({ ticket: id });

    // Mark admin as read
    await SupportMessage.updateMany(
      { ticket: id, senderRole: 'user', 'readBy.user': { $ne: req.user._id } },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );

    res.status(200).json({
      success: true,
      data: {
        ticket: {
          _id: ticket._id,
          title: ticket.title,
          user: ticket.user,
          assignedTo: ticket.assignedTo,
          status: ticket.status
        },
        messages: messages.map(m => ({
          _id: m._id,
          sender: {
            _id: m.sender._id,
            fullName: m.sender.fullName,
            role: m.sender.role,
            profilePhoto: m.sender.profilePhoto
          },
          content: m.content,
          messageType: m.messageType,
          systemMessageType: m.systemMessageType,
          createdAt: m.createdAt,
          timeAgo: formatTimeAgo(m.createdAt)
        })),
        pagination: {
          current: +page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const getAdminTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      assignedTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tickets = await SupportTicket.find(filter)
      .populate('user', 'fullName email profilePhoto role')
      .populate('assignedTo', 'fullName profilePhoto')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get unread counts for each ticket
    const ticketsWithUnread = await Promise.all(
      tickets.map(async (ticket) => {
        const unreadCount = await SupportMessage.countDocuments({
          ticket: ticket._id,
          'readBy.user': { $ne: req.user._id },
          senderRole: 'user'
        });

        const lastMessage = await SupportMessage.findOne({ ticket: ticket._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'fullName profilePhoto');

        return {
          ...ticket.toObject(),
          unreadCount,
          lastMessage
        };
      })
    );

    const total = await SupportTicket.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        tickets: ticketsWithUnread,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get admin tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching support tickets',
      error: error.message
    });
  }
};

// @desc    Assign ticket to admin
// @route   PUT /api/admin/support/tickets/:id/assign
// @access  Private (Admin only)
const assignTicketToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    if (ticket.assignedTo && ticket.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned to another admin'
      });
    }

    ticket.assignedTo = req.user._id;
    ticket.status = 'in_progress';
    await ticket.save();

    // Create system message for assignment
    await SupportMessage.create({
      ticket: id,
      sender: req.user._id,
      senderRole: 'admin',
      content: { text: `Ticket assigned to support agent${notes ? ': ' + notes : ''}` },
      systemMessageType: 'assigned'
    });

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'fullName email profilePhoto')
      .populate('assignedTo', 'fullName profilePhoto');

    // Notify user about assignment
    if (req.app.get('io')) {
      sendNotification(req.app.get('io'), ticket.user, {
        type: 'support_assigned',
        title: 'Support Agent Assigned',
        message: `A support agent has been assigned to your ticket: ${ticket.title}`,
        ticketId: ticket._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully',
      data: { ticket: populatedTicket }
    });

  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning ticket',
      error: error.message
    });
  }
};

// @desc    Admin send message in support ticket
// @route   POST /api/admin/support/tickets/:id/messages
// @access  Private (Admin only)
const adminSendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text' } = req.body;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Auto-assign if not assigned
    if (!ticket.assignedTo) {
      ticket.assignedTo = req.user._id;
      ticket.status = 'in_progress';
      await ticket.save();
    }

    const message = await SupportMessage.create({
      ticket: id,
      sender: req.user._id,
      senderRole: 'admin',
      content: {
        text: content,
        attachments: req.files ? await processAttachments(req.files) : []
      },
      messageType
    });

    // Update ticket updatedAt
    await SupportTicket.findByIdAndUpdate(id, { updatedAt: new Date() });

    const populatedMessage = await SupportMessage.findById(message._id)
      .populate('sender', 'fullName profilePhoto role');

    // Emit real-time message
    if (req.app.get('io')) {
      const roomId = `support_ticket_${id}`;
      req.app.get('io').to(roomId).emit('new_support_message', populatedMessage);

      // Notify user
      sendNotification(req.app.get('io'), ticket.user, {
        type: 'support_message',
        title: 'Support Response',
        message: `You have a new message in your support ticket: ${ticket.title}`,
        ticketId: id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: populatedMessage }
    });

  } catch (error) {
    console.error('Admin send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

// @desc    Resolve support ticket
// @route   PUT /api/admin/support/tickets/:id/resolve
// @access  Private (Admin only)
const resolveSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, sendNotification = true } = req.body;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    if (ticket.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already resolved'
      });
    }

    ticket.status = 'resolved';
    ticket.resolution = {
      notes: resolutionNotes,
      resolvedBy: req.user._id,
      resolvedAt: new Date()
    };
    await ticket.save();

    // Create resolution message
    await SupportMessage.create({
      ticket: id,
      sender: req.user._id,
      senderRole: 'admin',
      content: { text: `Ticket resolved${resolutionNotes ? ': ' + resolutionNotes : ''}` },
      systemMessageType: 'resolved'
    });

    // Notify user about resolution
    if (sendNotification && req.app.get('io')) {
      sendNotification(req.app.get('io'), ticket.user, {
        type: 'ticket_resolved',
        title: 'Ticket Resolved',
        message: `Your support ticket "${ticket.title}" has been resolved`,
        ticketId: id
      });
    }

    const resolvedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'fullName email profilePhoto')
      .populate('assignedTo', 'fullName profilePhoto')
      .populate('resolution.resolvedBy', 'fullName profilePhoto');

    res.status(200).json({
      success: true,
      message: 'Ticket resolved successfully',
      data: { ticket: resolvedTicket }
    });

  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving ticket',
      error: error.message
    });
  }
};

// @desc    Get support statistics (dashboard)
// @route   GET /api/admin/support/statistics
// @access  Private (Admin only)
const getSupportStatistics = async (req, res) => {
  try {
    // Get overall statistics
    const totalTickets = await SupportTicket.countDocuments();
    const openTickets = await SupportTicket.countDocuments({ status: 'open' });
    const inProgressTickets = await SupportTicket.countDocuments({ status: 'in_progress' });
    const resolvedTickets = await SupportTicket.countDocuments({ status: 'resolved' });
    const closedTickets = await SupportTicket.countDocuments({ status: 'closed' });

    // Calculate average response time (in minutes)
    // Response time = time from ticket creation to first admin message
    const responseTimeData = await SupportMessage.aggregate([
      {
        $match: { senderRole: 'admin' }
      },
      {
        $group: {
          _id: '$ticket',
          firstAdminMessageTime: { $min: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'supporttickets',
          localField: '_id',
          foreignField: '_id',
          as: 'ticket'
        }
      },
      {
        $unwind: '$ticket'
      },
      {
        $project: {
          responseTimeMinutes: {
            $divide: [
              { $subtract: ['$firstAdminMessageTime', '$ticket.createdAt'] },
              60000
            ]
          }
        }
      }
    ]);

    const avgResponseTime = responseTimeData.length > 0
      ? Math.round(
          responseTimeData.reduce((acc, doc) => acc + doc.responseTimeMinutes, 0) /
          responseTimeData.length
        )
      : 0;

    // Calculate satisfaction rate (estimate based on resolved tickets without re-open)
    // For now, we'll calculate based on resolved vs total
    const satisfactionRate = totalTickets > 0
      ? Math.round((resolvedTickets / totalTickets) * 100)
      : 0;

    // Get distribution by category
    const byCategory = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get distribution by priority
    const byPriority = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ]);

    // Get distribution by status
    const byStatus = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get tickets by user role
    const byUserRole = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$userRole',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get trending data (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTickets = await SupportTicket.aggregate([
      {
        $match: { createdAt: { $gte: sevenDaysAgo } }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
          avgResponseTime,
          satisfactionRate
        },
        distribution: {
          byCategory: byCategory.length > 0 ? byCategory : [],
          byPriority: byPriority.length > 0 ? byPriority : [],
          byStatus: byStatus.length > 0 ? byStatus : [],
          byUserRole: byUserRole.length > 0 ? byUserRole : []
        },
        trends: {
          last7Days: recentTickets.length > 0 ? recentTickets : []
        }
      }
    });

  } catch (error) {
    console.error('Get support statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching support statistics',
      error: error.message
    });
  }
};
const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
module.exports = {
  getAdminTickets,
  assignTicketToAdmin,
  adminSendMessage,
  resolveSupportTicket,
  getSupportStatistics,
  getTicketMessages
};