@echo off
title Alert Bot Launcher
echo Starting Alert Bot...

:: Start API server in background
start "API Server" /min cmd /c "cd /d %~dp0 && node server.js"

:: Wait for API to start
timeout /t 2 /nobreak >nul

:: Start floating indicator
start "Alert Indicator" powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0AlertFloat.ps1"

echo.
echo ========================================
echo   Alert Bot is running!
echo   - API: http://localhost:3002
echo   - Indicator: Floating circle
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

:: Kill processes
taskkill /FI "WINDOWTITLE eq API Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Alert Indicator*" /F >nul 2>&1

echo Stopped.