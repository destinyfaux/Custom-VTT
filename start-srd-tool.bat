@echo off
title SRD Homebrew Content Manager
echo ============================================
echo   SRD Homebrew Content Manager Launcher
echo ============================================
echo.

:: ── Start Node server in a new window ──
echo [1/3] Starting Node.js server...
start "VTT Server" cmd /c "cd /d "%~dp0" && node server/server.js"
timeout /t 2 /nobreak >nul

:: ── Start Vite dev server in a new window ──
echo [2/3] Starting Vite dev server...
start "Vite Dev Server" cmd /c "cd /d "%~dp0client" && npm run dev"
timeout /t 3 /nobreak >nul

:: ── Open browser to SRD Manager route ──
echo [3/3] Opening SRD Manager in browser...
start http://localhost:5173/srd-manager

echo.
echo ============================================
echo   SRD Manager is running!
echo   Node server:  http://localhost:3000
echo   Vite dev:     http://localhost:5173
echo   SRD Manager:  http://localhost:5173/srd-manager
echo.
echo   Close the server windows to stop.
echo ============================================
pause