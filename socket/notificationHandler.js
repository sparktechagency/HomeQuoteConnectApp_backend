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
        const { notificationId } = data;
        await Notification.findByIdAndUpdate(notificationId, {
          read: true,
          readAt: new Date()
        });

        socket.emit('notification-read', { notificationId });
      } catch (error) {
        console.error('Mark notification read error:', error);
      }
    });

    // Mark all notifications as read
    socket.on('mark-all-notifications-read', async (userId) => {
      try {
        await Notification.updateMany(
          { 
            user: userId,
            read: false
          },
          { 
            read: true,
            readAt: new Date()
          }
        );

        socket.emit('all-notifications-read');
      } catch (error) {
        console.error('Mark all notifications read error:', error);
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
module.exports = {
  notificationHandler,
  sendNotification,
};