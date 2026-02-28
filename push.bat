@echo off
title Case Transfer Report - Git Push

cd /d %~dp0

echo =====================================
echo        CASE TRANSFER REPORT
echo            GIT PUSH
echo =====================================
echo.

git status
echo.

set /p msg=Enter commit message: 

if "%msg%"=="" (
    echo Commit message cannot be empty!
    pause
    exit
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