# Admin Credit Management API Documentation

## Overview
This document provides comprehensive information about the Admin Credit Management System endpoints. The system allows administrators to:
- Configure signup credits for new providers
- Adjust credits for any user at any time
- View credit statistics and history
- Perform bulk credit adjustments
- Control all credit-related settings from the admin panel

**Base URL**: `https://your-api-domain.com/api`

**Authentication**: All endpoints require admin authentication. Include the admin JWT token in the Authorization header.

---

## Table of Contents
1. [System Settings](#system-settings)
   - [Get Credit Settings](#1-get-credit-settings)
   - [Update Credit Settings](#2-update-credit-settings)
2. [User Credit Management](#user-credit-management)
   - [Get User Credit Details](#3-get-user-credit-details)
   - [Adjust User Credits](#4-adjust-user-credits)
   - [Bulk Adjust Credits](#5-bulk-adjust-credits)
3. [Credit Statistics & History](#credit-statistics--history)
   - [Get Credit Statistics](#6-get-credit-statistics)
   - [Get Credit Activity History](#7-get-credit-activity-history)

---

## System Settings

### 1. Get Credit Settings

Retrieve current system credit configuration.

**Endpoint**: `GET /api/admin/credits/settings`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Example**:
```bash
GET /api/admin/credits/settings
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Credit settings retrieved successfully",
  "data": {
    "signupCredits": 50,
    "verificationCredits": 0,
    "lastUpdated": "2026-01-11T10:30:00.000Z",
    "updatedBy": "60d5ec49f1b2c8b1f8c8e8e8"
  }
}
```

**Postman Setup**:
- Method: `GET`
- URL: `{{baseUrl}}/api/admin/credits/settings`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`

---

### 2. Update Credit Settings

Update system-wide credit configuration (signup credits, verification credits).

**Endpoint**: `PUT /api/admin/credits/settings`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "signupCredits": 75,
  "verificationCredits": 0
}
```

**Parameters**:
| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| signupCredits | Number | Optional | Credits given to new providers on signup | 0-1000 |
| verificationCredits | Number | Optional | Credits given on verification (deprecated) | 0-1000 |

**Request Example**:
```bash
PUT /api/admin/credits/settings
Content-Type: application/json

{
  "signupCredits": 75,
  "verificationCredits": 0
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Credit settings updated successfully",
  "data": {
    "signupCredits": 75,
    "verificationCredits": 0,
    "lastUpdated": "2026-01-11T11:15:00.000Z"
  }
}
```

**Response Error (400)**:
```json
{
  "success": false,
  "message": "Signup credits must be a number between 0 and 1000"
}
```

**Postman Setup**:
- Method: `PUT`
- URL: `{{baseUrl}}/api/admin/credits/settings`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "signupCredits": 75,
  "verificationCredits": 0
}
```

---

## User Credit Management

### 3. Get User Credit Details

Get a specific user's credit balance and transaction history.

**Endpoint**: `GET /api/admin/credits/user/:userId`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | String | Yes | MongoDB ObjectId of the user |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | Number | No | 1 | Page number for pagination |
| limit | Number | No | 20 | Items per page |

**Request Example**:
```bash
GET /api/admin/credits/user/60d5ec49f1b2c8b1f8c8e8e8?page=1&limit=20
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "User credit information retrieved successfully",
  "data": {
    "user": {
      "_id": "60d5ec49f1b2c8b1f8c8e8e8",
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "provider",
      "profilePhoto": {
        "url": "https://cloudinary.com/photo.jpg"
      },
      "currentBalance": 125
    },
    "activities": [
      {
        "_id": "60d5ec49f1b2c8b1f8c8e8e9",
        "creditChange": 50,
        "newBalance": 125,
        "type": "bonus",
        "description": "Admin credit adjustment - Performance bonus",
        "createdAt": "2026-01-11T10:00:00.000Z",
        "metadata": {
          "adjustedBy": "60d5ec49f1b2c8b1f8c8e8f0",
          "adjustedByName": "Admin User"
        }
      },
      {
        "_id": "60d5ec49f1b2c8b1f8c8e8ea",
        "creditChange": 75,
        "newBalance": 75,
        "type": "bonus",
        "description": "Signup bonus",
        "createdAt": "2026-01-10T09:00:00.000Z"
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 1,
      "total": 2
    }
  }
}
```

**Response Error (404)**:
```json
{
  "success": false,
  "message": "User not found"
}
```

**Postman Setup**:
- Method: `GET`
- URL: `{{baseUrl}}/api/admin/credits/user/{{userId}}`
- Params:
  - `page`: `1`
  - `limit`: `20`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`

---

### 4. Adjust User Credits

Manually increase or decrease credits for a specific user.

**Endpoint**: `POST /api/admin/credits/adjust`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "userId": "60d5ec49f1b2c8b1f8c8e8e8",
  "creditChange": 50,
  "reason": "Performance bonus for completing 10 jobs",
  "type": "bonus"
}
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | String | Yes | MongoDB ObjectId of the user |
| creditChange | Number | Yes | Amount to add (positive) or deduct (negative) |
| reason | String | Yes | Explanation for the credit adjustment |
| type | String | No | Activity type: 'bonus', 'refund', 'adjustment' (default: 'bonus') |

**Request Examples**:

**Example 1: Add Credits**
```bash
POST /api/admin/credits/adjust
Content-Type: application/json

{
  "userId": "60d5ec49f1b2c8b1f8c8e8e8",
  "creditChange": 100,
  "reason": "Promotional bonus for top-rated provider",
  "type": "bonus"
}
```

**Example 2: Deduct Credits**
```bash
POST /api/admin/credits/adjust
Content-Type: application/json

{
  "userId": "60d5ec49f1b2c8b1f8c8e8e8",
  "creditChange": -25,
  "reason": "Correction for duplicate credit assignment",
  "type": "adjustment"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "User credits adjusted successfully",
  "data": {
    "userId": "60d5ec49f1b2c8b1f8c8e8e8",
    "userName": "John Doe",
    "email": "john@example.com",
    "previousBalance": 75,
    "creditChange": 100,
    "newBalance": 175,
    "reason": "Promotional bonus for top-rated provider"
  }
}
```

**Response Error (400)**:
```json
{
  "success": false,
  "message": "Credits can only be adjusted for providers"
}
```

**Response Error (404)**:
```json
{
  "success": false,
  "message": "User not found"
}
```

**Postman Setup**:
- Method: `POST`
- URL: `{{baseUrl}}/api/admin/credits/adjust`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "userId": "60d5ec49f1b2c8b1f8c8e8e8",
  "creditChange": 100,
  "reason": "Promotional bonus for top-rated provider",
  "type": "bonus"
}
```

---

### 5. Bulk Adjust Credits

Adjust credits for multiple users in a single operation.

**Endpoint**: `POST /api/admin/credits/bulk-adjust`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "adjustments": [
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8e8",
      "creditChange": 50
    },
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8e9",
      "creditChange": 50
    },
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8ea",
      "creditChange": 75
    }
  ],
  "reason": "Monthly promotional bonus for active providers"
}
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| adjustments | Array | Yes | Array of objects containing userId and creditChange |
| adjustments[].userId | String | Yes | MongoDB ObjectId of the user |
| adjustments[].creditChange | Number | Yes | Amount to add or deduct |
| reason | String | Yes | Common reason for all adjustments |

**Request Example**:
```bash
POST /api/admin/credits/bulk-adjust
Content-Type: application/json

{
  "adjustments": [
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8e8",
      "creditChange": 50
    },
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8e9",
      "creditChange": 50
    }
  ],
  "reason": "Q1 2026 Performance Bonus"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Bulk credit adjustment completed",
  "data": {
    "totalProcessed": 2,
    "successful": 2,
    "failed": 0,
    "results": {
      "successful": [
        {
          "userId": "60d5ec49f1b2c8b1f8c8e8e8",
          "userName": "John Doe",
          "previousBalance": 125,
          "creditChange": 50,
          "newBalance": 175
        },
        {
          "userId": "60d5ec49f1b2c8b1f8c8e8e9",
          "userName": "Jane Smith",
          "previousBalance": 200,
          "creditChange": 50,
          "newBalance": 250
        }
      ],
      "failed": []
    }
  }
}
```

**Response with Partial Success (200)**:
```json
{
  "success": true,
  "message": "Bulk credit adjustment completed",
  "data": {
    "totalProcessed": 3,
    "successful": 2,
    "failed": 1,
    "results": {
      "successful": [
        {
          "userId": "60d5ec49f1b2c8b1f8c8e8e8",
          "userName": "John Doe",
          "previousBalance": 125,
          "creditChange": 50,
          "newBalance": 175
        }
      ],
      "failed": [
        {
          "userId": "60d5ec49f1b2c8b1f8c8e8ea",
          "error": "User not found"
        }
      ]
    }
  }
}
```

**Postman Setup**:
- Method: `POST`
- URL: `{{baseUrl}}/api/admin/credits/bulk-adjust`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "adjustments": [
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8e8",
      "creditChange": 50
    },
    {
      "userId": "60d5ec49f1b2c8b1f8c8e8e9",
      "creditChange": 50
    }
  ],
  "reason": "Q1 2026 Performance Bonus"
}
```

---

## Credit Statistics & History

### 6. Get Credit Statistics

Get comprehensive statistics about credit usage across the platform.

**Endpoint**: `GET /api/admin/credits/statistics`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Example**:
```bash
GET /api/admin/credits/statistics
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Credit statistics retrieved successfully",
  "data": {
    "totalCreditsDistributed": 15750,
    "totalCreditsUsed": 8420,
    "currentCreditsInCirculation": 7330,
    "creditsByType": [
      {
        "_id": "bonus",
        "totalChange": 12500,
        "count": 250
      },
      {
        "_id": "purchase",
        "totalChange": 3250,
        "count": 45
      },
      {
        "_id": "quote_submission",
        "totalChange": -8420,
        "count": 842
      }
    ],
    "topUsersByCredits": [
      {
        "_id": "60d5ec49f1b2c8b1f8c8e8e8",
        "fullName": "John Doe",
        "email": "john@example.com",
        "credits": 450,
        "profilePhoto": {
          "url": "https://cloudinary.com/photo.jpg"
        }
      },
      {
        "_id": "60d5ec49f1b2c8b1f8c8e8e9",
        "fullName": "Jane Smith",
        "email": "jane@example.com",
        "credits": 380,
        "profilePhoto": {
          "url": "https://cloudinary.com/photo2.jpg"
        }
      }
    ]
  }
}
```

**Postman Setup**:
- Method: `GET`
- URL: `{{baseUrl}}/api/admin/credits/statistics`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`

---

### 7. Get Credit Activity History

Get paginated list of all credit activities across the platform.

**Endpoint**: `GET /api/admin/credits`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | Number | No | 1 | Page number |
| limit | Number | No | 20 | Items per page (max 100) |
| type | String | No | 'purchase' | Filter by activity type: 'purchase', 'bonus', 'refund', 'quote_submission', 'adjustment', 'subscription' |
| search | String | No | - | Search by user name or email |
| sortBy | String | No | 'createdAt' | Field to sort by |
| sortOrder | String | No | 'desc' | Sort order: 'asc' or 'desc' |

**Request Example**:
```bash
GET /api/admin/credits?page=1&limit=20&type=bonus&sortOrder=desc
```

**Response Success (200)**:
```json
{
  "success": true,
  "data": {
    "credits": [
      {
        "_id": "60d5ec49f1b2c8b1f8c8e8eb",
        "creditChange": 50,
        "newBalance": 125,
        "type": "bonus",
        "description": "Admin credit adjustment - Performance bonus",
        "createdAt": "2026-01-11T10:00:00.000Z",
        "user": {
          "_id": "60d5ec49f1b2c8b1f8c8e8e8",
          "fullName": "John Doe",
          "email": "john@example.com",
          "profilePhoto": {
            "url": "https://cloudinary.com/photo.jpg"
          },
          "role": "provider"
        },
        "metadata": {
          "adjustedBy": "60d5ec49f1b2c8b1f8c8e8f0",
          "adjustedByName": "Admin User",
          "adjustedAt": "2026-01-11T10:00:00.000Z"
        }
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 95
    }
  }
}
```

**Postman Setup**:
- Method: `GET`
- URL: `{{baseUrl}}/api/admin/credits`
- Params:
  - `page`: `1`
  - `limit`: `20`
  - `type`: `bonus`
  - `sortOrder`: `desc`
- Headers: 
  - `Authorization`: `Bearer {{adminToken}}`

---

## Postman Collection Setup

### Environment Variables

Create a Postman environment with the following variables:

```json
{
  "name": "Admin Credit Management",
  "values": [
    {
      "key": "baseUrl",
      "value": "https://your-api-domain.com",
      "enabled": true
    },
    {
      "key": "adminToken",
      "value": "your_admin_jwt_token_here",
      "enabled": true
    },
    {
      "key": "userId",
      "value": "60d5ec49f1b2c8b1f8c8e8e8",
      "enabled": true
    }
  ]
}
```

### Common Error Responses

**401 Unauthorized**:
```json
{
  "success": false,
  "message": "Not authorized, token failed"
}
```

**403 Forbidden**:
```json
{
  "success": false,
  "message": "Only admins can access this resource"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Failed to process request",
  "error": "Error details here"
}
```

---

## Testing Workflow

### 1. Initial Setup
1. Get current credit settings to understand the baseline
2. Update signup credits to desired value (e.g., 75)
3. Verify settings were updated

### 2. User Management
1. Get user credit details to see current balance
2. Adjust credits for the user (add or deduct)
3. Verify the adjustment by fetching user details again

### 3. Bulk Operations
1. Prepare list of user IDs and credit amounts
2. Execute bulk adjustment
3. Review results to see successful and failed operations

### 4. Monitoring
1. Check credit statistics regularly
2. Review credit activity history to audit changes
3. Identify top users by credit balance

---

## Notes

1. **Signup Credits**: When you update signup credits in settings, it only affects NEW provider registrations. Existing users are not affected.

2. **Verification Credits**: Set to 0 by default. Providers no longer receive credits upon verification.

3. **Credit Balance**: Credits cannot go below 0. If you try to deduct more than available, the balance will be set to 0.

4. **Activity Types**:
   - `bonus`: Admin-given credits
   - `purchase`: Credits bought by user
   - `quote_submission`: Credits used for submitting quotes
   - `refund`: Credits refunded to user
   - `adjustment`: Manual corrections
   - `subscription`: Credits from subscription plans

5. **Only Providers**: Credits can only be adjusted for users with role 'provider'.

6. **Audit Trail**: All credit adjustments are logged with admin details for accountability.

---

## Support

For issues or questions, please contact the development team or refer to the main API documentation.
