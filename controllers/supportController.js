// controllers/supportController.js
const SupportTicket = require('../models/SupportTicket');
const SupportMessage = require('../models/SupportMessage');
const User = require('../models/User');
const { sendNotification } = require('../socket/notificationHandler');

// @desc    Create support ticket
// @route   POST /api/support/tickets
// @access  Private
const createSupportTicket = async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;

    const ticket = await SupportTicket.create({
      title,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      user: req.user._id,
      userRole: req.user.role
    });

    // Create system message for ticket creation
    await SupportMessage.create({
      ticket: ticket._id,
      sender: req.user._id,
      senderRole: 'user',
      content: { text: description },
      systemMessageType: 'ticket_created'
    });

    // Populate ticket for response
    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'fullName profilePhoto email');

    // Notify admins about new ticket
    if (req.app.get('io')) {
      const admins = await User.find({ role: 'admin', isActive: true });
      admins.forEach(admin => {
        sendNotification(req.app.get('io'), admin._id, {
          type: 'new_support_ticket',
          title: 'New Support Ticket',
          message: `New support ticket: ${title}`,
          ticketId: ticket._id,
          priority: ticket.priority
        });
      });
    }

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: { ticket: populatedTicket }
    });

  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating support ticket',
      error: error.message
    });
  }
};

// @desc    Get user's support tickets
// @route   GET /api/support/tickets
// @access  Private
const getUserTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const tickets = await SupportTicket.find(filter)
      .populate('assignedTo', 'fullName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get unread message counts for each ticket
    const ticketsWithUnread = await Promise.all(
      tickets.map(async (ticket) => {
        const unreadCount = await SupportMessage.countDocuments({
          ticket: ticket._id,
          'readBy.user': { $ne: req.user._id },
          senderRole: 'admin'
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
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching support tickets',
      error: error.message
    });
  }
};

// @desc    Get ticket messages
// @route   GET /api/support/tickets/:id/messages
// @access  Private
const getTicketMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user owns the ticket or is admin
    const ticket = await SupportTicket.findOne({
      _id: id,
      $or: [
        { user: req.user._id },
        { assignedTo: req.user._id }
      ]
    });

    if (!ticket && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this ticket'
      });
    }

    const messages = await SupportMessage.find({ ticket: id })
      .populate('sender', 'fullName profilePhoto role')
      .sort({ createdAt: 1 }) // Chronological order for chat
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark admin messages as read for user
    if (req.user.role !== 'admin') {
      await SupportMessage.updateMany(
        {
          ticket: id,
          senderRole: 'admin',
          'readBy.user': { $ne: req.user._id }
        },
        {
          $push: {
            readBy: {
              user: req.user._id,
              readAt: new Date()
            }
          },
          isRead: true
        }
      );
    }

    const total = await SupportMessage.countDocuments({ ticket: id });

    res.status(200).json({
      success: true,
      data: {
        ticket,
        messages,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get ticket messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket messages',
      error: error.message
    });
  }
};

// @desc    Send message in support ticket
// @route   POST /api/support/tickets/:id/messages
// @access  Private
const sendSupportMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text', attachments } = req.body;

    // Verify user has access to the ticket
    const ticket = await SupportTicket.findOne({
      _id: id,
      $or: [
        { user: req.user._id },
        { assignedTo: req.user._id }
      ]
    });

    if (!ticket && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this ticket'
      });
    }

    // Auto-assign to admin if not assigned and user is admin
    if (req.user.role === 'admin' && !ticket.assignedTo) {
      ticket.assignedTo = req.user._id;
      ticket.status = 'in_progress';
      await ticket.save();

      // Create system message for assignment
      await SupportMessage.create({
        ticket: id,
        sender: req.user._id,
        senderRole: 'admin',
        content: { text: 'Ticket has been assigned to support agent' },
        systemMessageType: 'assigned'
      });
    }

    const message = await SupportMessage.create({
      ticket: id,
      sender: req.user._id,
      senderRole: req.user.role === 'admin' ? 'admin' : 'user',
      content: {
        text: content,
        attachments: attachments || []
      },
      messageType
    });

    // Update ticket updatedAt
    await SupportTicket.findByIdAndUpdate(id, { updatedAt: new Date() });

    // Populate message for response
    const populatedMessage = await SupportMessage.findById(message._id)
      .populate('sender', 'fullName profilePhoto role');

    // Emit socket event for real-time messaging
    if (req.app.get('io')) {
      const roomId = `support_ticket_${id}`;
      req.app.get('io').to(roomId).emit('new_support_message', populatedMessage);

      // Notify the other party
      if (req.user.role === 'admin') {
        // Notify user
        sendNotification(req.app.get('io'), ticket.user, {
          type: 'support_message',
          title: 'Support Response',
          message: `You have a new message in your support ticket: ${ticket.title}`,
          ticketId: id
        });
      } else {
        // Notify assigned admin or all admins
        if (ticket.assignedTo) {
          sendNotification(req.app.get('io'), ticket.assignedTo, {
            type: 'support_message',
            title: 'New Support Message',
            message: `New message in support ticket: ${ticket.title}`,
            ticketId: id
          });
        } else {
          // Notify all admins
          const admins = await User.find({ role: 'admin', isActive: true });
          admins.forEach(admin => {
            sendNotification(req.app.get('io'), admin._id, {
              type: 'support_message',
              title: 'New Support Message',
              message: `New message in unassigned ticket: ${ticket.title}`,
              ticketId: id
            });
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: populatedMessage }
    });

  } catch (error) {
    console.error('Send support message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

// @desc    Join live chat for support
// @route   POST /api/support/tickets/:id/join-live
// @access  Private
const joinLiveChat = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await SupportTicket.findOne({
      _id: id,
      $or: [
        { user: req.user._id },
        { assignedTo: req.user._id }
      ]
    });

    if (!ticket && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to join this chat'
      });
    }

    // Update chat session
    ticket.chatSession = {
      sessionId: `support_${id}_${Date.now()}`,
      isActive: true,
      joinedAt: new Date()
    };
    await ticket.save();

    // Create system message for chat join
    await SupportMessage.create({
      ticket: id,
      sender: req.user._id,
      senderRole: req.user.role === 'admin' ? 'admin' : 'user',
      content: { text: 'joined the live chat' },
      systemMessageType: 'status_changed'
    });

    // Emit socket event for chat join
    if (req.app.get('io')) {
      const roomId = `support_ticket_${id}`;
      req.app.get('io').to(roomId).emit('user_joined_chat', {
        userId: req.user._id,
        userName: req.user.fullName,
        role: req.user.role
      });
    }

    res.status(200).json({
      success: true,
      message: 'Joined live chat successfully',
      data: { 
        sessionId: ticket.chatSession.sessionId,
        ticket 
      }
    });

  } catch (error) {
    console.error('Join live chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining live chat',
      error: error.message
    });
  }
};

// @desc    Get support statistics for admin
// @route   GET /api/support/statistics
// @access  Private (Admin only)
const getSupportStatistics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access support statistics'
      });
    }

    const totalTickets = await SupportTicket.countDocuments();
    const openTickets = await SupportTicket.countDocuments({ status: 'open' });
    const inProgressTickets = await SupportTicket.countDocuments({ status: 'in_progress' });
    const resolvedTickets = await SupportTicket.countDocuments({ status: 'resolved' });

    // Tickets by category
    const ticketsByCategory = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Tickets by priority
    const ticketsByPriority = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Average response time (time from ticket creation to first admin response)
    const responseTimeStats = await SupportMessage.aggregate([
      {
        $match: { senderRole: 'admin' }
      },
      {
        $group: {
          _id: '$ticket',
          firstResponse: { $min: '$createdAt' }
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
          responseTime: {
            $divide: [
              { $subtract: ['$firstResponse', '$ticket.createdAt'] },
              1000 * 60 // Convert to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    const avgResponseTime = responseTimeStats.length > 0 ? 
      Math.round(responseTimeStats[0].avgResponseTime) : 0;

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          avgResponseTime
        },
        distribution: {
          byCategory: ticketsByCategory,
          byPriority: ticketsByPriority
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

module.exports = {
  createSupportTicket,
  getUserTickets,
  getTicketMessages,
  sendSupportMessage,
  joinLiveChat,
  getSupportStatistics
};