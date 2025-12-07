# Notification API Documentation

## Overview
The Notification API allows clients and providers to manage their notifications. Users can retrieve notifications, mark them as read, get unread counts, and manage notification preferences.

## Endpoints

### 1. Get User Notifications

**Endpoint**: `GET /api/notifications`

**Authentication**: Required (Bearer Token)

**Description**: Retrieves paginated list of user's notifications with filtering options.

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `type` (string, optional): Filter by notification type
- `priority` (string, optional): Filter by priority ('low', 'medium', 'high')
- `read` (boolean, optional): Filter by read status ('true' or 'false')
- `sortBy` (string, optional): Sort field (default: 'createdAt')
- `sortOrder` (string, optional): Sort order ('asc' or 'desc', default: 'desc')

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "notifications": [
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
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "timeAgo": "Just now"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "current": 1,
      "pages": 3,
      "total": 45
    }
  }
}
```

---

### 2. Get Unread Notification Count

**Endpoint**: `GET /api/notifications/unread/count`

**Authentication**: Required (Bearer Token)

**Description**: Returns the count of unread notifications for the authenticated user.

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

### 3. Mark Notification as Read

**Endpoint**: `PUT /api/notifications/:id/read`

**Authentication**: Required (Bearer Token)

**Description**: Marks a specific notification as read. Users can only mark their own notifications.

**URL Parameters**:
- `id` (string, required): Notification ID

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**: Empty (PUT request)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "507f1f77bcf86cd799439011",
      "user": "507f1f77bcf86cd799439012",
      "type": "quote_accepted",
      "title": "Quote Accepted",
      "message": "Your quote has been accepted by John Client",
      "read": true,
      "readAt": "2024-01-15T10:35:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    }
  }
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "success": false,
  "message": "Notification not found or access denied"
}
```

---

### 4. Mark All Notifications as Read

**Endpoint**: `PUT /api/notifications/mark-all-read`

**Authentication**: Required (Bearer Token)

**Description**: Marks all unread notifications as read for the authenticated user.

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**: Empty (PUT request)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 5
  }
}
```

---

### 5. Delete Notification

**Endpoint**: `DELETE /api/notifications/:id`

**Authentication**: Required (Bearer Token)

**Description**: Deletes a specific notification. Users can only delete their own notifications.

**URL Parameters**:
- `id` (string, required): Notification ID

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**: None (DELETE request)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "success": false,
  "message": "Notification not found or access denied"
}
```

---

## Notification Types

The system supports the following notification types:

### For Providers:
- `new_quote` - New quote submitted for a job
- `quote_accepted` - Provider's quote was accepted
- `quote_declined` - Provider's quote was declined
- `quote_updated` - Provider's quote was updated
- `quote_cancelled` - Provider's quote was cancelled
- `job_cancelled` - Job was cancelled by client
- `payment_successful` - Payment was successful
- `payment_received` - Payment was received
- `payment_confirmed` - Payment was confirmed
- `payment_failed` - Payment failed
- `refund_processed` - Refund was processed
- `verification_approved` - Provider verification approved
- `verification_rejected` - Provider verification rejected
- `account_blocked` - Account was blocked
- `account_unblocked` - Account was unblocked
- `stripe_account_verified` - Stripe account verified
- `subscription_activated` - Subscription activated
- `credits_added` - Credits were added
- `payment_released` - Payment was released
- `job_completed` - Job was completed

### For Clients:
- `quote_accepted` - Client's quote acceptance confirmed
- `quote_declined` - Client's quote was declined
- `quote_updated` - Client's quote was updated
- `quote_cancelled` - Client's quote was cancelled
- `job_cancelled` - Client cancelled their job
- `payment_successful` - Payment was successful
- `payment_received` - Payment was received
- `payment_confirmed` - Payment was confirmed
- `payment_failed` - Payment failed
- `refund_processed` - Refund was processed
- `support_message` - New support message
- `new_support_ticket` - New support ticket created
- `account_blocked` - Account was blocked
- `account_unblocked` - Account was unblocked
- `job_completed` - Job was completed

### System Notifications (Both):
- `system_alert` - System maintenance, updates, etc.

---

## Postman Collection Examples

### Example 1: Get Notifications

```json
{
  "name": "Get User Notifications",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      }
    ],
    "url": {
      "raw": "http://localhost:5000/api/notifications?page=1&limit=10&read=false",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "notifications"],
      "query": [
        {
          "key": "page",
          "value": "1"
        },
        {
          "key": "limit",
          "value": "10"
        },
        {
          "key": "read",
          "value": "false"
        }
      ]
    }
  }
}
```

### Example 2: Get Unread Count

```json
{
  "name": "Get Unread Notification Count",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      }
    ],
    "url": {
      "raw": "http://localhost:5000/api/notifications/unread/count",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "notifications", "unread", "count"]
    }
  }
}
```

### Example 3: Mark Notification as Read

```json
{
  "name": "Mark Notification as Read",
  "request": {
    "method": "PUT",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      }
    ],
    "url": {
      "raw": "http://localhost:5000/api/notifications/507f1f77bcf86cd799439011/read",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "notifications", "507f1f77bcf86cd799439011", "read"]
    }
  }
}
```

### Example 4: Mark All as Read

```json
{
  "name": "Mark All Notifications as Read",
  "request": {
    "method": "PUT",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      }
    ],
    "url": {
      "raw": "http://localhost:5000/api/notifications/mark-all-read",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "notifications", "mark-all-read"]
    }
  }
}
```

### Example 5: Delete Notification

```json
{
  "name": "Delete Notification",
  "request": {
    "method": "DELETE",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "type": "text"
      }
    ],
    "url": {
      "raw": "http://localhost:5000/api/notifications/507f1f77bcf86cd799439011",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "notifications", "507f1f77bcf86cd799439011"]
    }
  }
}
```

---

## Filtering Examples

### Get High Priority Unread Notifications
```
GET /api/notifications?priority=high&read=false
```

### Get Quote-Related Notifications
```
GET /api/notifications?type=quote_accepted
```

### Get Recent Notifications (Last 24 hours)
```
GET /api/notifications?sortBy=createdAt&sortOrder=desc
```

### Get Payment Notifications
```
GET /api/notifications?type=payment_successful
```

---

## Implementation Details

### Files Created

1. **controllers/notificationController.js**
   - `getNotifications()` - Get paginated notifications
   - `getUnreadCount()` - Get unread count
   - `markNotificationAsRead()` - Mark single notification read
   - `markAllNotificationsAsRead()` - Mark all notifications read
   - `deleteNotification()` - Delete notification

2. **routes/api/notificationRoutes.js**
   - Routes for all notification endpoints
   - Protected with authentication middleware

3. **routes/api/index.js**
   - Added notification routes to main router

### Security Features

- All endpoints require authentication
- Users can only access their own notifications
- Security checks prevent unauthorized access to other users' notifications

### Database Schema

Notifications are stored in MongoDB with automatic expiration after 30 days.

### Pagination

- Default page size: 20 notifications
- Supports custom page sizes
- Returns total count and pagination metadata

---

## Testing Checklist

- [ ] Get notifications with pagination
- [ ] Filter by type, priority, read status
- [ ] Get unread count
- [ ] Mark single notification as read
- [ ] Mark all notifications as read
- [ ] Delete notification
- [ ] Security: Cannot access other users' notifications
- [ ] Real-time notifications work with socket events
- [ ] Proper error handling for invalid IDs
- [ ] Proper error handling for unauthorized access