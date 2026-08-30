@echo off
setlocal
title Z-Image Studio - Frontend Setup

cd /d "%~dp0"

echo ======================================================================
echo Installing Frontend Dependencies and TSX Runtime
echo ======================================================================

REM 1. Verify npm availability
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm was not found in PATH.
    echo Please install Node.js from https://nodejs.org/ and restart your terminal.
    goto :HOLD
)

REM 2. Install dependencies in Root (if package.json exists)
if not exist "package.json" goto :CHECK_SUBFOLDER

echo [1/2] Installing root package dependencies...
call npm install
call npm install -D tsx typescript @types/node

:CHECK_SUBFOLDER
REM 3. Install dependencies in frontend subfolder (if exists)
if not exist "frontend\package.json" goto :DONE

echo [2/2] Installing frontend folder dependencies...
cd frontend
call npm install
call npm install -D tsx typescript @types/node
cd ..

:DONE
echo.
echo ======================================================================
echo Frontend dependencies and TSX installed successfully!
echo ======================================================================
echo You can now run 'start_studio.bat' to launch the suite.
echo.
pause
exit /b 0

:HOLD
echo.
echo Setup halted due to missing prerequisites.
pause
exit /b 1