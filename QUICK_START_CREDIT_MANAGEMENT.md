# Admin Credit Management - Quick Start Guide

## 🚀 What's New

Your backend now has a fully configurable credit system! As an admin, you can:

✅ Set how many credits new providers get on signup (no more hardcoded 50!)
✅ Increase or decrease any user's credits at any time
✅ Stop giving credits when providers verify their documents
✅ Control everything from the admin panel via API

---

## 📁 Files Created/Modified

### New Files
1. **`models/SystemSettings.js`** - Stores configurable credit settings
2. **`controllers/adminCreditController.js`** - Admin credit management functions
3. **`ADMIN_CREDIT_MANAGEMENT_API.md`** - Complete API documentation
4. **`Admin_Credit_Management.postman_collection.json`** - Ready-to-import Postman collection

### Modified Files
1. **`controllers/authController.js`** - Now reads signup credits from database
2. **`controllers/adminController.js`** - Removed credits from verification
3. **`routes/api/adminCreditRoutes.js`** - Added new routes

---

## 🎯 Quick Test (5 Minutes)

### Step 1: Import Postman Collection
1. Open Postman
2. Click **Import** → Choose `Admin_Credit_Management.postman_collection.json`
3. Update variables:
   - `baseUrl`: Your API URL (e.g., `http://localhost:3000`)
   - `adminToken`: Your admin JWT token
   - `userId`: A test provider user ID

### Step 2: Test Credit Settings
```
1. GET /api/admin/credits/settings
   → Should return: signupCredits: 50 (default)

2. PUT /api/admin/credits/settings
   Body: { "signupCredits": 100 }
   → Updates signup credits to 100

3. GET /api/admin/credits/settings
   → Verify: signupCredits: 100
```

### Step 3: Test User Credit Adjustment
```
1. GET /api/admin/credits/user/:userId
   → See current balance (e.g., 50 credits)

2. POST /api/admin/credits/adjust
   Body: {
     "userId": "USER_ID_HERE",
     "creditChange": 75,
     "reason": "Welcome bonus",
     "type": "bonus"
   }
   → Adds 75 credits

3. GET /api/admin/credits/user/:userId
   → Verify: balance increased by 75
```

### Step 4: Test New Provider Registration
```
1. Register a new provider
   → They should receive 100 credits (from Step 2)
   
2. Change signup credits to 150

3. Register another provider
   → New provider gets 150 credits
```

---

## 📋 All Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/credits/settings` | GET | Get current credit settings |
| `/api/admin/credits/settings` | PUT | Update credit settings |
| `/api/admin/credits/user/:userId` | GET | View user's credits & history |
| `/api/admin/credits/adjust` | POST | Add/remove credits for one user |
| `/api/admin/credits/bulk-adjust` | POST | Adjust credits for many users |
| `/api/admin/credits/statistics` | GET | Platform-wide credit stats |
| `/api/admin/credits` | GET | All credit activity history |

---

## 💡 Common Use Cases

### 1. Change Signup Bonus
**Scenario**: You want to give new providers 100 credits instead of 50

**API Call**:
```bash
PUT /api/admin/credits/settings
{
  "signupCredits": 100
}
```

### 2. Reward Top Performer
**Scenario**: Give 200 bonus credits to your best provider

**API Call**:
```bash
POST /api/admin/credits/adjust
{
  "userId": "60d5ec49f1b2c8b1f8c8e8e8",
  "creditChange": 200,
  "reason": "Top performer of the month",
  "type": "bonus"
}
```

### 3. Correct a Mistake
**Scenario**: User was accidentally given too many credits

**API Call**:
```bash
POST /api/admin/credits/adjust
{
  "userId": "60d5ec49f1b2c8b1f8c8e8e8",
  "creditChange": -50,
  "reason": "Correction: duplicate credit assignment",
  "type": "adjustment"
}
```

### 4. Monthly Bonus for Active Providers
**Scenario**: Give 25 credits to multiple active providers

**API Call**:
```bash
POST /api/admin/credits/bulk-adjust
{
  "adjustments": [
    { "userId": "user1_id", "creditChange": 25 },
    { "userId": "user2_id", "creditChange": 25 },
    { "userId": "user3_id", "creditChange": 25 }
  ],
  "reason": "January 2026 activity bonus"
}
```

---

## 🔐 Security

All endpoints are protected:
- ✅ Requires valid JWT token
- ✅ Requires admin role
- ✅ All adjustments are logged with admin details
- ✅ Input validation (credits must be 0-1000)

---

## 🎨 Example Responses

### Success Response
```json
{
  "success": true,
  "message": "User credits adjusted successfully",
  "data": {
    "userId": "60d5ec49f1b2c8b1f8c8e8e8",
    "userName": "John Doe",
    "previousBalance": 50,
    "creditChange": 100,
    "newBalance": 150,
    "reason": "Welcome bonus"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## 📊 Monitor Credit Usage

### View Statistics
```bash
GET /api/admin/credits/statistics
```

**Returns**:
- Total credits distributed
- Total credits used
- Current credits in circulation
- Credits by type (bonus, purchase, usage)
- Top 10 users by credit balance

### View Activity History
```bash
GET /api/admin/credits?page=1&limit=20&type=bonus
```

**Returns**: Paginated list of all credit activities with user details

---

## ⚙️ Configuration

### Default Values
- **Signup Credits**: 50 (first time, then configurable)
- **Verification Credits**: 0 (no longer given)
- **Min Credits**: 0
- **Max Credits**: 1000

### Changing Defaults
Edit `models/SystemSettings.js` to change initial defaults (only affects first-time creation).

---

## 🐛 Troubleshooting

### Issue: "Settings not found"
**Solution**: Settings are auto-created on first request. Just call `GET /api/admin/credits/settings` once.

### Issue: "Can't adjust credits for this user"
**Solution**: Credits can only be adjusted for users with role 'provider'.

### Issue: "Credits didn't update for existing providers"
**Solution**: Signup credit changes only affect NEW registrations, not existing users. Use the adjust endpoint to manually update existing users.

---

## 📚 Documentation

- **Full API Docs**: `ADMIN_CREDIT_MANAGEMENT_API.md`
- **Implementation Details**: `CREDIT_SYSTEM_IMPLEMENTATION_SUMMARY.md`
- **Postman Collection**: `Admin_Credit_Management.postman_collection.json`

---

## 🎓 Next Steps

1. ✅ Import Postman collection
2. ✅ Update environment variables
3. ✅ Test all endpoints
4. ✅ Set your desired signup credits
5. ✅ Register a test provider to verify
6. ✅ Integrate with your admin panel UI

---

## 💬 Support

For detailed examples and advanced use cases, refer to:
- `ADMIN_CREDIT_MANAGEMENT_API.md` - Complete API reference
- Postman collection - Pre-configured test requests

**All systems are ready to go! 🚀**
