@echo off
setlocal
title Custom-VTT - Git Push

cd /d "%~dp0"

echo ======================================================================
echo Pushing Local Changes to GitHub (destinyfaux/Custom-VTT)
echo ======================================================================

REM 1. Verify Git is available
where git >nul 2>nul
if %errorlevel% neq 0 goto :NO_GIT

REM 2. Display modified/added files
echo Changed files:
git status -s
echo.

REM 3. Prompt for commit message
set "COMMIT_MSG="
set /p COMMIT_MSG="Enter commit message (or press ENTER for default): "

if not defined COMMIT_MSG (
    set "COMMIT_MSG=update: studio launcher fixes, frontend dependencies, and backend routing"
)

echo.
echo [1/3] Staging all changes...
git add .

echo [2/3] Committing changes...
git commit -m "%COMMIT_MSG%"

echo [3/3] Pushing to origin main...
git push origin main
if %errorlevel% neq 0 goto :PUSH_FAIL

echo.
echo ======================================================================
echo Changes successfully pushed to GitHub!
echo Repository: https://github.com/destinyfaux/Custom-VTT
echo ======================================================================
goto :DONE

:NO_GIT
echo [ERROR] Git was not found in PATH.
goto :HOLD

:PUSH_FAIL
echo.
echo ======================================================================
echo [ERROR] Push failed. 
echo If the remote repository has newer commits, run:
echo   git pull origin main --rebase
echo Or to overwrite the remote with your local version, run:
echo   git push -u origin main --force
echo ======================================================================
goto :HOLD

:HOLD
echo.
echo Press any key to exit...
pause >nul
exit /b 1

:DONE
echo.
pause
exit /b 0