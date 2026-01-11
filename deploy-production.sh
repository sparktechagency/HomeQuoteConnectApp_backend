#!/bin/bash

# Production Server Deployment Script
# Run this on your PRODUCTION server after uploading files

echo "=========================================="
echo "🚀 Credit Management System Deployment"
echo "=========================================="
echo ""

# Set production path
PROD_PATH="/home/quotocloud/HomeQuoteConnectApp_backend"

echo "📂 Checking required files..."
echo ""

# Check if new files exist
NEW_FILES=(
    "$PROD_PATH/models/SystemSettings.js"
    "$PROD_PATH/controllers/adminCreditController.js"
)

MODIFIED_FILES=(
    "$PROD_PATH/index.js"
    "$PROD_PATH/controllers/authController.js"
    "$PROD_PATH/controllers/adminController.js"
    "$PROD_PATH/routes/api/adminCreditRoutes.js"
    "$PROD_PATH/models/CreditActivity.js"
)

echo "✅ Checking NEW files:"
for file in "${NEW_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file MISSING - UPLOAD REQUIRED!"
    fi
done

echo ""
echo "✅ Checking MODIFIED files:"
for file in "${MODIFIED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file MISSING!"
    fi
done

echo ""
echo "=========================================="
echo "🔍 Testing file imports..."
echo "=========================================="
echo ""

cd $PROD_PATH

# Test if files can be loaded
node -e "
try {
    console.log('Testing SystemSettings model...');
    const SystemSettings = require('./models/SystemSettings');
    console.log('✅ SystemSettings loaded');
    
    console.log('Testing adminCreditController...');
    const controller = require('./controllers/adminCreditController');
    console.log('✅ adminCreditController loaded');
    console.log('   Exports:', Object.keys(controller).join(', '));
    
    console.log('Testing adminCreditRoutes...');
    const routes = require('./routes/api/adminCreditRoutes');
    console.log('✅ adminCreditRoutes loaded');
    
    console.log('');
    console.log('✅ ALL FILES LOADED SUCCESSFULLY!');
} catch(e) {
    console.log('');
    console.log('❌ ERROR:', e.message);
    console.log('');
    console.log('Stack:', e.stack);
    process.exit(1);
}
"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "🔄 Restarting server..."
    echo "=========================================="
    echo ""
    
    # Try different restart methods
    if command -v pm2 &> /dev/null; then
        echo "Using PM2..."
        pm2 restart all
    elif [ -f "package.json" ]; then
        echo "Using npm..."
        npm run restart 2>/dev/null || echo "No restart script in package.json"
    else
        echo "⚠️  Please manually restart your server"
    fi
    
    echo ""
    echo "=========================================="
    echo "✅ Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "🔍 Test the endpoint:"
    echo "   curl http://localhost:8080/api/admin/credits/settings"
    echo ""
    echo "📊 View server logs:"
    echo "   pm2 logs"
    echo "   OR"
    echo "   tail -f logs/app.log"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "❌ Deployment Failed!"
    echo "=========================================="
    echo ""
    echo "Please check the error above and fix the issues."
    echo ""
fi
