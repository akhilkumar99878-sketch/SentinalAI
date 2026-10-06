@echo off
title SentinelAI Launcher
echo ====================================================
echo           Starting SentinelAI Full-Stack App
echo ====================================================
echo.

REM Get directory of this batch script
set "ROOT_DIR=%~dp0"

echo [1/2] Launching Backend (port 8081)...
start "SentinelAI Backend" cmd /k "cd /d ""%ROOT_DIR%backend"" && uvicorn app.main:app --reload --port 8081"

timeout /t 3 /nobreak >nul

echo [2/2] Launching Frontend (port 8080)...
start "SentinelAI Frontend" cmd /k "cd /d ""%ROOT_DIR%frontend"" && npm run dev"

echo.
echo ====================================================
echo  Both servers started!
echo.
echo  Open in browser: http://localhost:8080
echo.
echo  Login:
echo    Email    : admin@sentinelai.com
echo    Password : Admin@12345
echo ====================================================
echo.
pause
