// socket/notificationHandler.js
const Notification = require('../models/Notification');
const User = require('../models/User');

const notificationHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected for notifications:', socket.id);

    // Join user's notification room
// ADD THIS LINE – THIS IS THE MISSING PART!!!
// FIXED & FINAL – WORKS 100%
socket.on('join-notifications', async (userId) => {
  try {
    // Accept userId from any format
    const userIdToUse = 
      (typeof userId === 'object' ? userId.userId : userId) || 
      socket.userId;

    if (!userIdToUse) {
      console.log("No userId found!");
      return socket.emit('error', { message: 'User ID required' });
    }

    await socket.join(`notifications_${userIdToUse}`);
    console.log(`User ${userIdToUse} joined notification room`);

    // Mark as delivered
    await Notification.updateMany(
      { user: userIdToUse, delivered: false },
      { delivered: true, deliveredAt: new Date() }
    );

    // Send success response
    const unreadCount = await Notification.countDocuments({
      user: userIdToUse,
      read: false
    });

    socket.emit('notification-joined', {
      message: "Successfully joined notification room",
      unreadCount
    });

  } catch (error) {
    console.error('Join notifications error:', error);
    socket.emit('error', { message: 'Failed to join notifications' });
  }
});

    // Mark notification as read
socket.on('mark-notification-read', async (data) => {
  try {
    console.log('mark-notification-read received:', data);

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

    socket.emit('notification-read', { 
      notificationId: notification._id 
    });

    console.log(`Notification ${notificationId} marked as read by user ${socket.userId}`);

  } catch (error) {
    console.error('Mark notification read error:', error);
    socket.emit('error', { message: 'Failed to mark notification as read' });
  }
});

    // Mark all notifications as read
 socket.on('mark-notification-read', async (payload) => {
  try {
    console.log('mark-notification-read received:', payload);

    // FIX: Extract from nested `data`
    const { notificationId } = payload.data || {};

    console.log(notificationId)
    if (!notificationId) {
      return socket.emit('error', { message: 'notificationId required' });
    }

    // SECURITY: Only allow user to mark THEIR OWN notifications
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: notificationId, 
        user: socket.userId  
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

    socket.emit('notification-read', { 
      notificationId: notification._id 
    });

    console.log(`Notification ${notificationId} marked as read by user ${socket.userId}`);

  } catch (error) {
    console.error('Mark notification read error:', error);
    socket.emit('error', { message: 'Failed to mark notification as read' });
  }
});

    // Get unread notification count
    socket.on('get-unread-count', async (userId) => {
      try {
        const count = await Notification.countDocuments({
          user: userId,
          read: false
        });

        socket.emit('unread-count', { count });
      } catch (error) {
        console.error('Get unread count error:', error);
      }
    });
  });
};
const sendNotification = async (io, userId, payload) => {
  try {
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

    // 2. Emit to correct room
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
const sendAdminNotification = async (io, payload) => {
  try {
    // 1. Find all admins
    const admins = await User.find({ role: 'admin' }, '_id');

    if (admins.length === 0) {
      console.log('No admins found to notify');
      return;
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
        delivered: false,
        read: false
      }))
    );

    // 3. Emit to each admin's room
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

// Add this helper
const emitRawEvent = (io, userId, event, data) => {
  io.to(`notifications_${userId}`).emit(event, data);
};

module.exports = {
  notificationHandler,
  sendNotification,
    emitRawEvent,
  sendAdminNotification
};