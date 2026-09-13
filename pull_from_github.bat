@echo off
setlocal
title Custom-VTT - Git Pull

cd /d "%~dp0"

echo ======================================================================
echo Pulling Latest Changes from GitHub (destinyfaux/Custom-VTT)
echo ======================================================================

REM 1. Verify Git availability
where git >nul 2>nul
if %errorlevel% neq 0 goto :NO_GIT

REM 2. Check for uncommitted local changes
for /f "tokens=*" %%i in ('git status --porcelain') do (
    set "HAS_DIRTY=1"
)

if defined HAS_DIRTY (
    echo [WARNING] You have uncommitted local changes:
    git status -s
    echo.
    echo Please commit or push your changes first with 'push_to_github.bat'
    echo to prevent merge conflicts.
    echo.
    set /p PROCEED="Do you want to pull anyway using rebase? (Y/N): "
    if /i not "%PROCEED%"=="Y" goto :ABORT
)

REM 3. Pull latest changes from origin main
echo.
echo Fetching and pulling updates from origin main...
git pull origin main
if %errorlevel% neq 0 goto :PULL_FAIL

echo.
echo ======================================================================
echo Local repository is now up to date with GitHub!
echo ======================================================================
goto :CHECK_DEPS

:NO_GIT
echo [ERROR] Git was not found in PATH.
goto :HOLD

:ABORT
echo.
echo Pull operation cancelled. Your local files were not modified.
goto :HOLD

:PULL_FAIL
echo.
echo ======================================================================
echo [ERROR] Git pull failed.
echo If there are merge conflicts, resolve them or stash your changes.
echo ======================================================================
goto :HOLD

:CHECK_DEPS
echo.
echo Note: If backend/requirements.txt or package.json was updated:
echo  - Run 'install_env.bat' to update Python packages.
echo  - Run 'install_frontend.bat' to update UI packages.
echo.
goto :DONE

:HOLD
echo.
echo Press any key to exit...
pause >nul
exit /b 1

:DONE
pause
exit /b 0