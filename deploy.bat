@echo off
title Case Transfer Report - One-Click Git Setup & Push
cd /d %~dp0

echo =============================================
echo    CASE TRANSFER REPORT - GIT DEPLOY
echo =============================================
echo.

:: Your GitHub repository URL
set REMOTE_URL=https://github.com/myexcelweb/case-transfer-report.git

:: -------------------------------------------------
:: 1. Check if this is already a Git repository
:: -------------------------------------------------
if not exist ".git" (
    echo [1/5] Initializing local Git repository...
    git init
    echo.

    echo [2/5] Adding remote origin...
    git remote add origin %REMOTE_URL%
    echo.
) else (
    echo [✓] Git repository already exists.
    echo.

    :: Ensure remote origin is set correctly
    git remote get-url origin >nul 2>&1
    if errorlevel 1 (
        echo [2/5] Remote origin missing – adding now...
        git remote add origin %REMOTE_URL%
        echo.
    ) else (
        echo [✓] Remote origin already configured.
        echo.
    )
)

:: -------------------------------------------------
:: 2. Ask for commit message
:: -------------------------------------------------
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Update Case Transfer Report"

:: -------------------------------------------------
:: 3. Stage all changes
:: -------------------------------------------------
echo [3/5] Staging files...
git add .
echo.

:: -------------------------------------------------
:: 4. Commit
:: -------------------------------------------------
echo [4/5] Committing with message: %commit_msg%
git commit -m %commit_msg%
echo.

:: -------------------------------------------------
:: 5. Push to GitHub (main branch)
:: -------------------------------------------------
echo [5/5] Pushing to GitHub (branch: main)...
git push -u origin main

:: -------------------------------------------------
:: Final status
:: -------------------------------------------------
echo.
echo =============================================
echo                ALL DONE ✅
echo =============================================
echo.
echo Your code is now on GitHub:
echo %REMOTE_URL%
echo.
pause