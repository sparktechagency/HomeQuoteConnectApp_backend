# 🚀 Background Check Payment - Quick Reference

## 💰 Payment Amount
```
$30 USD (Fixed Fee)
```

## 🔗 API Endpoints

### Create Payment Intent
```
POST /api/background-check/create-payment-intent
Authorization: Bearer {PROVIDER_TOKEN}
```

### Submit with Payment
```
POST /api/background-check/submit
Authorization: Bearer {PROVIDER_TOKEN}
Content-Type: multipart/form-data

Fields:
- paymentIntentId: {PAYMENT_INTENT_ID}
- idFront: {FILE}
- idBack: {FILE}
- consentForm: {FILE} (optional)
```

## 📝 Postman Quick Test

### Step 1: Get Payment Intent
```json
POST {{BASE_URL}}/api/background-check/create-payment-intent
Headers: Authorization: Bearer {{PROVIDER_TOKEN}}

Response:
{
  "data": {
    "paymentIntentId": "pi_xxxx",
    "clientSecret": "pi_xxxx_secret_yyyy",
    "amount": 30
  }
}
```

### Step 2: Complete Payment
Use Stripe test card: `4242 4242 4242 4242`

### Step 3: Submit Documents
```
POST {{BASE_URL}}/api/background-check/submit
Headers: Authorization: Bearer {{PROVIDER_TOKEN}}
Body (form-data):
- paymentIntentId: pi_xxxx
- idFront: [FILE]
- idBack: [FILE]
```

## ⚠️ Common Errors

| Code | Message | Fix |
|------|---------|-----|
| 402 | Payment required | Add paymentIntentId |
| 400 | Invalid payment intent | Use valid payment ID |
| 400 | Payment not completed | Complete payment first |
| 400 | Payment already used | Create new payment |

## ✅ Success Response
```json
{
  "success": true,
  "message": "Background check submitted successfully...",
  "data": {
    "paymentStatus": "paid",
    "status": "pending",
    "transaction": "..."
  }
}
```

## 🔐 Security Checks
- ✅ Payment verified with Stripe
- ✅ Amount validated ($30)
- ✅ One-time use enforced
- ✅ Transaction recorded
- ✅ Provider-only access

## 📚 Full Documentation
- **Testing Guide:** `BACKGROUND_CHECK_PAYMENT_TESTING_GUIDE.md`
- **Implementation:** `BACKGROUND_CHECK_PAYMENT_SUMMARY.md`
