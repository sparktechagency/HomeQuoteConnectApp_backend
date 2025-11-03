 🔌 Real-Time Socket.IO Integration (Backend Documentation)

This document describes the **Socket.IO integration** for real-time features such as **chat messaging**, **notifications**, and **user online status** in the application.

It provides a complete guide for frontend developers to connect, join rooms, and handle socket events efficiently.

---

## ⚙️ Overview

The backend uses three main socket handlers:

| Handler File | Purpose |
|---------------|----------|
| `socket/chatHandler.js` | Handles real-time messaging between users (clients ↔ providers). |
| `socket/notificationHandler.js` | Manages user notifications in real-time. |
| `socket/socketHandler.js` | Tracks user connection status (online/offline), manages personal rooms, and broadcasts updates. |

All socket events are namespaced within the same `io` instance.

---

## 🚀 Socket Connection Flow

1. Frontend connects to the socket server:
   ```js
   const socket = io("http://10.10.20.30:5000");
After authentication, the frontend must identify the user:

js
Copy code
socket.emit("user-join", userId);
Then the user can:

Join chat rooms

Join notification rooms

Send messages

Receive notifications

Listen for online status updates

💬 Chat Events (socket/chatHandler.js)
🔹 Join a Chat Room
Join a specific chat to start receiving messages.

js
Copy code
socket.emit("join-chat", chatId);
Backend action:

User joins room chatId

Marks undelivered messages as delivered: true

🔹 Leave a Chat Room
js
Copy code
socket.emit("leave-chat", chatId);
Effect: User leaves the specified room.

🔹 Send a Message
js
Copy code
socket.emit("send-message", {
  chatId: "CHAT_ID",
  content: "Hello there!",
  messageType: "text", // or "image", "file", etc.
  media: [] // optional media array
});
Backend actions:

Validates user participation

Checks client-provider message rules

Saves message to DB

Emits:

new-message → to all users in chat room

message-notification → to receiver’s personal room

Receiver Side Listener:

js
Copy code
socket.on("new-message", (message) => {
  console.log("New message received:", message);
});
🔹 Typing Indicators
Notify chat participants when user is typing.

js
Copy code
// When user starts typing
socket.emit("typing-start", { chatId });

// When user stops typing
socket.emit("typing-stop", { chatId });
Frontend listener:

js
Copy code
socket.on("user-typing", ({ userId, isTyping }) => {
  console.log(`${userId} is ${isTyping ? "typing..." : "not typing"}`);
});
🔹 Mark Messages as Read
js
Copy code
socket.emit("mark-messages-read", { chatId });
Backend action:

Marks all unread messages as read.

Emits:

js
Copy code
socket.on("messages-read", ({ userId, chatId }) => {
  console.log(`${userId} read all messages in chat ${chatId}`);
});
🔹 Get User Online Status
js
Copy code
socket.emit("get-online-status", userId);
Response:

js
Copy code
socket.on("online-status", ({ userId, isOnline, lastActive }) => {
  console.log(userId, isOnline, lastActive);
});
🔔 Notification Events (socket/notificationHandler.js)
🔹 Join Notification Room
js
Copy code
socket.emit("join-notifications", userId);
Effect:

Joins room notifications_userId

Marks undelivered notifications as delivered

🔹 Receive New Notifications
Frontend listener:

js
Copy code
socket.on("new-notification", (notification) => {
  console.log("New Notification:", notification);
});
🔹 Mark a Notification as Read
js
Copy code
socket.emit("mark-notification-read", { notificationId });
Response:

js
Copy code
socket.on("notification-read", ({ notificationId }) => {
  console.log("Notification read:", notificationId);
});
🔹 Mark All Notifications as Read
js
Copy code
socket.emit("mark-all-notifications-read", userId);
Response:

js
Copy code
socket.on("all-notifications-read", () => {
  console.log("All notifications marked as read");
});
🔹 Get Unread Notification Count
js
Copy code
socket.emit("get-unread-count", userId);
Response:

js
Copy code
socket.on("unread-count", ({ count }) => {
  console.log("Unread notifications:", count);
});
🟢 User Connection & Status (socket/socketHandler.js)
🔹 Join Personal Socket Room
js
Copy code
socket.emit("user-join", userId);
Effect:

Adds user to personal room (userId)

Updates User.isOnline = true

Broadcasts:

js
Copy code
socket.on("user-status-changed", ({ userId, isOnline, lastActive }) => {
  console.log(`${userId} is ${isOnline ? "online" : "offline"}`);
});
🔹 Disconnect (Handled Automatically)
When socket disconnects:

Removes connection from connectedUsers map

If no connections remain:

Updates isOnline = false

Broadcasts user-status-changed

🔹 Manually Set Online/Offline Status
js
Copy code
socket.emit("set-online-status", {
  userId,
  isOnline: false
});
Broadcasts:

js
Copy code
socket.on("user-status-changed", ({ userId, isOnline }) => {
  console.log(`${userId} is now ${isOnline ? "online" : "offline"}`);
});
🔹 Typing Indicators (Global)
Same as in chat handler:

js
Copy code
socket.emit("typing-start", { roomId, userId });
socket.emit("typing-stop", { roomId, userId });
🧩 Helper Functions (Backend)
Function	Description
sendNotification(io, userId, data)	Creates and sends a notification to user’s notification room
sendNotificationToUser(io, userId, notification)	Directly emits a prepared notification
isUserOnline(userId)	Returns whether a user currently has an active socket connection

🧠 Notes for Frontend Team
Always emit user-join immediately after socket connection.

Use chatId for chat room events and userId for notification rooms.

Handle both new-message and message-notification for full real-time sync.

Backend automatically manages:

Delivery (delivered: true)

Read receipts (isRead: true)

Online/offline state tracking

📡 Example Integration Flow (Client)
js
Copy code
import { io } from "socket.io-client";

const socket = io("http://10.10.20.30:5000");

// Step 1: Identify User
socket.emit("user-join", currentUserId);

// Step 2: Join Notification Room
socket.emit("join-notifications", currentUserId);

// Step 3: Join Chat Room
socket.emit("join-chat", chatId);

// Step 4: Listen for Events
socket.on("new-message", console.log);
socket.on("new-notification", console.log);
socket.on("user-status-changed", console.log);
🧾 License
This code is part of a private backend system .
Unauthorized use or reproduction is prohibited.

✍️ Maintained by:
Backend Developer: MD Mehedi hasan Akash
Stack: Node.js, Express.js, MongoDB, Socket.IO