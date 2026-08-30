@echo off
setlocal
title Z-Image Studio

cd /d "%~dp0"

echo ======================================================================
echo Launching Z-Image Studio...
echo ======================================================================

if not exist ".venv\Scripts\activate.bat" goto :NO_VENV

call ".venv\Scripts\activate.bat"

set "TORCH_LIB_PATH=%~dp0.venv\Lib\site-packages\torch\lib"
set "PATH=%TORCH_LIB_PATH%;%PATH%"
set "PYTHONUNBUFFERED=1"
set "CUDA_MODULE_LOADING=LAZY"

echo Running Python launcher...
python run_studio.py
if %errorlevel% neq 0 goto :CRASH

goto :DONE

:NO_VENV
echo [ERROR] Virtual environment not found in .venv\Scripts\activate.bat
echo Please run install_env.bat first.
goto :HOLD

:CRASH
echo.
echo ======================================================================
echo [CRASH DETECTED] Studio exited with error code: %errorlevel%
echo ======================================================================
goto :HOLD

:HOLD
echo.
echo Process halted. Press any key to exit...
pause >nul
exit /b 1

:DONE
echo Studio closed.
pause