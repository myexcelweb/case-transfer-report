@echo off
title Case Transfer Report - Git Deploy
cd /d %~dp0

echo =============================================
echo    CASE TRANSFER REPORT - GIT DEPLOY
echo =============================================
echo.

set REMOTE_URL=https://github.com/myexcelweb/case-transfer-report.git

:: ----------------------------------------------
:: 1. Init repo if not exists
:: ----------------------------------------------
if not exist ".git" (
    echo [1/4] Initializing Git repository...
    git init
    git remote add origin %REMOTE_URL%
    echo.
) else (
    echo [✓] Git repo already exists.
    git remote get-url origin >nul 2>&1
    if errorlevel 1 git remote add origin %REMOTE_URL%
    echo.
)

:: ----------------------------------------------
:: 2. Ensure we are on 'main' branch (rename if needed)
:: ----------------------------------------------
echo [2/4] Ensuring branch name is 'main'...
git branch -M main
echo.

:: ----------------------------------------------
:: 3. Stage all files
:: ----------------------------------------------
echo [3/4] Adding files...
git add .
echo.

:: ----------------------------------------------
:: 4. Commit
:: ----------------------------------------------
set /p msg="Commit message (default: Update): "
if "%msg%"=="" set msg=Update
echo [4/4] Committing...
git commit -m "%msg%"
echo.

:: ----------------------------------------------
:: 5. Push to GitHub
:: ----------------------------------------------
echo [5/5] Pushing to GitHub...
git push -u origin main

echo.
echo =============================================
echo   ✅ Done! Check your repo:
echo   %REMOTE_URL%
echo =============================================
pause