# 🚀 Deployment Checklist for Credit Management System

## Files to Upload to Production Server

### ✅ **New Files Created** (Must be uploaded)
1. `models/SystemSettings.js` - New model for system settings
2. `controllers/adminCreditController.js` - New credit management controller
3. `ADMIN_CREDIT_MANAGEMENT_API.md` - API documentation
4. `Admin_Credit_Management.postman_collection.json` - Postman collection
5. `CREDIT_SYSTEM_IMPLEMENTATION_SUMMARY.md` - Implementation summary

### ✅ **Modified Files** (Must be uploaded)
1. `controllers/authController.js` - Uses SystemSettings for signup credits
2. `controllers/adminController.js` - Removed credit rewards from verification
3. `routes/api/adminCreditRoutes.js` - Added new credit endpoints
4. `models/CreditActivity.js` - Added 'adjustment' to enum
5. `index.js` - Route mounting order (CRITICAL - see below)

## 🔴 **CRITICAL: Fix index.js Before Deployment**

Your `index.js` has **duplicate route mounting** which causes the 404 error on production. The routes are mounted **3 times** which creates conflicts!

**Current Problem:**
```javascript
// Line 85-95: First mounting (CORRECT)
app.use('/api/admin/credits', require('./routes/api/adminCreditRoutes.js'));
app.use('/api/admin/subscriptions', require('./routes/api/adminSubscriptionRoutes'));
// ... other routes

// Line 109-110: Second mounting (DUPLICATE - CAUSES CONFLICT!)
app.use('/api/admin', require('./routes/api/adminRoutes'));
app.use('/api/admin', require('./routes/api/adminCategoryRoutes'));

// Line 114-132: Third mounting (DUPLICATE - CAUSES CONFLICT!)
app.use('/api/admin', require('./routes/api/adminPaymentRoutes'));
// ... more duplicates
```

## 📋 Deployment Steps

### Step 1: Clean Up Local index.js
Run the fix I'm providing to remove all duplicate route mountings.

### Step 2: Upload Files to Production
Upload these files to `/home/quotocloud/HomeQuoteConnectApp_backend/`:
```bash
# New files
models/SystemSettings.js
controllers/adminCreditController.js

# Modified files
controllers/authController.js
controllers/adminController.js
routes/api/adminCreditRoutes.js
models/CreditActivity.js
index.js
```

### Step 3: Restart Production Server
```bash
# SSH into production server
ssh quotocloud@your-server

# Navigate to project directory
cd /home/quotocloud/HomeQuoteConnectApp_backend

# Install dependencies (if any new ones)
npm install

# Restart the server (depending on your process manager)
pm2 restart all
# OR
npm run restart
# OR
node index.js
```

### Step 4: Verify Deployment
Test these endpoints on production:
```bash
# 1. Health check
curl https://your-domain.com/api/health

# 2. Credit settings (requires admin token)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     https://your-domain.com/api/admin/credits/settings
```

## 🔍 Troubleshooting Production Issues

### Issue: "Not found - /api/admin/credits/settings"
**Cause**: Route duplication or files not uploaded
**Fix**: 
1. Verify all files uploaded to production
2. Check index.js has no duplicate route mountings
3. Restart server
4. Check server logs: `pm2 logs` or `tail -f logs/app.log`

### Issue: "SystemSettings is not defined"
**Cause**: SystemSettings.js not uploaded
**Fix**: Upload `models/SystemSettings.js` to production

### Issue: "adjustUserCredits validation failed"
**Cause**: CreditActivity.js not updated with 'adjustment' enum
**Fix**: Upload updated `models/CreditActivity.js` to production

## ✅ Post-Deployment Verification

- [ ] GET /api/admin/credits/settings returns 200
- [ ] PUT /api/admin/credits/settings updates successfully
- [ ] POST /api/admin/credits/adjust works
- [ ] New provider registration gives configurable credits
- [ ] Provider verification doesn't give credits
- [ ] All existing routes still work

## 📞 Support

If issues persist after deployment:
1. Check server logs for detailed error messages
2. Verify all files are uploaded correctly
3. Ensure MongoDB connection is working
4. Check if server was restarted after file upload
