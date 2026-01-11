# Invoice API Documentation

## Overview
The Invoice API allows clients and providers to retrieve detailed invoices for completed jobs. Invoices are automatically generated upon first request and stored for future retrieval.

---

## Endpoint




### Get Job Invoice

**Endpoint**: `GET /api/jobs/:id/invoice`

**Authentication**: Required (Bearer Token)

**Description**: Retrieves or generates an invoice for a completed job. The invoice includes all job details, pricing breakdown, payment information, and party details.

**URL Parameters**:
- `id` (string, required): The job ID

**Request Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**: None (GET request)

---

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Invoice retrieved successfully",
  "data": {
    "invoiceId": "123456",
    "issuedDate": "2024-01-15T10:30:00.000Z",
    
    "serviceProvider": {
      "name": "ABC Home Services",
      "fullName": "John Provider",
      "email": "provider@example.com",
      "phoneNumber": "+1234567890",
      "address": "123 Provider St, City, State, 12345"
    },
    
    "customer": {
      "name": "Jane Client",
      "email": "client@example.com",
      "phoneNumber": "+0987654321",
      "address": "456 Client Ave, City, State, 54321"
    },
    
    "jobDetails": {
      "jobTitle": "Kitchen Renovation",
      "jobDescription": "Complete kitchen remodeling including cabinets, countertops, and flooring",
      "jobLocation": "789 Job Location Rd, City, State, 67890",
      "serviceCategory": "Home Improvement"
    },
    
    "pricing": {
      "subtotal": 1000,
      "platformCommission": 100,
      "platformCommissionRate": "10%",
      "total": 900
    },
    
    "payment": {
      "paidAmount": 1000,
      "paymentMethod": "card",
      "paymentStatus": "completed",
      "paidAt": "2024-01-15T09:00:00.000Z"
    },
    
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Error Responses

### 404 Not Found (Job Not Found)
```json
{
  "success": false,
  "message": "Job not found"
}
```

### 404 Not Found (Transaction Not Found)
```json
{
  "success": false,
  "message": "No completed transaction found for this job"
}
```

### 403 Forbidden (Not Authorized)
```json
{
  "success": false,
  "message": "Not authorized to view this invoice"
}
```

### 400 Bad Request (Job Not Completed)
```json
{
  "success": false,
  "message": "Invoice can only be generated for completed jobs"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error retrieving invoice",
  "error": "Error details here"
}
```

---

## Response Fields

### Invoice Information
| Field | Type | Description |
|-------|------|-------------|
| `invoiceId` | String | Unique 6-digit invoice identifier |
| `issuedDate` | Date | Date when invoice was first generated |

### Service Provider Information
| Field | Type | Description |
|-------|------|-------------|
| `serviceProvider.name` | String | Business name or full name of provider |
| `serviceProvider.fullName` | String | Provider's full name |
| `serviceProvider.email` | String | Provider's email address |
| `serviceProvider.phoneNumber` | String | Provider's phone number (or 'N/A') |
| `serviceProvider.address` | String | Provider's complete address |

### Customer Information
| Field | Type | Description |
|-------|------|-------------|
| `customer.name` | String | Client's full name |
| `customer.email` | String | Client's email address |
| `customer.phoneNumber` | String | Client's phone number (or 'N/A') |
| `customer.address` | String | Client's complete address |

### Job Details
| Field | Type | Description |
|-------|------|-------------|
| `jobDetails.jobTitle` | String | Title of the completed job |
| `jobDetails.jobDescription` | String | Full description of the job |
| `jobDetails.jobLocation` | String | Location where job was performed |
| `jobDetails.serviceCategory` | String | Category of service provided |

### Pricing Breakdown
| Field | Type | Description |
|-------|------|-------------|
| `pricing.subtotal` | Number | Original price (amount paid by client) |
| `pricing.platformCommission` | Number | Platform fee deducted |
| `pricing.platformCommissionRate` | String | Commission rate as percentage |
| `pricing.total` | Number | Amount received by provider |

### Payment Information
| Field | Type | Description |
|-------|------|-------------|
| `payment.paidAmount` | Number | Total amount paid by client |
| `payment.paymentMethod` | String | Method used: 'card', 'cash', 'bank_transfer' |
| `payment.paymentStatus` | String | Status: 'completed', 'pending', etc. |
| `payment.paidAt` | Date | Date when payment was completed |

---

## Postman Collection Example

### Request

```json
{
  "name": "Get Job Invoice",
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
      "raw": "http://localhost:5000/api/jobs/507f1f77bcf86cd799439011/invoice",
      "protocol": "http",
      "host": ["localhost"],
      "port": "5000",
      "path": ["api", "jobs", "507f1f77bcf86cd799439011", "invoice"]
    }
  }
}
```

---

## Business Logic

### Invoice Generation Rules
1. **Job Status**: Only completed jobs can have invoices
2. **Transaction Required**: Must have a completed transaction
3. **Authorization**: Only client or provider of the job can view invoice
4. **Auto-Generation**: Invoice is created on first request and stored
5. **Reusability**: Subsequent requests retrieve the same invoice
6. **Unique ID**: Each invoice gets a unique 6-digit ID

### Invoice ID Generation
- Automatically generated 6-digit number (100000-999999)
- Checked for uniqueness before assignment
- Stored permanently with invoice

### Pricing Calculation
- **Subtotal**: Full amount paid by client (`transaction.amount`)
- **Platform Commission**: Fee deducted by platform (`transaction.platformCommission`)
- **Total**: Amount received by provider (`transaction.providerAmount`)
- **Commission Rate**: Calculated from commission/amount ratio

---

## Database Schema

### Invoice Model

```javascript
{
  invoiceId: "123456",                    // Unique 6-digit ID
  job: ObjectId,                          // Reference to Job
  quote: ObjectId,                        // Reference to Quote
  transaction: ObjectId,                  // Reference to Transaction
  provider: ObjectId,                     // Reference to Provider
  client: ObjectId,                       // Reference to Client
  
  pricing: {
    subtotal: 1000,                       // Original price
    platformCommission: 100,              // Platform fee
    platformCommissionRate: 0.10,         // 10%
    total: 900                            // Provider receives
  },
  
  payment: {
    paidAmount: 1000,                     // Amount paid
    paymentMethod: "card",                // Payment method
    paymentStatus: "completed",           // Payment status
    paidAt: Date                          // Payment timestamp
  },
  
  issuedDate: Date,                       // Invoice issue date
  status: "paid",                         // Invoice status
  createdAt: Date,                        // Creation timestamp
  updatedAt: Date                         // Last update timestamp
}
```

---

## Usage Workflow

### Step 1: Complete a Job and Make Payment

Client completes payment for a job, which changes job status to `completed`.

### Step 2: Request Invoice

Client or provider requests the invoice:

```bash
GET /api/jobs/507f1f77bcf86cd799439011/invoice
Authorization: Bearer {token}
```

### Step 3: Invoice Generated (First Time)

If invoice doesn't exist, system:
1. Validates job is completed
2. Finds completed transaction
3. Generates unique 6-digit invoice ID
4. Creates invoice with all details
5. Returns invoice data

### Step 4: Subsequent Requests

Same request retrieves stored invoice without regeneration.

---

## Authorization

### Who Can Access Invoice?
- **Client**: The person who created and paid for the job
- **Provider**: The person who completed the job
- **Admin**: Not currently allowed (can be added if needed)

### Authorization Check
```javascript
const isClient = job.client._id.toString() === req.user._id.toString();
const isProvider = job.provider._id.toString() === req.user._id.toString();

if (!isClient && !isProvider) {
  return 403 Forbidden
}
```

---

## Example Use Cases

### Use Case 1: Client Downloads Invoice for Tax Purposes

```bash
GET /api/jobs/123abc/invoice
Authorization: Bearer {clientToken}
```

**Response**: Complete invoice with all payment and service details

### Use Case 2: Provider Retrieves Invoice for Records

```bash
GET /api/jobs/123abc/invoice
Authorization: Bearer {providerToken}
```

**Response**: Same invoice data (both parties see identical information)

### Use Case 3: Attempt to Get Invoice for Incomplete Job

```bash
GET /api/jobs/456def/invoice
Authorization: Bearer {clientToken}
```

**Response**: 400 Bad Request - "Invoice can only be generated for completed jobs"

### Use Case 4: Unauthorized User Attempts Access

```bash
GET /api/jobs/123abc/invoice
Authorization: Bearer {otherUserToken}
```

**Response**: 403 Forbidden - "Not authorized to view this invoice"

---

## Implementation Files

### Created Files
1. **models/Invoice.js** - Invoice model with schema and auto-ID generation

### Modified Files
1. **controllers/jobController.js**
   - Added `getJobInvoice()` function
   - Exported new function

2. **routes/api/jobRoutes.js**
   - Added `GET /api/jobs/:id/invoice` route
   - Imported `getJobInvoice` function

---

## Testing Checklist

- [ ] Generate invoice for completed job (client)
- [ ] Generate invoice for completed job (provider)
- [ ] Retrieve existing invoice (no duplication)
- [ ] Verify unique 6-digit invoice ID
- [ ] Attempt invoice for incomplete job (400 error)
- [ ] Attempt invoice as unauthorized user (403 error)
- [ ] Attempt invoice for non-existent job (404 error)
- [ ] Verify all provider information is correct
- [ ] Verify all customer information is correct
- [ ] Verify job details are accurate
- [ ] Verify pricing breakdown is correct
- [ ] Verify payment information is accurate
- [ ] Test with card payment method
- [ ] Test with cash payment method
- [ ] Test with bank transfer method

---

## Notes

- Invoice is immutable once created (no update functionality)
- Invoice ID is guaranteed unique through pre-save validation
- All monetary values are in the transaction's currency (default USD)
- Missing phone numbers or addresses default to 'N/A'
- Provider's business name is used if available, otherwise full name
- Address fields fall back to city/state/zip combination if primary address is missing
