# Block/Unblock Chat Functionality - API Documentation

## Overview
The block/unblock functionality allows users to prevent other participants in a chat from sending messages. Only the blocker can unblock the user.

## Features
- **Block User**: Prevents both users from sending messages in a specific chat
- **Unblock User**: Removes the block and allows messages to be sent again
- **Authorization**: Only the blocker can unblock the user
- **Validation**: Prevents blocking the same user twice
- **Bidirectional Prevention**: Both the blocked user AND the blocker cannot send messages until unblocked
- **Message Prevention**: Blocked users cannot send messages, and the blocker also cannot send messages until they unblock

---

## Endpoints

### 1. Block a User in Chat

**Endpoint**: `POST /api/chats/:id/block`

**Authentication**: Required (Bearer Token)

**Description**: Blocks another user in a specific chat, preventing them from sending messages.

**URL Parameters**:
- `id` (string, required): The chat ID

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**: Empty (no body required)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "User blocked successfully",
  "data": {
    "chatId": "507f1f77bcf86cd799439011",
    "blockedUser": "507f1f77bcf86cd799439012",
    "blockedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "success": false,
  "message": "Chat not found"
}
```

**403 Forbidden** (Not authorized to block in this chat):
```json
{
  "success": false,
  "message": "Not authorized to block in this chat"
}
```

**400 Bad Request** (Already blocked):
```json
{
  "success": false,
  "message": "User is already blocked"
}
```

---

### 2. Unblock a User in Chat

**Endpoint**: `POST /api/chats/:id/unblock`

**Authentication**: Required (Bearer Token)

**Description**: Unblocks a previously blocked user in a specific chat, allowing them to send messages again.

**URL Parameters**:
- `id` (string, required): The chat ID

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**: Empty (no body required)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "User unblocked successfully",
  "data": {
    "chatId": "507f1f77bcf86cd799439011",
    "unblockedUser": "507f1f77bcf86cd799439012",
    "unblockedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "success": false,
  "message": "Chat not found"
}
```

**403 Forbidden** (Not authorized to unblock in this chat):
```json
{
  "success": false,
  "message": "Not authorized to unblock in this chat"
}
```

**400 Bad Request** (User is not blocked):
```json
{
  "success": false,
  "message": "User is not blocked"
}
```

---

## Send Message Validation

### User Attempting to Send Message to Blocker

When a blocked user tries to send a message to their blocker:

**Endpoint**: `POST /api/chats/:id/messages`

**Error Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "You cannot send messages to this user as they have blocked you"
}
```

### Blocker Attempting to Send Message to Blocked User

When the blocker tries to send a message to the blocked user:

**Endpoint**: `POST /api/chats/:id/messages`

**Error Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "You cannot send messages to a user you have blocked. Unblock them first."
}
```

---

## Postman Collection Examples

### Example 1: Block a User

```json
{
  "info": {
    "name": "Block User",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Block User in Chat",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/chats/507f1f77bcf86cd799439011/block",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "chats", "507f1f77bcf86cd799439011", "block"]
        }
      }
    }
  ]
}
```

---

### Example 2: Unblock a User

```json
{
  "name": "Unblock User in Chat",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      },
      {
        "key": "Content-Type",
        "value": "application/json",
        "type": "text"
      }
    ],
    "url": {
      "raw": "http://localhost:5000/api/chats/507f1f77bcf86cd799439011/unblock",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "chats", "507f1f77bcf86cd799439011", "unblock"]
    }
  }
}
```

---

### Example 3: Blocked User Sending Message (Error)

```json
{
  "name": "Send Message as Blocked User",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      },
      {
        "key": "Content-Type",
        "value": "application/json",
        "type": "text"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"content\": \"Hello, how are you?\",\n  \"messageType\": \"text\"\n}"
    },
    "url": {
      "raw": "http://localhost:5000/api/chats/507f1f77bcf86cd799439011/messages",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "chats", "507f1f77bcf86cd799439011", "messages"]
    }
  }
}
```

**Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "You cannot send messages to this user as they have blocked you"
}
```

---

## Database Schema

### Chat Model Update

The `blockedUsers` field has been added to track blocked users:

```javascript
blockedUsers: [
  {
    blockedBy: ObjectId,        // User who initiated the block
    blockedUser: ObjectId,      // User who is blocked
    blockedAt: Date             // Timestamp of when block occurred
  }
]
```

**Example Chat Document**:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "participants": [
    {
      "user": "507f1f77bcf86cd799439012",
      "role": "client",
      "lastRead": "2024-01-15T10:00:00.000Z"
    },
    {
      "user": "507f1f77bcf86cd799439013",
      "role": "provider",
      "lastRead": "2024-01-15T09:00:00.000Z"
    }
  ],
  "job": "507f1f77bcf86cd799439014",
  "quote": null,
  "isActive": true,
  "blockedUsers": [
    {
      "blockedBy": "507f1f77bcf86cd799439012",
      "blockedUser": "507f1f77bcf86cd799439013",
      "blockedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "createdAt": "2024-01-10T08:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## Business Logic

### Block User Rules
1. User must be a participant in the chat
2. User can only block the other participant
3. Cannot block the same user twice
4. Only one direction can be blocked per user pair (User A can block User B, User B can independently block User A)

### Unblock User Rules
1. User must be a participant in the chat
2. Only the blocker can unblock the user
3. User must be blocked to unblock
4. Unblocking removes the block entry for that specific user pair

### Message Sending Rules
1. **Blocked User Cannot Send**: If User B is blocked by User A, User B cannot send messages to User A
2. **Blocker Cannot Send**: If User A has blocked User B, User A also cannot send messages to User B
3. **Both Directions Blocked**: When blocked, neither party can communicate until the blocker unblocks
4. **Error Messages**:
   - Blocked user trying to send: "You cannot send messages to this user as they have blocked you"
   - Blocker trying to send: "You cannot send messages to a user you have blocked. Unblock them first."
5. **Applies To**: Both regular chat messages and direct messages to providers

---

## Implementation Details

### Files Modified

1. **models/Chat.js**
   - Added `blockedUsers` array field to schema

2. **controllers/chatController.js**
   - Added `blockUser()` function
   - Added `unblockUser()` function
   - Added block validation in `sendMessage()`
   - Added block validation in `sendDirectMessageToProvider()`
   - Exported new functions

3. **routes/api/chatRoutes.js**
   - Added `POST /api/chats/:id/block` route
   - Added `POST /api/chats/:id/unblock` route
   - Imported new controller functions

---

## Usage Workflow

### Step 1: User A Blocks User B in a Chat

```bash
POST /api/chats/507f1f77bcf86cd799439011/block
Authorization: Bearer {userAToken}
```

Response:
```json
{
  "success": true,
  "message": "User blocked successfully",
  "data": {
    "chatId": "507f1f77bcf86cd799439011",
    "blockedUser": "507f1f77bcf86cd799439013",
    "blockedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Step 2: User B Attempts to Send Message (Fails)

```bash
POST /api/chats/507f1f77bcf86cd799439011/messages
Authorization: Bearer {userBToken}
Content-Type: application/json

{
  "content": "Hello?",
  "messageType": "text"
}
```

Response:
```json
{
  "success": false,
  "message": "You cannot send messages to this user as they have blocked you"
}
```

### Step 2b: User A Also Cannot Send Messages (Blocked User)

```bash
POST /api/chats/507f1f77bcf86cd799439011/messages
Authorization: Bearer {userAToken}
Content-Type: application/json

{
  "content": "Are you there?",
  "messageType": "text"
}
```

Response:
```json
{
  "success": false,
  "message": "You cannot send messages to a user you have blocked. Unblock them first."
}
```

### Step 3: User A Unblocks User B

```bash
POST /api/chats/507f1f77bcf86cd799439011/unblock
Authorization: Bearer {userAToken}
```

Response:
```json
{
  "success": true,
  "message": "User unblocked successfully",
  "data": {
    "chatId": "507f1f77bcf86cd799439011",
    "unblockedUser": "507f1f77bcf86cd799439013",
    "unblockedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

### Step 4: Both Users Can Now Send Messages

User A sends a message:
```bash
POST /api/chats/507f1f77bcf86cd799439011/messages
Authorization: Bearer {userAToken}
Content-Type: application/json

{
  "content": "Hi, I've unblocked you",
  "messageType": "text"
}
```

Response:
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": { ... }
}
```

User B sends a message:
```bash
POST /api/chats/507f1f77bcf86cd799439011/messages
Authorization: Bearer {userBToken}
Content-Type: application/json

{
  "content": "Great, thanks for unblocking!",
  "messageType": "text"
}
```

Response:
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": { ... }
}
```

---

## Error Handling

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Chat not found | 404 | "Chat not found" |
| User not in chat | 403 | "Not authorized to block in this chat" OR "Not authorized to unblock in this chat" |
| User already blocked | 400 | "User is already blocked" |
| User not blocked | 400 | "User is not blocked" |
| Blocked user sending message | 403 | "You cannot send messages to this user as they have blocked you" |
| Blocker trying to send message | 403 | "You cannot send messages to a user you have blocked. Unblock them first." |
| Server error | 500 | "Error blocking user" OR "Error unblocking user" |

---

## Testing Checklist

- [ ] Block user successfully
- [ ] Cannot block same user twice
- [ ] Only blocker can unblock
- [ ] Cannot unblock non-blocked user
- [ ] Blocked user cannot send message
- [ ] **Blocker cannot send message to blocked user**
- [ ] After unblock, both users can send messages
- [ ] Only participants in chat can block/unblock
- [ ] Bidirectional blocking works (A blocks B, neither can message)
- [ ] Proper error messages for both blocked party and blocker
- [ ] Block/unblock events reflect in database
