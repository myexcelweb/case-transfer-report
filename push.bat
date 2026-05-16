@echo off
title Case Transfer Report - Git Push

cd /d %~dp0

echo =====================================
echo        CASE TRANSFER REPORT
echo            GIT PUSH
echo =====================================
echo.

:: Check if this is a Git repository
if not exist ".git" (
    echo ERROR: Not a Git repository!
    echo Please run 'git init' first and add a remote.
    pause
    exit /b 1
)

git status
echo.

set /p msg=Enter commit message: 

if "%msg%"=="" (
    echo Commit message cannot be empty!
    pause
    exit /b 1
)

git add .
git commit -m "%msg%"
git push origin main

echo.
echo =====================================
echo        PUSH COMPLETED ✅
echo =====================================
echo.

pause