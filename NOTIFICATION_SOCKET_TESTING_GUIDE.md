# 🔔 Notification System - Socket.IO Testing Guide

## 📌 Overview

This document provides comprehensive testing guidelines for the real-time notification system using Socket.IO. The system supports user-specific notifications, admin broadcasts, real-time delivery tracking, and read status management.

---

## 🎯 System Architecture

### Notification Flow

```
1. User connects to Socket.IO server
2. User emits 'join-notifications' with their userId
3. Server validates and joins user to room: `notifications_{userId}`
4. Server marks all undelivered notifications as delivered
5. Server emits 'notification-joined' with current unread count
6. User can now receive real-time notifications via 'new-notification' event
7. User can mark notifications as read via 'mark-notification-read'
8. User can mark all notifications as read via 'mark-all-notifications-read'
9. User can request unread count via 'get-unread-count'
```




### Security Model

- ✅ Each user can ONLY access their own notifications
- ✅ `socket.userId` is set during `join-notifications` and used for all subsequent operations
- ✅ All database queries filter by `socket.userId` to prevent unauthorized access
- ✅ Clients cannot spoof other users' notifications
- ✅ Notifications are delivered to user-specific rooms: `notifications_{userId}`

---

## 🔌 Connection Setup

### Prerequisites

1. Backend server running on `http://localhost:5000` (or your configured port)
2. Valid authentication token (JWT)
3. Socket.IO client (Postman, or browser-based client)

### Connect to Socket.IO

**Endpoint:**
```
ws://localhost:5000
```

**Authentication:**
```javascript
// Include token in connection query or headers
{
  "auth": {
    "token": "your-jwt-token-here"
  }
}
```

**Connection String (Postman):**
```
ws://localhost:5000?token=your-jwt-token-here
```

---

## 🧩 Event: `join-notifications`

### Purpose
Registers the user to receive real-time notifications by joining their dedicated notification room.

### Client → Server

**Event Name:** `join-notifications`

**Payload Options:**

```json
// Option 1: Direct userId (string)
"65f8a1234567890abcdef123"
```

```json
// Option 2: Object with userId property
{
  "userId": "65f8a1234567890abcdef123"
}
```

**Example (Postman):**
```json
{
  "userId": "65f8a1234567890abcdef123"
}
```

### Server → Client Response

**Success Event:** `notification-joined`

**Response Payload:**
```json
{
  "message": "Successfully joined notification room",
  "unreadCount": 5
}
```

**Error Event:** `error`

**Error Payload:**
```json
{
  "message": "User ID required"
}
```

### Backend Behavior

1. Extracts userId from payload (supports multiple formats)
2. Validates userId exists
3. **Stores userId on socket** (`socket.userId = userIdToUse`)
4. Joins socket to room: `notifications_{userId}`
5. Marks all undelivered notifications as delivered
6. Counts unread notifications
7. Emits success response with unread count

### Testing Steps

1. Connect to Socket.IO server
2. Emit `join-notifications` event with your userId
3. Listen for `notification-joined` event
4. Verify `unreadCount` matches your expectations
5. Verify console logs show successful join

---

## 🧩 Event: `new-notification`

### Purpose
Real-time notification pushed from server to client when a new notification is created.

### Server → Client (Auto-emitted)

**Event Name:** `new-notification`

**Payload Example:**
```json
{
  "_id": "65f8a9876543210fedcba987",
  "user": "65f8a1234567890abcdef123",
  "type": "new_quote",
  "title": "New Quote Received",
  "message": "You received a quote from John's Plumbing for $450",
  "data": {
    "jobId": "65f8a1111111111111111111",
    "quoteId": "65f8a2222222222222222222",
    "providerName": "John's Plumbing",
    "clientName": "Alice Johnson"
  },
  "priority": "medium",
  "delivered": true,
  "deliveredAt": "2025-12-25T10:30:00.000Z",
  "read": false,
  "createdAt": "2025-12-25T10:30:00.000Z",
  "updatedAt": "2025-12-25T10:30:00.000Z"
}
```

### Notification Types

The system supports various notification types:

- `new_quote` - Provider submitted a quote
- `quote_accepted` - Client accepted your quote
- `quote_declined` - Client declined your quote
- `new_job` - New job posted matching your specialization
- `payment_received` - Payment received for completed job
- `job_completed` - Job marked as completed
- `account_blocked` - Admin blocked your account
- `verification_approved` - Background check approved
- And more... (see [Notification.js](models/Notification.js) for complete list)

### Testing Steps

1. Ensure you've joined notifications room
2. Listen for `new-notification` event
3. Trigger a notification from another API endpoint (e.g., submit a quote)
4. Verify notification is received in real-time
5. Check notification structure matches expected format

---

## 🧩 Event: `mark-notification-read`

### Purpose
Marks a single notification as read for the current user.

### Client → Server

**Event Name:** `mark-notification-read`

**Payload:**
```json
{
  "notificationId": "65f8a9876543210fedcba987"
}
```

### Server → Client Response

**Success Event:** `notification-read`

**Response Payload:**
```json
{
  "notificationId": "65f8a9876543210fedcba987",
  "unreadCount": 4
}
```

**Error Event:** `error`

**Error Payloads:**
```json
// User hasn't joined notifications
{
  "message": "Please join notifications first"
}

// Missing notificationId
{
  "message": "notificationId required"
}

// Notification doesn't exist or doesn't belong to user
{
  "message": "Notification not found or access denied"
}
```

### Backend Behavior

1. Validates `socket.userId` is set (user must have joined first)
2. Validates `notificationId` is provided
3. **Security Check:** Updates only if notification belongs to `socket.userId`
4. Updates notification: `{ read: true, readAt: new Date() }`
5. Counts remaining unread notifications
6. Emits success response with updated unread count

### Testing Steps

1. Get a notification ID from your notifications list
2. Emit `mark-notification-read` with the ID
3. Listen for `notification-read` event
4. Verify `unreadCount` decremented by 1
5. Try marking another user's notification (should fail)

---

## 🧩 Event: `mark-all-notifications-read`

### Purpose
Marks ALL unread notifications as read for the current user.

### Client → Server

**Event Name:** `mark-all-notifications-read`

**Payload:**
```json
{}
```
*(No payload required)*

### Server → Client Response

**Success Event:** `all-notifications-read`

**Response Payload:**
```json
{
  "success": true,
  "markedCount": 12,
  "unreadCount": 0
}
```

**Error Event:** `error`

**Error Payload:**
```json
{
  "message": "Please join notifications first"
}
```

### Backend Behavior

1. Validates `socket.userId` is set
2. Updates all unread notifications belonging to `socket.userId`
3. Sets `{ read: true, readAt: new Date() }` for all matched documents
4. Returns count of notifications marked as read
5. Returns final unread count (should be 0)

### Testing Steps

1. Ensure you have multiple unread notifications
2. Emit `mark-all-notifications-read` (no payload)
3. Listen for `all-notifications-read` event
4. Verify `markedCount` matches your unread count
5. Verify `unreadCount` is now 0
6. Emit `get-unread-count` to confirm

---

## 🧩 Event: `get-unread-count`

### Purpose
Retrieves the current count of unread notifications for the authenticated user.

### Client → Server

**Event Name:** `get-unread-count`

**Payload:**
```json
{}
```
*(No payload required - uses `socket.userId`)*

### Server → Client Response

**Success Event:** `unread-count`

**Response Payload:**
```json
{
  "count": 5
}
```

**Error Event:** `error`

**Error Payload:**
```json
{
  "message": "Please join notifications first"
}
```

### Backend Behavior

1. **Security Check:** Uses `socket.userId` (NOT client-provided userId)
2. Queries MongoDB: `Notification.countDocuments({ user: socket.userId, read: false })`
3. Returns count of unread notifications
4. Logs count to console for debugging

### Testing Steps

1. Emit `get-unread-count` (no payload)
2. Listen for `unread-count` event
3. Verify count matches your expectations
4. Mark a notification as read
5. Re-emit `get-unread-count` and verify count decreased

---

## 🛡️ Security Rules

### Authentication
- Users must provide valid JWT token on connection
- Token is validated before allowing socket operations

### Authorization
- `socket.userId` is set ONLY during `join-notifications`
- All subsequent operations use `socket.userId` (not client input)
- Users cannot access other users' notifications

### Query Filtering
All notification queries include:
```javascript
{ user: socket.userId }
```

This ensures users can only:
- ✅ Mark their own notifications as read
- ✅ Get their own unread count
- ✅ Receive notifications intended for them

### Room Isolation
- Each user is in a unique room: `notifications_{userId}`
- Notifications are emitted to specific rooms only
- Users cannot join other users' rooms

---

## 🧪 Complete Testing Workflow (Postman)

### Step 1: Connect to Socket.IO

1. Open Postman
2. Create new Socket.IO request
3. Set URL: `ws://localhost:5000`
4. Add authentication:
   ```json
   {
     "auth": {
       "token": "your-jwt-token"
     }
   }
   ```
5. Click **Connect**

### Step 2: Join Notifications Room

**Event to Emit:**
```json
{
  "event": "join-notifications",
  "data": {
    "userId": "65f8a1234567890abcdef123"
  }
}
```

**Expected Response:**
```json
{
  "event": "notification-joined",
  "data": {
    "message": "Successfully joined notification room",
    "unreadCount": 3
  }
}
```

### Step 3: Listen for New Notifications

**Listen For:** `new-notification`

**Action:** Trigger a notification (e.g., submit a quote via REST API)

**Expected Real-time Event:**
```json
{
  "event": "new-notification",
  "data": {
    "_id": "...",
    "type": "new_quote",
    "title": "New Quote Received",
    "message": "...",
    "unreadCount": 4
  }
}
```

### Step 4: Get Unread Count

**Event to Emit:**
```json
{
  "event": "get-unread-count",
  "data": {}
}
```

**Expected Response:**
```json
{
  "event": "unread-count",
  "data": {
    "count": 4
  }
}
```

### Step 5: Mark Single Notification as Read

**Event to Emit:**
```json
{
  "event": "mark-notification-read",
  "data": {
    "notificationId": "65f8a9876543210fedcba987"
  }
}
```

**Expected Response:**
```json
{
  "event": "notification-read",
  "data": {
    "notificationId": "65f8a9876543210fedcba987",
    "unreadCount": 3
  }
}
```

### Step 6: Mark All Notifications as Read

**Event to Emit:**
```json
{
  "event": "mark-all-notifications-read",
  "data": {}
}
```

**Expected Response:**
```json
{
  "event": "all-notifications-read",
  "data": {
    "success": true,
    "markedCount": 3,
    "unreadCount": 0
  }
}
```

### Step 7: Verify Unread Count is Zero

**Event to Emit:**
```json
{
  "event": "get-unread-count",
  "data": {}
}
```

**Expected Response:**
```json
{
  "event": "unread-count",
  "data": {
    "count": 0
  }
}
```

---

## 🔍 Debugging Tips

### Check Server Logs

The notification handler logs key events:
```
User connected for notifications: abc123xyz
User 65f8a1234567890abcdef123 joined notification room
Sending notification to room: notifications_65f8a1234567890abcdef123
new-notification saved & sent to room notifications_65f8a1234567890abcdef123: new_quote
Notification 65f8a9876543210fedcba987 marked as read by user 65f8a1234567890abcdef123
Unread count for user 65f8a1234567890abcdef123: 2
```

### Common Issues

**Issue:** Not receiving notifications
- ✅ Verify you called `join-notifications` first
- ✅ Check userId matches your authenticated user
- ✅ Ensure notification is being created with your userId

**Issue:** Error "Please join notifications first"
- ✅ Call `join-notifications` before other events
- ✅ Verify `socket.userId` is set (check logs)

**Issue:** "Notification not found or access denied"
- ✅ Verify notification belongs to your userId
- ✅ Check notificationId is valid ObjectId
- ✅ Ensure notification hasn't been deleted

**Issue:** Unread count not updating
- ✅ Call `get-unread-count` after marking as read
- ✅ Check database to verify `read: true` was set
- ✅ Ensure you're not creating new notifications while testing

---

## 🚀 Admin Notifications

### Purpose
Send notifications to ALL admin users simultaneously.

### Backend Usage (Not Client-Triggered)

```javascript
const { sendAdminNotification } = require('./socket/notificationHandler');

// In your controller or service
await sendAdminNotification(io, {
  type: 'new_user_registered',
  title: 'New User Registered',
  message: 'John Doe just signed up as a provider',
  data: {
    userId: '65f8a1234567890abcdef123',
    role: 'provider'
  },
  priority: 'high'
});
```

### How It Works

1. Finds all users with `role: 'admin'`
2. Creates individual notification for each admin
3. Emits `new-notification` to each admin's room: `notifications_{adminId}`
4. Marks all notifications as delivered immediately

### Testing Admin Notifications

1. Connect as Admin User A
2. Join notifications: `join-notifications` with Admin A's userId
3. Connect as Admin User B (separate socket)
4. Join notifications: `join-notifications` with Admin B's userId
5. Trigger admin notification from backend
6. Verify both admins receive `new-notification` event simultaneously

---

## 📊 Notification Data Structure

### Complete Notification Object

```javascript
{
  _id: ObjectId,                    // Unique notification ID
  user: ObjectId,                   // User who receives notification
  type: String,                     // Notification type (enum)
  title: String,                    // Notification title
  message: String,                  // Notification message
  data: {                           // Additional context data
    jobId: ObjectId,
    quoteId: ObjectId,
    providerName: String,
    clientName: String,
    reason: String
    // ... custom fields
  },
  priority: String,                 // 'low', 'medium', 'high'
  delivered: Boolean,               // Has notification been delivered to client
  deliveredAt: Date,                // When notification was delivered
  read: Boolean,                    // Has user read the notification
  readAt: Date,                     // When user read the notification
  expiresAt: Date,                  // Auto-delete after 30 days
  createdAt: Date,                  // When notification was created
  updatedAt: Date                   // Last update timestamp
}
```

---

## 🎓 Best Practices

### Client Implementation

1. **Always join notifications on connection:**
   ```javascript
   socket.on('connect', () => {
     socket.emit('join-notifications', { userId: currentUserId });
   });
   ```

2. **Handle reconnection:**
   ```javascript
   socket.on('disconnect', () => {
     console.log('Disconnected, will reconnect...');
   });
   ```

3. **Listen for all notification events:**
   ```javascript
   socket.on('notification-joined', handleJoined);
   socket.on('new-notification', handleNewNotification);
   socket.on('notification-read', handleNotificationRead);
   socket.on('all-notifications-read', handleAllRead);
   socket.on('unread-count', handleUnreadCount);
   socket.on('error', handleError);
   ```

4. **Update UI in real-time:**
   - Show notification badge with unread count
   - Display toast/alert for new notifications
   - Update notification list without page refresh

### Backend Integration

1. **Use helper functions:**
   ```javascript
   const { sendNotification, sendAdminNotification } = require('./socket/notificationHandler');
   
   // Send to specific user
   await sendNotification(io, userId, {
     type: 'payment_received',
     title: 'Payment Received',
     message: 'You received $450 for Job #123'
   });
   
   // Send to all admins
   await sendAdminNotification(io, {
     type: 'new_report_submitted',
     title: 'New Report',
     message: 'User reported a provider'
   });
   ```

2. **Always pass `io` instance:**
   - Ensure Socket.IO instance is accessible in controllers
   - Pass via middleware or dependency injection

---

## 📝 Summary

### Supported Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join-notifications` | Client → Server | Register for notifications |
| `notification-joined` | Server → Client | Join successful with unread count |
| `new-notification` | Server → Client | Real-time notification push |
| `mark-notification-read` | Client → Server | Mark single notification as read |
| `notification-read` | Server → Client | Confirmation with updated count |
| `mark-all-notifications-read` | Client → Server | Mark all as read |
| `all-notifications-read` | Server → Client | Confirmation with counts |
| `get-unread-count` | Client → Server | Request unread count |
| `unread-count` | Server → Client | Current unread count |
| `error` | Server → Client | Error message |
| `disconnect` | Client → Server | User disconnected |

### Key Security Features

✅ User-specific rooms prevent cross-user access  
✅ All operations validated against `socket.userId`  
✅ Database queries filter by authenticated user  
✅ Admin notifications use role-based access  
✅ JWT authentication required for connection  

---

## 🆘 Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify authentication token is valid
3. Ensure userId format is correct (MongoDB ObjectId)
4. Test with Postman before implementing in frontend
5. Review [notificationHandler.js](socket/notificationHandler.js) for implementation details

---

**Last Updated:** December 25, 2025  
**Version:** 2.0  
**Author:** Backend Engineering Team
