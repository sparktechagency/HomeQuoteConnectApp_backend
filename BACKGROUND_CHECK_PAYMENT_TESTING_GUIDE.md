# 💳 Background Check Payment - Postman Testing Guide

## 📌 Overview

This guide provides step-by-step instructions for testing the **payment-gated background check submission** system using Postman. Providers must pay a **$30 fee** before submitting their background check documents.

---

## 🎯 System Flow

```
1. Provider creates payment intent → GET clientSecret
2. Provider completes payment (frontend/Stripe) → GET paymentIntentId
3. Provider submits background check with paymentIntentId → Documents uploaded
4. System verifies payment with Stripe
5. If payment valid → Background check submitted for admin review
6. If payment invalid → Rejection with clear error message
```

---

## 🔐 Prerequisites

### 1. Authentication Token
You need a valid JWT token for a **Provider** account.

**How to get token:**
- Login as Provider via `/api/auth/login`
- Copy the `token` from response
- Use in Authorization header: `Bearer YOUR_TOKEN`

### 2. Stripe Test Cards
Use these test card numbers for payment testing:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |

**Test Card Details:**
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

### 3. Test Documents
Prepare test image files:
- `id_front.jpg` - Front of ID card
- `id_back.jpg` - Back of ID card
- `consent_form.pdf` (optional) - Consent document

---

## 🧪 Complete Testing Workflow

### **STEP 1: Create Payment Intent**

This creates a Stripe payment intent and returns `clientSecret` for frontend payment processing.

#### Request

**Method:** `POST`  
**URL:** `http://localhost:5000/api/background-check/create-payment-intent`  
**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
Content-Type: application/json
```

**Body:** None (empty JSON or no body)
```json
{}
```

#### Expected Response (Success)

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Payment intent created successfully. Complete payment to submit background check.",
  "data": {
    "clientSecret": "pi_3XXXXXXXXXXXXX_secret_XXXXXXXXXXXXXXX",
    "paymentIntentId": "pi_3XXXXXXXXXXXXX",
    "amount": 30,
    "currency": "usd"
  }
}
```

#### Expected Response (Already Approved)

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Your background check has already been approved"
}
```

#### Expected Response (Already Pending)

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Your background check is currently under review"
}
```

#### Expected Response (Already Paid)

**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Payment has already been completed for your background check"
}
```

#### What to Save
**IMPORTANT:** Copy the `paymentIntentId` from the response. You'll need it in Step 3.

```
Example: pi_3XXXXXXXXXXXXX
```

---

### **STEP 2: Complete Payment (Stripe Frontend)**

⚠️ **This step happens on the frontend using Stripe.js**

In a real application, you would:
1. Use `clientSecret` with Stripe Elements
2. Provider enters card details
3. Stripe processes payment
4. You receive confirmation with `paymentIntentId`

**For Postman testing**, we'll simulate this by confirming the payment using Stripe's API.

#### Option A: Using Stripe API Directly (For Testing Only)

**Method:** `POST`  
**URL:** `https://api.stripe.com/v1/payment_intents/{PAYMENT_INTENT_ID}/confirm`  
**Headers:**
```
Authorization: Bearer YOUR_STRIPE_SECRET_KEY
Content-Type: application/x-www-form-urlencoded
```

**Body (x-www-form-urlencoded):**
```
payment_method=pm_card_visa
```

Replace `{PAYMENT_INTENT_ID}` with the ID from Step 1.

**Note:** In production, payment confirmation happens on the frontend via Stripe.js, NOT via API calls.

#### Option B: Using Stripe Dashboard (Recommended for Testing)

1. Go to https://dashboard.stripe.com/test/payments
2. Find your payment intent
3. Click on it
4. Use test card `4242 4242 4242 4242` to complete

---

### **STEP 3: Submit Background Check with Payment**

Now submit the background check documents along with the `paymentIntentId` from Step 1.

#### Request

**Method:** `POST`  
**URL:** `http://localhost:5000/api/background-check/submit`  
**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Body:** `form-data`

| Key | Type | Value | Required |
|-----|------|-------|----------|
| `paymentIntentId` | Text | `pi_3XXXXXXXXXXXXX` | ✅ Yes |
| `idFront` | File | `id_front.jpg` | ✅ Yes |
| `idBack` | File | `id_back.jpg` | ✅ Yes |
| `consentForm` | File | `consent_form.pdf` | ❌ Optional |

**Example Form-Data:**
```
paymentIntentId: pi_3QZabcdefGHIJKLMNOP
idFront: [FILE] id_front.jpg
idBack: [FILE] id_back.jpg
consentForm: [FILE] consent_form.pdf
```

#### Expected Response (Success - First Submission)

**Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Background check submitted successfully. Our team will review it shortly.",
  "data": {
    "_id": "65f8a1234567890abcdef123",
    "provider": {
      "_id": "65f8a1111111111111111111",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "photo": {
        "url": "https://..."
      }
    },
    "idFront": {
      "public_id": "raza-home-quote/background-checks/id-front/xyz123",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2025-12-27T10:30:00.000Z"
    },
    "idBack": {
      "public_id": "raza-home-quote/background-checks/id-back/abc456",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2025-12-27T10:30:00.000Z"
    },
    "consentForm": {
      "public_id": "raza-home-quote/background-checks/consent-forms/def789",
      "url": "https://res.cloudinary.com/...",
      "uploadedAt": "2025-12-27T10:30:00.000Z"
    },
    "status": "pending",
    "submittedAt": "2025-12-27T10:30:00.000Z",
    "paymentStatus": "paid",
    "paymentAmount": 30,
    "paidAt": "2025-12-27T10:30:00.000Z",
    "stripePaymentIntentId": "pi_3XXXXXXXXXXXXX",
    "transaction": "65f8a9876543210fedcba987",
    "createdAt": "2025-12-27T10:30:00.000Z",
    "updatedAt": "2025-12-27T10:30:00.000Z"
  }
}
```

#### Expected Response (Success - Resubmission After Rejection)

**Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Background check resubmitted successfully. Our team will review it shortly.",
  "data": {
    // Same structure as above
    "resubmittedAt": "2025-12-27T11:00:00.000Z"
  }
}
```

---

## ❌ Error Scenarios

### Error 1: Missing Payment Intent

**Request Body:** No `paymentIntentId` field

**Response:**
```json
{
  "success": false,
  "message": "Payment required. Please provide paymentIntentId after completing payment."
}
```
**Status Code:** `402 Payment Required`

---

### Error 2: Invalid Payment Intent

**Request Body:** `paymentIntentId: "invalid_id"`

**Response:**
```json
{
  "success": false,
  "message": "Invalid payment intent. Please try again."
}
```
**Status Code:** `400 Bad Request`

---

### Error 3: Payment Not Completed

**Scenario:** Payment intent created but not confirmed/succeeded

**Response:**
```json
{
  "success": false,
  "message": "Payment not completed. Status: requires_payment_method. Please complete payment first."
}
```
**Status Code:** `402 Payment Required`

**Possible Statuses:**
- `requires_payment_method` - No card added yet
- `requires_confirmation` - Needs confirmation
- `processing` - Still processing
- `requires_action` - Needs 3D Secure authentication

---

### Error 4: Insufficient Payment Amount

**Scenario:** Payment amount < $30

**Response:**
```json
{
  "success": false,
  "message": "Invalid payment amount. Expected $30, received $10"
}
```
**Status Code:** `400 Bad Request`

---

### Error 5: Payment Already Used

**Scenario:** Same `paymentIntentId` used twice

**Response:**
```json
{
  "success": false,
  "message": "This payment has already been used for a background check submission"
}
```
**Status Code:** `400 Bad Request`

---

### Error 6: Missing Files

**Request Body:** No `idFront` or `idBack` files

**Response:**
```json
{
  "success": false,
  "message": "Please upload all required documents: ID Front and ID Back"
}
```
**Status Code:** `400 Bad Request`

---

### Error 7: Invalid File Type

**Scenario:** Uploaded non-image files for ID

**Response:**
```json
{
  "success": false,
  "message": "ID documents must be images (JPG, PNG)"
}
```
**Status Code:** `400 Bad Request`

---

### Error 8: Already Approved

**Scenario:** Background check already approved

**Response:**
```json
{
  "success": false,
  "message": "Your background check has already been approved"
}
```
**Status Code:** `400 Bad Request`

---

### Error 9: Already Pending Review

**Scenario:** Background check currently under review

**Response:**
```json
{
  "success": false,
  "message": "Your background check is currently under review"
}
```
**Status Code:** `400 Bad Request`

---

### Error 10: Not a Provider

**Scenario:** Client or Admin trying to submit

**Response:**
```json
{
  "success": false,
  "message": "Only provider accounts can submit background checks"
}
```
**Status Code:** `403 Forbidden`

---

## 🔍 Verification Endpoints

### Check Background Check Status

**Method:** `GET`  
**URL:** `http://localhost:5000/api/background-check/status`  
**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Response:**
```json
{
  "success": true,
  "message": "Background check status retrieved successfully",
  "data": {
    "_id": "65f8a1234567890abcdef123",
    "provider": {
      "_id": "65f8a1111111111111111111",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "status": "pending",
    "paymentStatus": "paid",
    "paymentAmount": 30,
    "paidAt": "2025-12-27T10:30:00.000Z",
    "transaction": {
      "_id": "65f8a9876543210fedcba987",
      "amount": 30,
      "status": "completed",
      "stripePaymentIntentId": "pi_3XXXXXXXXXXXXX"
    },
    "submittedAt": "2025-12-27T10:30:00.000Z",
    "idFront": { "url": "https://..." },
    "idBack": { "url": "https://..." }
  }
}
```

---

## 🧪 Complete Test Scenarios

### ✅ Test Case 1: Successful First-Time Submission

**Steps:**
1. POST `/api/background-check/create-payment-intent` → Get `paymentIntentId`
2. Confirm payment via Stripe (use test card `4242 4242 4242 4242`)
3. POST `/api/background-check/submit` with:
   - `paymentIntentId` from step 1
   - `idFront` file
   - `idBack` file
   - Optional `consentForm` file
4. Verify response: `status: "pending"`, `paymentStatus: "paid"`
5. GET `/api/background-check/status` → Verify submitted

**Expected Result:** ✅ Background check submitted successfully

---

### ✅ Test Case 2: Payment Failure (Card Declined)

**Steps:**
1. POST `/api/background-check/create-payment-intent` → Get `paymentIntentId`
2. Try to confirm payment with declined card `4000 0000 0000 0002`
3. Payment fails
4. POST `/api/background-check/submit` with failed `paymentIntentId`

**Expected Result:** ❌ Error: "Payment not completed. Status: requires_payment_method"

---

### ✅ Test Case 3: Resubmission After Rejection

**Prerequisites:** Background check previously rejected by admin

**Steps:**
1. POST `/api/background-check/create-payment-intent` → Should succeed
2. Complete payment
3. POST `/api/background-check/submit` with new documents

**Expected Result:** ✅ Resubmission successful (old files deleted, new files uploaded)

---

### ✅ Test Case 4: Duplicate Payment Attempt

**Steps:**
1. Complete Test Case 1 successfully
2. Try to POST `/api/background-check/create-payment-intent` again

**Expected Result:** ❌ Error: "Payment has already been completed for your background check"

---

### ✅ Test Case 5: Missing Payment Intent

**Steps:**
1. POST `/api/background-check/submit` WITHOUT `paymentIntentId`

**Expected Result:** ❌ Error: "Payment required. Please provide paymentIntentId..."

---

### ✅ Test Case 6: Invalid Payment Intent ID

**Steps:**
1. POST `/api/background-check/submit` with `paymentIntentId: "invalid_123"`

**Expected Result:** ❌ Error: "Invalid payment intent. Please try again."

---

### ✅ Test Case 7: Reuse Payment Intent

**Steps:**
1. Complete successful submission (Test Case 1)
2. Create new provider account
3. Try to use same `paymentIntentId` for new provider

**Expected Result:** ❌ Error: "This payment has already been used..."

---

## 📊 Database Verification

### Check Transaction Record

**MongoDB Query:**
```javascript
db.transactions.findOne({ 
  stripePaymentIntentId: "pi_3XXXXXXXXXXXXX" 
})
```

**Expected Document:**
```json
{
  "_id": ObjectId("..."),
  "user": ObjectId("..."),
  "amount": 30,
  "platformCommission": 30,
  "providerAmount": 0,
  "paymentMethod": "card",
  "stripePaymentIntentId": "pi_3XXXXXXXXXXXXX",
  "stripeChargeId": "ch_3XXXXXXXXXXXXX",
  "status": "completed",
  "paidAt": ISODate("..."),
  "completedAt": ISODate("..."),
  "metadata": {
    "type": "background_check_fee",
    "providerId": "..."
  }
}
```

### Check Background Check Record

**MongoDB Query:**
```javascript
db.backgroundchecks.findOne({ 
  provider: ObjectId("...") 
})
```

**Expected Document:**
```json
{
  "_id": ObjectId("..."),
  "provider": ObjectId("..."),
  "status": "pending",
  "paymentStatus": "paid",
  "paymentAmount": 30,
  "paidAt": ISODate("..."),
  "stripePaymentIntentId": "pi_3XXXXXXXXXXXXX",
  "transaction": ObjectId("..."),
  "idFront": { "url": "...", "public_id": "..." },
  "idBack": { "url": "...", "public_id": "..." }
}
```

---

## 🛡️ Security Features

### Payment Verification
- ✅ Payment intent verified with Stripe API
- ✅ Payment status must be `succeeded`
- ✅ Payment amount validated ($30 minimum)
- ✅ Prevents duplicate payment intent usage
- ✅ Transaction record created for audit trail

### Authorization
- ✅ Only providers can submit background checks
- ✅ JWT authentication required
- ✅ Provider can only submit their own background check

### Idempotency
- ✅ Prevents duplicate submissions while pending
- ✅ Prevents resubmission of approved checks
- ✅ Payment intent can only be used once
- ✅ Old Cloudinary files deleted on resubmission

---

## 🐛 Debugging Tips

### Check Server Logs

Look for these log messages:
```
[BackgroundCheck] Access attempt: { userId: ... }
[BackgroundCheck] Payment already completed for existing check
[BackgroundCheck] Payment verified and transaction created: ...
[BackgroundCheck] Stripe payment intent retrieval error: ...
```

### Verify Stripe Payment

**Stripe Dashboard:**
1. Go to https://dashboard.stripe.com/test/payments
2. Search for your `paymentIntentId`
3. Check status: `Succeeded`, `Failed`, etc.
4. Verify amount: Should be $30.00

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Payment not completed" | Payment not confirmed | Complete payment in Stripe first |
| "Invalid payment intent" | Wrong paymentIntentId | Copy correct ID from Step 1 response |
| "Payment already used" | Reusing same payment | Create new payment intent |
| "Only provider accounts..." | Wrong user role | Login as provider, not client/admin |
| 402 status code | Payment required | Must pay before submission |

---

## 📝 Postman Collection Setup

### Environment Variables

Create these variables in Postman:

| Variable | Example Value |
|----------|---------------|
| `BASE_URL` | `http://localhost:5000` |
| `PROVIDER_TOKEN` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `PAYMENT_INTENT_ID` | `pi_3XXXXXXXXXXXXX` |

### Pre-request Script (Optional)

For automatic token management:
```javascript
pm.environment.set("PROVIDER_TOKEN", pm.collectionVariables.get("token"));
```

---

## 🎯 Summary

### Required API Calls (In Order)

1. **Create Payment Intent**
   - `POST /api/background-check/create-payment-intent`
   - Returns: `clientSecret`, `paymentIntentId`

2. **Complete Payment** (Frontend/Stripe)
   - Use Stripe.js with `clientSecret`
   - Get confirmation with `paymentIntentId`

3. **Submit Background Check**
   - `POST /api/background-check/submit`
   - Body: `form-data` with `paymentIntentId` + files

4. **Check Status** (Optional)
   - `GET /api/background-check/status`
   - Verify submission successful

### Key Points

✅ Payment must be completed BEFORE document submission  
✅ Payment amount is $30 (non-negotiable)  
✅ Payment intent can only be used once  
✅ All payments recorded in Transaction model  
✅ Cloudinary files deleted on resubmission  
✅ Admin notified when new submission created  

---

**Last Updated:** December 27, 2025  
**Version:** 1.0  
**Author:** Backend Engineering Team
