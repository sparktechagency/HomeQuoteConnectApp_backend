# Real-Time Socket Documentation

## Overview

The HomeQuoteConnect application uses Socket.IO for real-time communication, particularly for notifications, chat, and support messaging. This document focuses on the notification socket events and how to integrate them with your frontend application.

## Socket Connection Setup

### Authentication

All socket connections require authentication using JWT tokens. The socket middleware supports multiple authentication methods:

#### Method 1: Connection Auth Object (Recommended for Postman)
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

#### Method 2: Authorization Header
```javascript
const socket = io('http://localhost:5000', {
  extraHeaders: {
    'Authorization': 'Bearer your-jwt-token-here'
  }
});
```

#### Method 3: Query Parameter
```javascript
const socket = io('http://localhost:5000', {
  query: {
    token: 'your-jwt-token-here'
  }
});
```

### Connection Events

#### Connection Success
```javascript
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});
```

#### Connection Error
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

#### General Error
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
```

---

## Notification Socket Events

### 1. Join Notification Room

**Event**: `join-notifications`

**Direction**: Client → Server

**Description**: Join the user's notification room to receive real-time notifications. This also marks all undelivered notifications as delivered.

**Payload**:
```javascript
// Option 1: Send userId directly
socket.emit('join-notifications', userId);

// Option 2: Send as object
socket.emit('join-notifications', { userId: userId });
```

**Response Events**:

**Success Response** (`notification-joined`):
```javascript
socket.on('notification-joined', (data) => {
  console.log(data.message); // "Successfully joined notification room"
  console.log('Unread count:', data.unreadCount);
});
```

**Error Response** (`error`):
```javascript
socket.on('error', (data) => {
  console.error('Join failed:', data.message);
});
```

---

### 2. Receive New Notifications

**Event**: `new-notification`

**Direction**: Server → Client

**Description**: Emitted when a new notification is created for the user.

**Payload Structure**:
```javascript
{
  "_id": "507f1f77bcf86cd799439011",
  "user": "507f1f77bcf86cd799439012",
  "type": "quote_accepted",
  "title": "Quote Accepted",
  "message": "Your quote has been accepted by John Client",
  "data": {
    "jobId": "507f1f77bcf86cd799439013",
    "quoteId": "507f1f77bcf86cd799439014",
    "clientName": "John Client"
  },
  "priority": "high",
  "delivered": true,
  "deliveredAt": "2024-01-15T10:30:00.000Z",
  "read": false,
  "readAt": null,
  "expiresAt": "2024-02-14T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Client Handler**:
```javascript
socket.on('new-notification', (notification) => {
  console.log('New notification:', notification);

  // Update UI
  updateNotificationBadge(notification);
  showNotificationToast(notification);

  // Refresh notification list if on notifications page
  if (onNotificationsPage) {
    refreshNotifications();
  }
});
```

---

### 3. Mark Notification as Read (Socket Method)

**Event**: `mark-notification-read`

**Direction**: Client → Server

**Description**: Mark a specific notification as read via socket (alternative to REST API).

**Payload**:
```javascript
socket.emit('mark-notification-read', {
  notificationId: '507f1f77bcf86cd799439011'
});
```

**Response Events**:

**Success Response** (`notification-read`):
```javascript
socket.on('notification-read', (data) => {
  console.log('Notification marked as read:', data.notificationId);

  // Update UI
  markNotificationAsReadInUI(data.notificationId);
  updateUnreadCount();
});
```

**Error Response** (`error`):
```javascript
socket.on('error', (data) => {
  console.error('Mark read failed:', data.message);
});
```

---

### 4. Get Unread Count

**Event**: `get-unread-count`

**Direction**: Client → Server

**Description**: Request the current unread notification count.

**Payload**:
```javascript
socket.emit('get-unread-count', userId);
```

**Response Event** (`unread-count`):
```javascript
socket.on('unread-count', (data) => {
  console.log('Unread notifications:', data.count);
  updateNotificationBadge(data.count);
});
```

---

## Notification Types and Triggers

### Provider Notifications

| Type | Trigger | Description |
|------|---------|-------------|
| `new_quote` | Client submits quote request | New job quote available |
| `quote_accepted` | Client accepts quote | Provider's quote was accepted |
| `quote_declined` | Client declines quote | Provider's quote was declined |
| `quote_updated` | Client updates quote | Quote details changed |
| `quote_cancelled` | Client cancels quote | Quote was cancelled |
| `job_cancelled` | Client cancels job | Entire job was cancelled |
| `payment_successful` | Payment processed | Payment completed successfully |
| `payment_received` | Payment received | Funds received in wallet |
| `payment_confirmed` | Payment confirmed | Payment verification complete |
| `payment_failed` | Payment failed | Payment processing failed |
| `refund_processed` | Refund issued | Refund completed |
| `verification_approved` | Profile verified | Provider verification approved |
| `verification_rejected` | Profile rejected | Provider verification rejected |
| `account_blocked` | Account suspended | Account access blocked |
| `account_unblocked` | Account restored | Account access restored |
| `stripe_account_verified` | Stripe connected | Stripe account verified |
| `subscription_activated` | Subscription started | New subscription activated |
| `credits_added` | Credits purchased | Credits added to account |
| `payment_released` | Payment released | Held payment released |
| `job_completed` | Job finished | Job marked as completed |

### Client Notifications

| Type | Trigger | Description |
|------|---------|-------------|
| `quote_accepted` | Provider accepts quote | Quote acceptance confirmed |
| `quote_declined` | Provider declines quote | Quote was declined |
| `quote_updated` | Provider updates quote | Quote details changed |
| `quote_cancelled` | Provider cancels quote | Quote was cancelled |
| `job_cancelled` | Provider cancels job | Job was cancelled |
| `payment_successful` | Payment processed | Payment completed |
| `payment_received` | Payment received | Payment confirmation |
| `payment_confirmed` | Payment confirmed | Payment verification |
| `payment_failed` | Payment failed | Payment processing failed |
| `refund_processed` | Refund issued | Refund completed |
| `support_message` | Support responds | New support message |
| `new_support_ticket` | Ticket created | Support ticket opened |
| `account_blocked` | Account suspended | Account access blocked |
| `account_unblocked` | Account restored | Account access restored |
| `job_completed` | Job finished | Job marked as completed |

### System Notifications

| Type | Trigger | Description |
|------|---------|-------------|
| `system_alert` | System events | Maintenance, updates, announcements |

---

## Frontend Integration Examples

### React Hook for Notifications

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const useNotifications = (userId, token) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_SOCKET_URL, {
      auth: { token }
    });

    // Join notification room
    newSocket.on('connect', () => {
      newSocket.emit('join-notifications', userId);
    });

    // Handle joining confirmation
    newSocket.on('notification-joined', (data) => {
      setUnreadCount(data.unreadCount);
    });

    // Handle new notifications
    newSocket.on('new-notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show toast notification
      showToast(notification.title, notification.message);
    });

    // Handle mark as read
    newSocket.on('notification-read', (data) => {
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === data.notificationId
            ? { ...notif, read: true, readAt: new Date() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId, token]);

  const markAsRead = (notificationId) => {
    socket?.emit('mark-notification-read', { notificationId });
  };

  const getUnreadCount = () => {
    socket?.emit('get-unread-count', userId);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    getUnreadCount
  };
};

export default useNotifications;
```

### Vue.js Composition Function

```javascript
import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';

export function useNotifications(userId, token) {
  const notifications = ref([]);
  const unreadCount = ref(0);
  const socket = ref(null);

  const connect = () => {
    socket.value = io(process.env.VUE_APP_SOCKET_URL, {
      auth: { token }
    });

    socket.value.on('connect', () => {
      socket.value.emit('join-notifications', userId);
    });

    socket.value.on('notification-joined', (data) => {
      unreadCount.value = data.unreadCount;
    });

    socket.value.on('new-notification', (notification) => {
      notifications.value.unshift(notification);
      unreadCount.value++;

      // Emit custom event for global handling
      window.dispatchEvent(new CustomEvent('new-notification', {
        detail: notification
      }));
    });

    socket.value.on('notification-read', (data) => {
      const index = notifications.value.findIndex(n => n._id === data.notificationId);
      if (index > -1) {
        notifications.value[index].read = true;
        notifications.value[index].readAt = new Date();
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
    });
  };

  const disconnect = () => {
    socket.value?.disconnect();
  };

  const markAsRead = (notificationId) => {
    socket.value?.emit('mark-notification-read', { notificationId });
  };

  onMounted(connect);
  onUnmounted(disconnect);

  return {
    notifications: readonly(notifications),
    unreadCount: readonly(unreadCount),
    markAsRead
  };
}
```

### Vanilla JavaScript Implementation

```javascript
class NotificationManager {
  constructor(userId, token) {
    this.userId = userId;
    this.token = token;
    this.notifications = [];
    this.unreadCount = 0;
    this.socket = null;
    this.listeners = {};

    this.connect();
  }

  connect() {
    this.socket = io('http://localhost:5000', {
      auth: { token: this.token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to notifications');
      this.socket.emit('join-notifications', this.userId);
    });

    this.socket.on('notification-joined', (data) => {
      this.unreadCount = data.unreadCount;
      this.emit('joined', data);
    });

    this.socket.on('new-notification', (notification) => {
      this.notifications.unshift(notification);
      this.unreadCount++;
      this.emit('new-notification', notification);
    });

    this.socket.on('notification-read', (data) => {
      const notification = this.notifications.find(n => n._id === data.notificationId);
      if (notification) {
        notification.read = true;
        notification.readAt = new Date();
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this.emit('notification-read', data);
      }
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  markAsRead(notificationId) {
    this.socket?.emit('mark-notification-read', { notificationId });
  }

  getUnreadCount() {
    this.socket?.emit('get-unread-count', this.userId);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

// Usage
const notificationManager = new NotificationManager(userId, token);

notificationManager.on('new-notification', (notification) => {
  showNotification(notification);
});

notificationManager.on('joined', (data) => {
  updateBadge(data.unreadCount);
});
```

---

## Postman Testing Examples

### Socket Connection Test

1. **Connect to Socket.IO Server**
   - URL: `ws://localhost:5000/socket.io/?EIO=4&transport=websocket`
   - Headers: `Authorization: Bearer your-jwt-token`

2. **Send Join Notifications Event**
   ```json
   {
     "event": "join-notifications",
     "data": "user_id_here"
   }
   ```

3. **Send Mark as Read Event**
   ```json
   {
     "event": "mark-notification-read",
     "data": {
       "notificationId": "notification_id_here"
     }
   }
   ```

4. **Listen for Events**
   - `new-notification`: New notification received
   - `notification-joined`: Successfully joined room
   - `notification-read`: Notification marked as read
   - `error`: Error occurred

---

## Error Handling

### Common Error Scenarios

1. **Authentication Failed**
   ```javascript
   socket.on('connect_error', (error) => {
     if (error.message.includes('Authentication')) {
       // Redirect to login or refresh token
       handleAuthError();
     }
   });
   ```

2. **Invalid Notification ID**
   ```javascript
   socket.on('error', (data) => {
     if (data.message.includes('not found')) {
       showErrorToast('Notification not found');
     }
   });
   ```

3. **Network Disconnection**
   ```javascript
   socket.on('disconnect', (reason) => {
     console.log('Disconnected:', reason);
     // Attempt reconnection
     if (reason === 'io server disconnect') {
       // Server disconnected, manual reconnection needed
       socket.connect();
     }
   });
   ```

---

## Best Practices

### 1. Connection Management
- Always join notification room after connection
- Handle reconnection scenarios
- Clean up event listeners on component unmount

### 2. State Synchronization
- Use REST API for initial data loading
- Use sockets for real-time updates only
- Sync socket state with local state

### 3. Error Handling
- Implement retry logic for failed operations
- Provide user feedback for errors
- Log errors for debugging

### 4. Performance
- Debounce rapid updates
- Limit notification history in memory
- Use pagination for large notification lists

### 5. Security
- Never expose sensitive data in socket events
- Validate all incoming data
- Use HTTPS in production

---

## Implementation Files

### Core Files
- `socket/notificationHandler.js` - Socket event handlers
- `socket/initializeSockets.js` - Socket initialization and auth
- `models/Notification.js` - Notification data model
- `controllers/notificationController.js` - REST API controllers
- `routes/api/notificationRoutes.js` - API routes

### Key Functions
- `sendNotification(io, userId, payload)` - Send notification to user
- `sendAdminNotification(io, payload)` - Send notification to all admins
- `emitRawEvent(io, userId, event, data)` - Emit custom events

This documentation provides everything needed to integrate real-time notifications into your frontend application using Socket.IO.