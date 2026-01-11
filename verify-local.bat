@echo off
echo ==========================================
echo Local Files Verification
echo ==========================================
echo.

cd /d "D:\Md. Mehedi hasan Akash (Backend)\HomeQuoteConnectApp_backend"

echo Checking NEW files:
if exist "models\SystemSettings.js" (echo    [OK] models\SystemSettings.js) else (echo    [MISSING] models\SystemSettings.js)
if exist "controllers\adminCreditController.js" (echo    [OK] controllers\adminCreditController.js) else (echo    [MISSING] controllers\adminCreditController.js)

echo.
echo Checking MODIFIED files:
if exist "index.js" (echo    [OK] index.js) else (echo    [MISSING] index.js)
if exist "controllers\authController.js" (echo    [OK] controllers\authController.js) else (echo    [MISSING] controllers\authController.js)
if exist "controllers\adminController.js" (echo    [OK] controllers\adminController.js) else (echo    [MISSING] controllers\adminController.js)
if exist "routes\api\adminCreditRoutes.js" (echo    [OK] routes\api\adminCreditRoutes.js) else (echo    [MISSING] routes\api\adminCreditRoutes.js)
if exist "models\CreditActivity.js" (echo    [OK] models\CreditActivity.js) else (echo    [MISSING] models\CreditActivity.js)

echo.
echo ==========================================
echo Testing file imports...
echo ==========================================
echo.

node -e "try { const SystemSettings = require('./models/SystemSettings'); const controller = require('./controllers/adminCreditController'); const routes = require('./routes/api/adminCreditRoutes'); console.log('[OK] All files load successfully'); console.log('[OK] Controller exports: ' + Object.keys(controller).join(', ')); } catch(e) { console.log('[ERROR] ' + e.message); process.exit(1); }"

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo [SUCCESS] All files verified!
    echo ==========================================
    echo.
    echo Next Steps:
    echo 1. Upload these files to production server
    echo 2. SSH into server and restart
    echo 3. Test: curl https://your-domain.com/api/admin/credits/settings
    echo.
) else (
    echo.
    echo ==========================================
    echo [FAILED] File verification failed!
    echo ==========================================
    echo.
)

pause
