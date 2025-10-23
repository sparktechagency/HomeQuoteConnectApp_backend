// socket/notificationHandler.js
const Notification = require('../models/Notification');
const User = require('../models/User');

const notificationHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected for notifications:', socket.id);

    // Join user's notification room
    socket.on('join-notifications', async (userId) => {
      try {
        socket.join(`notifications_${userId}`);
        console.log(`User ${userId} joined notification room`);

        // Mark all notifications as delivered
        await Notification.updateMany(
          { 
            user: userId,
            delivered: false
          },
          { 
            delivered: true,
            deliveredAt: new Date()
          }
        );
      } catch (error) {
        console.error('Join notifications error:', error);
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

// Utility function to send notifications
const sendNotification = async (io, userId, notificationData) => {
  try {
    const notification = await Notification.create({
      user: userId,
      ...notificationData,
      delivered: false,
      read: false
    });

    // Emit to user's notification room
    io.to(`notifications_${userId}`).emit('new-notification', notification);

    return notification;
  } catch (error) {
    console.error('Send notification error:', error);
    throw error;
  }
};

module.exports = {
  notificationHandler,
  sendNotification
};