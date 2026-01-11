# Windows PowerShell Deployment Verification Script
# Run this LOCALLY to verify files before uploading to production

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🔍 Local Files Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$basePath = "D:\Md. Mehedi hasan Akash (Backend)\HomeQuoteConnectApp_backend"

# Files to check
$newFiles = @(
    "models\SystemSettings.js",
    "controllers\adminCreditController.js"
)

$modifiedFiles = @(
    "index.js",
    "controllers\authController.js",
    "controllers\adminController.js",
    "routes\api\adminCreditRoutes.js",
    "models\CreditActivity.js"
)

Write-Host "✅ Checking NEW files:" -ForegroundColor Green
foreach ($file in $newFiles) {
    $fullPath = Join-Path $basePath $file
    if (Test-Path $fullPath) {
        Write-Host "   ✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file MISSING!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Checking MODIFIED files:" -ForegroundColor Green
foreach ($file in $modifiedFiles) {
    $fullPath = Join-Path $basePath $file
    if (Test-Path $fullPath) {
        Write-Host "   ✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file MISSING!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🧪 Testing file imports..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $basePath

$testScript = @"
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
    process.exit(1);
}
"@

node -e $testScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ All files verified successfully!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Upload these files to production server:" -ForegroundColor White
    foreach ($file in $newFiles + $modifiedFiles) {
        Write-Host "      - $file" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "   2. SSH into production server:" -ForegroundColor White
    Write-Host "      ssh user@your-server" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Run deployment script:" -ForegroundColor White
    Write-Host "      cd /home/quotocloud/HomeQuoteConnectApp_backend" -ForegroundColor Gray
    Write-Host "      bash deploy-production.sh" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "❌ File verification failed!" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the errors above before deployment." -ForegroundColor Yellow
    Write-Host ""
}
