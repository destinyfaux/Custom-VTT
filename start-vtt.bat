@echo off
title Custom VTT Launcher
echo =======================================
echo    Starting Custom VTT Environment
echo =======================================

:: Start the Node Server in a new window
echo Starting Backend Server (Port 3001)...
cd server
start "VTT Backend Server" cmd /k "node server.js"
cd ..

:: Start the Vite Client in a new window
echo Starting Frontend Client (Port 5173)...
cd client
start "VTT Frontend Client" cmd /k "npm run dev"
cd ..

echo.
echo Both servers have been launched in separate windows!
echo You can close this window.
pause