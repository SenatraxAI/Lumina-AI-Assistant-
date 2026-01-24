@echo off
:: Lumina AI - Manual Launcher v4.6
title Lumina AI Engine [DEBUG WINDOW] 🧠
setlocal enabledelayedexpansion

echo ========================================
echo   LUMINA AI: ENGINE DEBUG WINDOW
echo ========================================
echo.

:: Check for Venv
if not exist "server\venv" (
    echo [ERROR] Virtual environment not found. 
    echo Please run Setup_Lumina.bat first!
    pause
    exit /b
)

echo [1/2] Activating AI environment...
call server\venv\Scripts\activate

:: Port Collision Detection
netstat -ano | findstr :8080 | findstr LISTENING > nul
if %ERRORLEVEL% equ 0 (
    echo [!] ALERT: Port 8080 is already in use.
    echo [i] This usually means Lumina is already running in the background.
    echo.
    set /p CHOICE="Force restart engine? (y/n): "
    if /i "!CHOICE!"=="y" (
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do taskkill /f /pid %%a
        echo [i] Existing instance stopped.
    ) else (
        echo [i] Keeping existing instance. Exiting...
        timeout /t 3
        exit /b
    )
)

echo [2/2] Starting server on http://localhost:8080...
echo [INFO] Keep this window open while using the extension.
echo [INFO] Extensive logs will appear below:
echo.

:: Run the app
python server\app.py

echo.
echo [!] Server has stopped.
pause
