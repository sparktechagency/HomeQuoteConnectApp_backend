// socket/notificationHandler.js
const Notification = require('../models/Notification');
const User = require('../models/User');

const notificationHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected for notifications:', socket.id);

    // Join user's notification room
    socket.on('join-notifications', async (userId) => {
      try {
        // Accept userId from multiple formats (object with userId property, or direct string/ID)
        const userIdToUse = 
          (typeof userId === 'object' ? userId.userId : userId) || 
          socket.userId;

        if (!userIdToUse) {
          console.log("No userId found!");
          return socket.emit('error', { message: 'User ID required' });
        }

        // CRITICAL: Store userId on socket for future authentication
        socket.userId = userIdToUse;

        // Join the user-specific notification room
        await socket.join(`notifications_${userIdToUse}`);
        console.log(`User ${userIdToUse} joined notification room`);

        // Mark all undelivered notifications as delivered
        await Notification.updateMany(
          { user: userIdToUse, delivered: false },
          { delivered: true, deliveredAt: new Date() }
        );

        // Get current unread count
        const unreadCount = await Notification.countDocuments({
          user: userIdToUse,
          read: false
        });

        // Send success response with unread count
        socket.emit('notification-joined', {
          message: "Successfully joined notification room",
          unreadCount
        });

      } catch (error) {
        console.error('Join notifications error:', error);
        socket.emit('error', { message: 'Failed to join notifications' });
      }
    });

    // Mark single notification as read
    socket.on('mark-notification-read', async (data) => {
      try {
        console.log('mark-notification-read received:', data);

        // Validate userId is set (user must have joined first)
        if (!socket.userId) {
          return socket.emit('error', { 
            message: 'Please join notifications first' 
          });
        }

        const { notificationId } = data;
        if (!notificationId) {
          return socket.emit('error', { message: 'notificationId required' });
        }

        // SECURITY: Only allow user to mark THEIR OWN notifications
        const notification = await Notification.findOneAndUpdate(
          { 
            _id: notificationId, 
            user: socket.userId  // ← CRITICAL: Must belong to current user
          },
          { 
            read: true, 
            readAt: new Date() 
          },
          { new: true }
        );

        if (!notification) {
          return socket.emit('error', { 
            message: 'Notification not found or access denied' 
          });
        }

        // Send updated unread count
        const unreadCount = await Notification.countDocuments({
          user: socket.userId,
          read: false
        });

        socket.emit('notification-read', { 
          notificationId: notification._id,
          unreadCount
        });

        console.log(`Notification ${notificationId} marked as read by user ${socket.userId}`);

      } catch (error) {
        console.error('Mark notification read error:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    // Mark all notifications as read
    socket.on('mark-all-notifications-read', async () => {
      try {
        console.log('mark-all-notifications-read received for user:', socket.userId);

        // Validate userId is set (user must have joined first)
        if (!socket.userId) {
          return socket.emit('error', { 
            message: 'Please join notifications first' 
          });
        }

        // SECURITY: Only update notifications belonging to current user
        const result = await Notification.updateMany(
          { 
            user: socket.userId,
            read: false
          },
          { 
            read: true, 
            readAt: new Date() 
          }
        );

        console.log(`${result.modifiedCount} notifications marked as read for user ${socket.userId}`);

        // Send success response with updated count (should be 0)
        socket.emit('all-notifications-read', { 
          success: true,
          markedCount: result.modifiedCount,
          unreadCount: 0
        });

      } catch (error) {
        console.error('Mark all notifications read error:', error);
        socket.emit('error', { message: 'Failed to mark all notifications as read' });
      }
    });

    // Get unread notification count
    socket.on('get-unread-count', async () => {
      try {
        // SECURITY: Use socket.userId instead of accepting from client
        if (!socket.userId) {
          return socket.emit('error', { 
            message: 'Please join notifications first' 
          });
        }

        const count = await Notification.countDocuments({
          user: socket.userId,
          read: false
        });

        socket.emit('unread-count', { count });
        
        console.log(`Unread count for user ${socket.userId}: ${count}`);
      } catch (error) {
        console.error('Get unread count error:', error);
        socket.emit('error', { message: 'Failed to get unread count' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected from notifications:', socket.id);
    });
  });
};
// Helper function to send notification to a specific user
const sendNotification = async (io, userId, payload) => {
  try {
    // Validate required fields
    if (!userId || !payload.type || !payload.title || !payload.message) {
      console.error('Missing required notification fields');
      throw new Error('Missing required notification fields');
    }

    // 1. Create notification in DB
    const notification = await Notification.create({
      user: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: {
        jobId: payload.jobId,
        quoteId: payload.quoteId,
        providerName: payload.providerName,
        clientName: payload.clientName,
        reason: payload.reason
      },
      priority: payload.priority || 'medium',
      delivered: false,
      read: false
    });

    // 2. Mark as delivered immediately (user might be online)
    await Notification.findByIdAndUpdate(notification._id, {
      delivered: true,
      deliveredAt: new Date()
    });

    // 3. Emit to user's notification room
    const room = `notifications_${userId}`;
    console.log("Sending notification to room:", room);
    
    io.to(room).emit('new-notification', {
      ...notification.toObject(),
      createdAt: new Date().toISOString()
    });

    console.log(`new-notification saved & sent to room ${room}: ${payload.type}`);

    return notification;

  } catch (error) {
    console.error('Send notification error:', error);
    throw error;
  }
};
// Helper function to send notification to all admins
const sendAdminNotification = async (io, payload) => {
  try {
    // Validate required fields
    if (!payload.type || !payload.title || !payload.message) {
      console.error('Missing required admin notification fields');
      throw new Error('Missing required notification fields');
    }

    // 1. Find all admins
    const admins = await User.find({ role: 'admin' }, '_id');

    if (admins.length === 0) {
      console.log('No admins found to notify');
      return [];
    }

    // 2. Create notification for EACH admin
    const notifications = await Notification.insertMany(
      admins.map(admin => ({
        user: admin._id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data || {},
        category: payload.category || 'system',
        priority: payload.priority || 'medium',
        delivered: true, // Mark as delivered immediately
        deliveredAt: new Date(),
        read: false
      }))
    );

    // 3. Emit to each admin's notification room
    notifications.forEach(notif => {
      const room = `notifications_${notif.user}`;
      io.to(room).emit('new-notification', {
        ...notif.toObject(),
        createdAt: new Date().toISOString()
      });
      console.log(`Admin notification → ${room}: ${payload.type}`);
    });

    return notifications;

  } catch (error) {
    console.error('sendAdminNotification error:', error);
    throw error;
  }
};

// Helper to emit raw events to user rooms (for custom real-time updates)
const emitRawEvent = (io, userId, event, data) => {
  if (!userId || !event) {
    console.error('emitRawEvent: userId and event are required');
    return;
  }
  io.to(`notifications_${userId}`).emit(event, data);
  console.log(`Raw event emitted: ${event} to user ${userId}`);
};

module.exports = {
  notificationHandler,
  sendNotification,
  emitRawEvent,
  sendAdminNotification
};