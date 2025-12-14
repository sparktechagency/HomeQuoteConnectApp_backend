# OTP Verification System Documentation

## Overview

The HomeQuoteConnect application implements a comprehensive OTP (One-Time Password) verification system for user authentication. This ensures that users must verify their email addresses before they can access the application.

## Features

- **6-digit OTP codes** sent via email
- **Email verification required** for new user registration
- **Account protection** - users cannot login without verification
- **Multiple OTP purposes** supported:
  - `signup` - Email verification during registration
  - `forgot-password` - Password reset verification

## API Endpoints

### 1. Send OTP

**Endpoint**: `POST /api/auth/send-otp`

**Description**: Sends a 6-digit OTP code to the user's email for verification.

**Request Body**:
```json
{
  "email": "user@example.com",
  "purpose": "signup"
}
```

**Purpose Options**:
- `signup` (default) - For new user registration verification
- `forgot-password` - For password reset verification

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Signup OTP sent successfully",
  "data": {
    "email": "user@example.com",
    "purpose": "signup",
    "expiresAt": "2025-12-14T15:30:00.000Z"
  }
}
```

**Error Responses**:

**400 Bad Request** (User already verified):
```json
{
  "success": false,
  "message": "User already verified. Please log in instead."
}
```

**500 Internal Server Error** (Email sending failed):
```json
{
  "success": false,
  "message": "Failed to send OTP email"
}
```

---

### 2. Verify OTP

**Endpoint**: `POST /api/auth/verify-otp`

**Description**: Verifies the OTP code and completes the verification process based on the purpose.

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "signup"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "User verified successfully",
  "data": {
    "email": "user@example.com",
    "purpose": "signup",
    "isVerified": true
  }
}
```

**Error Responses**:

**400 Bad Request** (Invalid/expired OTP):
```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

---

### 3. User Registration

**Endpoint**: `POST /api/auth/register`

**Description**: Registers a new user and sends OTP for email verification. User cannot login until email is verified.

**Request Body**:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "client",
  "phoneNumber": "+1234567890"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email for verification code.",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "client",
      "isVerified": false,
      "phoneNumber": "+1234567890"
    },
    "requiresVerification": true,
    "otpExpiresAt": "2025-12-14T15:30:00.000Z"
  }
}
```

**Error Responses**:

**400 Bad Request** (User already verified):
```json
{
  "success": false,
  "message": "User already exists with this email. Please log in instead."
}
```

**200 OK** (User exists but not verified - resends OTP):
```json
{
  "success": true,
  "message": "Verification OTP sent to your email. Please verify to complete registration.",
  "data": {
    "email": "john@example.com",
    "requiresVerification": true,
    "otpExpiresAt": "2025-12-14T15:30:00.000Z",
    "userExists": true
  }
}
```

---

### 4. User Login

**Endpoint**: `POST /api/auth/login`

**Description**: Authenticates user credentials. Requires email verification before login is allowed.

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "client",
      "isVerified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**:

**401 Unauthorized** (Email not verified):
```json
{
  "success": false,
  "message": "Please verify your email before logging in. Check your email for the verification code.",
  "data": {
    "requiresVerification": true,
    "email": "john@example.com"
  }
}
```

**401 Unauthorized** (Invalid credentials):
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

## Complete User Flow Examples

### New User Registration Flow

#### Step 1: Register User
```javascript
// POST /api/auth/register
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'client'
  })
});

const data = await response.json();
// Response: User created, OTP sent, requiresVerification: true
```

#### Step 2: Verify Email with OTP
```javascript
// POST /api/auth/verify-otp
const response = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    otp: '123456',
    purpose: 'signup'
  })
});

const data = await response.json();
// Response: User verified successfully
```

#### Step 3: Login (Now Allowed)
```javascript
// POST /api/auth/login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'password123'
  })
});

const data = await response.json();
// Response: Login successful with token
```

---

### Password Reset Flow

#### Step 1: Request Password Reset
```javascript
// POST /api/auth/send-otp
const response = await fetch('/api/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    purpose: 'forgot-password'
  })
});

const data = await response.json();
// Response: OTP sent for password reset
```

#### Step 2: Verify OTP for Password Reset
```javascript
// POST /api/auth/verify-otp
const response = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    otp: '123456',
    purpose: 'forgot-password'
  })
});

const data = await response.json();
// Response: OTP verified for password reset
```

#### Step 3: Reset Password
```javascript
// POST /api/auth/reset-password
const response = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    otp: '123456',
    newPassword: 'newpassword123',
    confirmPassword: 'newpassword123'
  })
});

const data = await response.json();
// Response: Password reset successfully
```

---

## Security Features

### OTP Security
- **6-digit numeric codes** for enhanced security
- **5-minute expiration** time
- **One-time use** - OTP becomes invalid after verification
- **Purpose-specific** - OTPs are tied to specific actions
- **Rate limiting** through expiration and single-use policy

### Account Protection
- **Email verification required** before account activation
- **Cannot login** without verified email
- **Secure password reset** through OTP verification
- **Account blocking** capability for admin control

### Data Protection
- **OTP records encrypted** in database
- **Automatic cleanup** of expired OTPs
- **No sensitive data** exposed in API responses
- **JWT tokens** for authenticated sessions

---

## Error Handling

### Common Error Scenarios

1. **Expired OTP**
   ```
   Message: "Invalid or expired OTP"
   Solution: Request new OTP using /api/auth/send-otp
   ```

2. **Already Verified User**
   ```
   Message: "User already verified. Please log in instead."
   Solution: Use /api/auth/login endpoint
   ```

3. **Unverified Login Attempt**
   ```
   Message: "Please verify your email before logging in..."
   Solution: Complete OTP verification first
   ```

4. **Email Sending Failure**
   ```
   Message: "Failed to send OTP email"
   Solution: Retry registration or contact support
   ```

---

## Implementation Details

### Files Modified

1. **`controllers/authController.js`**
   - Modified `register()` function to require OTP verification
   - Modified `login()` function to check verification status
   - Enhanced error handling for verification flows

2. **Existing Files Used**
   - `models/OTP.js` - OTP record management
   - `models/User.js` - User verification status
   - `utils/emailService.js` - Email sending functionality

### Database Schema

**OTP Collection**:
```javascript
{
  email: String,
  otp: String, // Hashed for security
  purpose: String, // 'signup' or 'forgot-password'
  isUsed: Boolean,
  expiresAt: Date,
  createdAt: Date
}
```

**User Collection**:
```javascript
{
  // ... other fields
  isVerified: Boolean, // Defaults to false
  // ... other fields
}
```

### Email Templates

OTP emails are sent using the existing `sendOTPEmail` function with user-friendly formatting.

---

## Testing Checklist

### Registration Flow
- [ ] Register new user → OTP sent
- [ ] Verify OTP → User verified
- [ ] Login attempt before verification → Blocked
- [ ] Login after verification → Success

### Password Reset Flow
- [ ] Request password reset → OTP sent
- [ ] Verify OTP → Password reset allowed
- [ ] Reset password → Success

### Edge Cases
- [ ] Register with existing verified email → Error
- [ ] Register with existing unverified email → Resend OTP
- [ ] Invalid OTP → Error message
- [ ] Expired OTP → Error message
- [ ] Multiple OTP requests → Latest OTP valid

### Security Tests
- [ ] Cannot login without verification
- [ ] OTP expires after 5 minutes
- [ ] Used OTP cannot be reused
- [ ] Different purposes require different OTPs

---

## Postman Collection Examples

### 1. Complete Registration Flow

#### Register User
```json
{
  "name": "Register New User",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"fullName\": \"John Doe\",\n  \"email\": \"john@example.com\",\n  \"password\": \"password123\",\n  \"role\": \"client\",\n  \"phoneNumber\": \"+1234567890\"\n}"
    },
    "url": {
      "raw": "{{baseurl}}/api/auth/register",
      "host": ["{{baseurl}}"],
      "path": ["api", "auth", "register"]
    }
  }
}
```

#### Send OTP (if needed)
```json
{
  "name": "Send OTP",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"email\": \"john@example.com\",\n  \"purpose\": \"signup\"\n}"
    },
    "url": {
      "raw": "{{baseurl}}/api/auth/send-otp",
      "host": ["{{baseurl}}"],
      "path": ["api", "auth", "send-otp"]
    }
  }
}
```

#### Verify OTP
```json
{
  "name": "Verify OTP",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"email\": \"john@example.com\",\n  \"otp\": \"123456\",\n  \"purpose\": \"signup\"\n}"
    },
    "url": {
      "raw": "{{baseurl}}/api/auth/verify-otp",
      "host": ["{{baseurl}}"],
      "path": ["api", "auth", "send-otp"]
    }
  }
}
```

#### Login
```json
{
  "name": "Login User",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"email\": \"john@example.com\",\n  \"password\": \"password123\"\n}"
    },
    "url": {
      "raw": "{{baseurl}}/api/auth/login",
      "host": ["{{baseurl}}"],
      "path": ["api", "auth", "login"]
    }
  }
}
```

---

## Integration Notes

### Frontend Implementation
1. **Registration Form**: Collect user details, submit to `/register`, show OTP input
2. **OTP Verification**: Submit OTP to `/verify-otp`, handle success/error
3. **Login Protection**: Check for `requiresVerification` in login response
4. **Error Handling**: Display appropriate messages for different error states

### Mobile App Considerations
- **Deep Linking**: Consider implementing deep links for OTP verification emails
- **Push Notifications**: Optional push notifications for OTP delivery
- **Offline Support**: Handle network issues during OTP verification

### Admin Features
- **User Management**: View verification status in admin panel
- **Manual Verification**: Admin ability to manually verify users if needed
- **Bulk Operations**: Handle multiple user verifications

This OTP verification system provides robust security while maintaining a smooth user experience. All existing functionality remains intact while adding the required verification layer.