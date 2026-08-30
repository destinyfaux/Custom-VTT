@echo off
setlocal
title Z-Image Studio - Environment Setup

cd /d "%~dp0"

echo ======================================================================
echo Setting up Z-Image Studio Environment for Windows (RTX 3080 / CUDA)
echo ======================================================================

REM 1. Auto-detect Python executable
set "PYTHON_EXE="

REM Check if python is in PATH
where python >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('where python') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
    )
)

REM Check Miniconda3 common paths if not found
if not defined PYTHON_EXE (
    if exist "C:\tools\Miniconda3\python.exe" set "PYTHON_EXE=C:\tools\Miniconda3\python.exe"
    if exist "%USERPROFILE%\miniconda3\python.exe" set "PYTHON_EXE=%USERPROFILE%\miniconda3\python.exe"
    if exist "%USERPROFILE%\anaconda3\python.exe" set "PYTHON_EXE=%USERPROFILE%\anaconda3\python.exe"
    if exist "C:\ProgramData\miniconda3\python.exe" set "PYTHON_EXE=C:\ProgramData\miniconda3\python.exe"
    if exist "C:\Python310\python.exe" set "PYTHON_EXE=C:\Python310\python.exe"
    if exist "C:\Python311\python.exe" set "PYTHON_EXE=C:\Python311\python.exe"
)

if not defined PYTHON_EXE (
    echo [ERROR] Could not find Python. Please specify the path to python.exe.
    pause
    exit /b 1
)

echo Found Python at: %PYTHON_EXE%

REM 2. Create isolated Virtual Environment
if not exist ".venv" (
    echo [1/4] Creating virtual environment in .venv...
    "%PYTHON_EXE%" -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Existing .venv directory found.
)

REM 3. Activate Virtual Environment
call ".venv\Scripts\activate.bat"

echo [2/4] Upgrading pip, setuptools, and wheel...
python -m pip install --upgrade pip setuptools wheel

REM 4. Install PyTorch with CUDA 12.4
echo [3/4] Installing PyTorch (CUDA 12.4)...
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

REM 5. Install Backend Requirements
echo [4/4] Installing backend dependencies...
pip install fastapi==0.115.6 uvicorn[standard]==0.34.0 websockets==13.1 diffusers==0.31.0 transformers==4.46.3 accelerate==1.1.1 peft==0.12.0 safetensors==0.4.5 python-multipart==0.0.12 Pillow==10.4.0 numpy==1.26.4 pydantic==2.10.3 psutil==6.1.0

echo Installing bitsandbytes...
pip install bitsandbytes>=0.43.1

REM 6. Setup Frontend if package.json exists
if exist "frontend\package.json" (
    echo ======================================================================
    echo Installing Frontend Dependencies...
    echo ======================================================================
    where npm >nul 2>nul
    if %errorlevel% equ 0 (
        cd frontend
        call npm install
        cd ..
    ) else (
        echo [NOTE] npm was not found. Install Node.js if you need to build the frontend.
    )
)

echo ======================================================================
echo Installation Complete! Run 'start_studio.bat' to launch.
echo ======================================================================
pause