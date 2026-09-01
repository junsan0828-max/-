@echo off
echo.
echo ====================================
echo   FitTrainer Pro - Setup and Run
echo ====================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from: https://nodejs.org
    echo Choose the LTS version, then run this file again.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

echo Node.js version:
node --version
echo.

if not exist "node_modules\electron\" (
    echo [1/2] Installing root packages... (first time only, 1-2 min)
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo.
)

if not exist "renderer\node_modules\vite\" (
    echo [2/2] Installing renderer packages...
    cd renderer
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] renderer npm install failed
        pause
        cd ..
        exit /b 1
    )
    cd ..
    echo.
)

echo Starting FitTrainer Pro...
echo.
call npm start
