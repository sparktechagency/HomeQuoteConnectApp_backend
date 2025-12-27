# 🚀 Quick Reference - Notification System

## Socket.IO Events - Cheat Sheet

### 📥 Client → Server Events

#### 1️⃣ Join Notifications (Required First!)
```javascript
socket.emit('join-notifications', { userId: "USER_ID_HERE" });
// OR
socket.emit('join-notifications', "USER_ID_HERE");
```

#### 2️⃣ Mark Single Notification as Read
```javascript
socket.emit('mark-notification-read', { 
  notificationId: "NOTIFICATION_ID_HERE" 
});
```

#### 3️⃣ Mark All Notifications as Read
```javascript
socket.emit('mark-all-notifications-read');
```

#### 4️⃣ Get Unread Count
```javascript
socket.emit('get-unread-count');
```

---

### 📤 Server → Client Events

#### 1️⃣ Notification Joined (Success Response)
```javascript
socket.on('notification-joined', (data) => {
  console.log(data.message);        // "Successfully joined notification room"
  console.log(data.unreadCount);    // 5
});
```

#### 2️⃣ New Notification (Real-time Push)
```javascript
socket.on('new-notification', (notification) => {
  console.log(notification.type);     // "new_quote"
  console.log(notification.title);    // "New Quote Received"
  console.log(notification.message);  // "You received a quote..."
  console.log(notification.data);     // { jobId, quoteId, ... }
});
```

#### 3️⃣ Notification Read (Confirmation)
```javascript
socket.on('notification-read', (data) => {
  console.log(data.notificationId);  // "65f8a..."
  console.log(data.unreadCount);     // 4
});
```

#### 4️⃣ All Notifications Read (Confirmation)
```javascript
socket.on('all-notifications-read', (data) => {
  console.log(data.success);        // true
  console.log(data.markedCount);    // 12
  console.log(data.unreadCount);    // 0
});
```

#### 5️⃣ Unread Count (Response)
```javascript
socket.on('unread-count', (data) => {
  console.log(data.count);  // 5
});
```

#### 6️⃣ Error (Any Operation)
```javascript
socket.on('error', (error) => {
  console.error(error.message);  // "Please join notifications first"
});
```

---

## 🔐 Security Rules

✅ **DO:**
- Always call `join-notifications` first
- Use `socket.userId` on server (automatically set)
- Trust server responses

❌ **DON'T:**
- Don't skip `join-notifications`
- Don't pass userId in `get-unread-count` (ignored for security)
- Don't try to access other users' notifications

---

## 🧪 Postman Quick Test

### Step 1: Connect
```
URL: ws://localhost:5000
Auth: { "token": "YOUR_JWT_TOKEN" }
```

### Step 2: Listen for Events
```
✓ notification-joined
✓ new-notification
✓ notification-read
✓ all-notifications-read
✓ unread-count
✓ error
```

### Step 3: Test Flow
```
1. Emit: join-notifications
2. Emit: get-unread-count
3. Emit: mark-notification-read
4. Emit: mark-all-notifications-read
5. Emit: get-unread-count (verify 0)
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Please join notifications first" | Call `join-notifications` first |
| "Notification not found" | Check notificationId is correct |
| Not receiving notifications | Verify you joined with correct userId |
| Count not updating | Call `get-unread-count` after operations |

---

## 💻 Frontend Implementation Example

```javascript
// Initialize Socket.IO
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});

// On connection
socket.on('connect', () => {
  socket.emit('join-notifications', { 
    userId: currentUser._id 
  });
});

// Listen for join confirmation
socket.on('notification-joined', ({ unreadCount }) => {
  updateBadge(unreadCount);
});

// Listen for new notifications
socket.on('new-notification', (notification) => {
  showToast(notification.title, notification.message);
  playSound();
  addToNotificationList(notification);
  updateBadge();
});

// Mark as read
function markAsRead(notificationId) {
  socket.emit('mark-notification-read', { notificationId });
}

// Listen for read confirmation
socket.on('notification-read', ({ unreadCount }) => {
  updateBadge(unreadCount);
});

// Mark all as read
function markAllAsRead() {
  socket.emit('mark-all-notifications-read');
}

// Listen for all read confirmation
socket.on('all-notifications-read', ({ markedCount }) => {
  updateBadge(0);
  showToast(`Marked ${markedCount} notifications as read`);
});

// Get unread count
function refreshUnreadCount() {
  socket.emit('get-unread-count');
}

// Listen for unread count
socket.on('unread-count', ({ count }) => {
  updateBadge(count);
});

// Handle errors
socket.on('error', ({ message }) => {
  console.error('Notification error:', message);
  showError(message);
});

// Handle reconnection
socket.on('reconnect', () => {
  socket.emit('join-notifications', { 
    userId: currentUser._id 
  });
});
```

---

## 📚 Full Documentation

- **Complete Guide:** `NOTIFICATION_SOCKET_TESTING_GUIDE.md`
- **Bug Fixes:** `NOTIFICATION_FIXES_SUMMARY.md`
- **Source Code:** `socket/notificationHandler.js`

---

**Last Updated:** December 25, 2025
