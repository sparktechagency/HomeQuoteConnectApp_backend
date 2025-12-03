# Background Check API Documentation

## Overview
The Background Check system allows providers to submit criminal background check documents for admin review and approval. This system ensures platform safety and compliance.

---

## Provider Endpoints

### 1. Submit Background Check
Submit background check documents for review.

**Endpoint:** `POST /api/background-check/submit`  
**Authentication:** Required (Provider only)  
**Content-Type:** `multipart/form-data`

#### Request Headers
```
Authorization: Bearer <provider_jwt_token>
Content-Type: multipart/form-data
```

#### Request Body (Form Data)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| idFront | File | Yes | Front image of government-issued ID (JPG, PNG) |
| idBack | File | Yes | Back image of government-issued ID (JPG, PNG) |
| consentForm | File | Yes | Signed consent form (JPG, PNG, PDF) |

#### Response (Success - 201)
```json
{
  "success": true,
  "message": "Background check submitted successfully. Our team will review it shortly.",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "provider": {
      "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://res.cloudinary.com/..."
      }
    },
    "idFront": {
      "public_id": "raza-home-quote/background-checks/id-front/abc123",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "idBack": {
      "public_id": "raza-home-quote/background-checks/id-back/def456",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "consentForm": {
      "public_id": "raza-home-quote/background-checks/consent-forms/ghi789",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "status": "pending",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Response (Error - 400)
```json
{
  "success": false,
  "message": "Please upload all required documents: ID Front, ID Back, and Consent Form"
}
```

```json
{
  "success": false,
  "message": "Your background check is currently under review"
}
```

```json
{
  "success": false,
  "message": "ID documents must be images (JPG, PNG)"
}
```

#### Postman Example
```
Method: POST
URL: http://localhost:3000/api/background-check/submit

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Body (form-data):
  idFront: [Select File] example_id_front.jpg
  idBack: [Select File] example_id_back.jpg
  consentForm: [Select File] consent_signed.pdf
```

---

### 2. Get My Background Check Status
Retrieve the status of your submitted background check.

**Endpoint:** `GET /api/background-check/status`  
**Authentication:** Required (Provider only)

#### Request Headers
```
Authorization: Bearer <provider_jwt_token>
```

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Background check status retrieved successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "provider": {
      "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://res.cloudinary.com/..."
      }
    },
    "idFront": {
      "public_id": "raza-home-quote/background-checks/id-front/abc123",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "idBack": {
      "public_id": "raza-home-quote/background-checks/id-back/def456",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "consentForm": {
      "public_id": "raza-home-quote/background-checks/consent-forms/ghi789",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "status": "approved",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "reviewedBy": {
      "_id": "64f8a2b3c4d5e6f7a8b9c0d1",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "reviewedAt": "2024-01-16T14:20:00.000Z",
    "reviewNotes": "All documents verified successfully",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-16T14:20:00.000Z"
  }
}
```

#### Response (No Background Check - 200)
```json
{
  "success": true,
  "message": "No background check found. Please submit your documents.",
  "data": null
}
```

#### Postman Example
```
Method: GET
URL: http://localhost:3000/api/background-check/status

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Admin Endpoints

### 3. Get All Background Checks (with Filters)
Retrieve all background check submissions with filtering and pagination.

**Endpoint:** `GET /api/admin/background-checks`  
**Authentication:** Required (Admin only)

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
```

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | String | - | Filter by status: pending, approved, rejected, resubmission_required |
| search | String | - | Search by provider name or email |
| page | Number | 1 | Page number for pagination |
| limit | Number | 10 | Items per page |
| sortBy | String | -submittedAt | Sort field (prefix with - for descending) |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Background checks retrieved successfully",
  "data": {
    "backgroundChecks": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "provider": {
          "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "+1234567890",
          "photo": {
            "url": "https://res.cloudinary.com/..."
          },
          "businessName": "John's Plumbing Services"
        },
        "idFront": {
          "url": "https://res.cloudinary.com/...",
          "uploadedAt": "2024-01-15T10:30:00.000Z"
        },
        "idBack": {
          "url": "https://res.cloudinary.com/...",
          "uploadedAt": "2024-01-15T10:30:00.000Z"
        },
        "consentForm": {
          "url": "https://res.cloudinary.com/...",
          "uploadedAt": "2024-01-15T10:30:00.000Z"
        },
        "status": "pending",
        "submittedAt": "2024-01-15T10:30:00.000Z",
        "reviewedBy": null,
        "reviewedAt": null,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 48,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Postman Examples
```
Method: GET
URL: http://localhost:3000/api/admin/background-checks

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```
Method: GET
URL: http://localhost:3000/api/admin/background-checks?status=pending&page=1&limit=20

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```
Method: GET
URL: http://localhost:3000/api/admin/background-checks?search=john&status=approved

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 4. Get Background Check Details
Get detailed information about a specific background check submission.

**Endpoint:** `GET /api/admin/background-checks/:id`  
**Authentication:** Required (Admin only)

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Background check ID |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Background check details retrieved successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "provider": {
      "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://res.cloudinary.com/..."
      },
      "businessName": "John's Plumbing Services",
      "address": {
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zipCode": "10001"
      },
      "certifications": ["Licensed Plumber", "Gas Fitter"],
      "specializations": ["64f8a3b4c5d6e7f8a9b0c1d2"]
    },
    "idFront": {
      "public_id": "raza-home-quote/background-checks/id-front/abc123",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "idBack": {
      "public_id": "raza-home-quote/background-checks/id-back/def456",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "consentForm": {
      "public_id": "raza-home-quote/background-checks/consent-forms/ghi789",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "status": "pending",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNotes": null,
    "rejectionReason": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Response (Error - 404)
```json
{
  "success": false,
  "message": "Background check not found"
}
```

#### Postman Example
```
Method: GET
URL: http://localhost:3000/api/admin/background-checks/64f8a1b2c3d4e5f6a7b8c9d0

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 5. Approve Background Check
Approve a background check submission.

**Endpoint:** `PUT /api/admin/background-checks/:id/approve`  
**Authentication:** Required (Admin only)

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Background check ID |

#### Request Body
```json
{
  "reviewNotes": "All documents verified. Criminal background check passed."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reviewNotes | String | No | Admin notes about the approval |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Background check approved successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "provider": {
      "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://res.cloudinary.com/..."
      }
    },
    "status": "approved",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "reviewedBy": {
      "_id": "64f8a2b3c4d5e6f7a8b9c0d1",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "reviewedAt": "2024-01-16T14:20:00.000Z",
    "reviewNotes": "All documents verified. Criminal background check passed.",
    "rejectionReason": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-16T14:20:00.000Z"
  }
}
```

#### Response (Error - 400)
```json
{
  "success": false,
  "message": "Background check is already approved"
}
```

#### Postman Example
```
Method: PUT
URL: http://localhost:3000/api/admin/background-checks/64f8a1b2c3d4e5f6a7b8c9d0/approve

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Body (raw JSON):
{
  "reviewNotes": "All documents verified. Criminal background check passed."
}
```

---

### 6. Reject Background Check
Reject a background check submission with a reason.

**Endpoint:** `PUT /api/admin/background-checks/:id/reject`  
**Authentication:** Required (Admin only)

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Background check ID |

#### Request Body
```json
{
  "rejectionReason": "ID document is expired. Please submit a valid government-issued ID.",
  "reviewNotes": "Rejected due to expired identification document."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rejectionReason | String | Yes | Reason for rejection (visible to provider) |
| reviewNotes | String | No | Internal admin notes |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Background check rejected",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "provider": {
      "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://res.cloudinary.com/..."
      }
    },
    "status": "rejected",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "reviewedBy": {
      "_id": "64f8a2b3c4d5e6f7a8b9c0d1",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "reviewedAt": "2024-01-16T14:20:00.000Z",
    "reviewNotes": "Rejected due to expired identification document.",
    "rejectionReason": "ID document is expired. Please submit a valid government-issued ID.",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-16T14:20:00.000Z"
  }
}
```

#### Response (Error - 400)
```json
{
  "success": false,
  "message": "Please provide a reason for rejection"
}
```

```json
{
  "success": false,
  "message": "Cannot reject an approved background check"
}
```

#### Postman Example
```
Method: PUT
URL: http://localhost:3000/api/admin/background-checks/64f8a1b2c3d4e5f6a7b8c9d0/reject

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Body (raw JSON):
{
  "rejectionReason": "ID document is expired. Please submit a valid government-issued ID.",
  "reviewNotes": "Rejected due to expired identification document."
}
```

---

### 7. Request Resubmission
Request provider to resubmit documents with corrections.

**Endpoint:** `PUT /api/admin/background-checks/:id/request-resubmission`  
**Authentication:** Required (Admin only)

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Background check ID |

#### Request Body
```json
{
  "reason": "ID photo is blurry. Please upload a clearer image of both sides of your ID.",
  "reviewNotes": "Document quality insufficient for verification."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | String | Yes | Reason for resubmission request (visible to provider) |
| reviewNotes | String | No | Internal admin notes |

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Resubmission requested successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "provider": {
      "_id": "64f8a0b1c2d3e4f5a6b7c8d9",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://res.cloudinary.com/..."
      }
    },
    "status": "resubmission_required",
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "reviewedBy": {
      "_id": "64f8a2b3c4d5e6f7a8b9c0d1",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "reviewedAt": "2024-01-16T14:20:00.000Z",
    "reviewNotes": "Document quality insufficient for verification.",
    "rejectionReason": "ID photo is blurry. Please upload a clearer image of both sides of your ID.",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-16T14:20:00.000Z"
  }
}
```

#### Response (Error - 400)
```json
{
  "success": false,
  "message": "Please provide a reason for resubmission request"
}
```

#### Postman Example
```
Method: PUT
URL: http://localhost:3000/api/admin/background-checks/64f8a1b2c3d4e5f6a7b8c9d0/request-resubmission

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json

Body (raw JSON):
{
  "reason": "ID photo is blurry. Please upload a clearer image of both sides of your ID.",
  "reviewNotes": "Document quality insufficient for verification."
}
```

---

### 8. Get Background Check Statistics
Retrieve statistics about background check submissions.

**Endpoint:** `GET /api/admin/background-checks/stats`  
**Authentication:** Required (Admin only)

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
```

#### Response (Success - 200)
```json
{
  "success": true,
  "message": "Background check statistics retrieved successfully",
  "data": {
    "total": 150,
    "pending": 23,
    "approved": 98,
    "rejected": 15,
    "resubmission_required": 14,
    "recentSubmissions": 8
  }
}
```

| Field | Description |
|-------|-------------|
| total | Total number of background check submissions |
| pending | Number of pending reviews |
| approved | Number of approved background checks |
| rejected | Number of rejected background checks |
| resubmission_required | Number waiting for resubmission |
| recentSubmissions | Submissions in the last 7 days |

#### Postman Example
```
Method: GET
URL: http://localhost:3000/api/admin/background-checks/stats

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Submitted and awaiting admin review |
| `approved` | Approved by admin - provider can receive jobs |
| `rejected` | Rejected by admin - provider cannot submit again with same account |
| `resubmission_required` | Admin requested document corrections - provider can resubmit |

---

## Real-Time Notifications

The system sends Socket.IO notifications for:

### Provider Notifications
- **Background check approved**: Sent when admin approves
- **Background check rejected**: Sent when admin rejects with reason
- **Resubmission required**: Sent when admin requests document corrections

### Admin Notifications
- **New submission**: Sent when provider submits background check

---

## Testing Workflow

### Provider Flow
1. Login as provider → `POST /api/auth/login`
2. Submit background check → `POST /api/background-check/submit`
3. Check status → `GET /api/background-check/status`
4. (If rejected/resubmission) → Resubmit via `POST /api/background-check/submit`

### Admin Flow
1. Login as admin → `POST /api/auth/login`
2. View statistics → `GET /api/admin/background-checks/stats`
3. List all pending → `GET /api/admin/background-checks?status=pending`
4. View details → `GET /api/admin/background-checks/:id`
5. Approve/Reject/Request Resubmission → `PUT /api/admin/background-checks/:id/[action]`

---

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request (missing fields, invalid data, business logic error) |
| 401 | Unauthorized (no token or invalid token) |
| 403 | Forbidden (not authorized for this role) |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Notes

1. **File Upload Limits**: 5MB per file, max 3 files per submission
2. **Accepted Formats**: 
   - ID Documents: JPG, PNG only
   - Consent Form: JPG, PNG, PDF
3. **Resubmission Logic**: 
   - Providers can resubmit after rejection or resubmission request
   - Old files are automatically deleted from Cloudinary on resubmission
   - Cannot resubmit if already approved or currently pending
4. **Provider Status**: User model's `backgroundCheckStatus` field is updated on approval/rejection
5. **One Check Per Provider**: Each provider can only have one background check record (enforced by unique index)

---

## Postman Collection Setup

### Environment Variables
Create a Postman environment with:

```
BASE_URL: http://localhost:3000
PROVIDER_TOKEN: <provider_jwt_token>
ADMIN_TOKEN: <admin_jwt_token>
```

### Pre-request Scripts (for authenticated routes)
```javascript
pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('PROVIDER_TOKEN') // or ADMIN_TOKEN
});
```

---

**API Version:** 1.0  
**Last Updated:** January 2024
