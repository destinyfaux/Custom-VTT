@echo off
title Custom VTT Launcher
echo =======================================
echo    Starting Custom VTT Environment
echo =======================================

:: Always use a randomized Cloudflare Quick Tunnel for this launcher.
:: Clear named-tunnel variables inherited from the Windows environment.
if exist "server\.host.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("server\.host.env") do set "%%A=%%B"
    echo Host security settings loaded from server\.host.env
) else (
    echo No server\.host.env found - default account roles will be used.
    echo Copy server\.host.env.example to server\.host.env for DM setup.
)
set "CLOUDFLARE_TUNNEL_NAME="
set "CLOUDFLARE_TUNNEL_ID="
set "CLOUDFLARE_TUNNEL_URL="
set "CLOUDFLARE_TUNNEL_TOKEN="
set "CLOUDFLARE_TUNNEL_CONFIG="
echo Cloudflare mode: randomized Quick Tunnel

:: Remove the previous generated backend URL so Vite cannot load an expired tunnel.
if exist "client\.env" del /q "client\.env"

:: Start the Node Server in a new window.
echo Starting Backend Server (Port 3001)...
cd server
start "VTT Backend Server" cmd /k "node server.js"
cd ..

:: The backend writes client\.env after the tunnel is ready. Wait for that
:: result before starting Vite so it never embeds a stale tunnel URL.
echo Waiting for the backend tunnel URL...
set "ENV_READY="
for /l %%N in (1,1,45) do (
    if exist "client\.env" (
        set "ENV_READY=1"
        goto :env_ready
    )
    timeout /t 1 /nobreak >nul
)

:env_ready
if not defined ENV_READY echo Backend URL was not generated yet; Vite will use its configured fallback.

:: Start the Vite Client in a new window.
echo Starting Frontend Client (Port 5173)...
cd client
start "VTT Frontend Client" cmd /k "npm run dev"
cd ..

echo.
echo Both servers have been launched in separate windows!
echo You can close this window.
pause
