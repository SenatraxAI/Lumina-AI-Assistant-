@echo off
setlocal enabledelayedexpansion
title Lumina AI - One-Click Setup 🎓

echo ========================================
echo   LUMINA AI: PREMIUM SETUP ASSISTANT
echo ========================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed!
    echo Please download it from: https://www.python.org/downloads/
    pause
    exit /b
)

:: 2. Setup Venv
echo [1/3] Creating virtual environment...
if not exist "server\venv" (
    python -m venv server\venv
)

echo [2/3] Installing AI dependencies (this may take a minute)...
call server\venv\Scripts\activate
pip install -r server\requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies. Check your internet connection.
    pause
    exit /b
)

:: 3. Register Native Host
echo [3/3] Registering Lumina Bridge with Chrome...

:: 🎯 v4.0: Get Extension ID from User
set /p EXT_ID="Enter your Lumina Extension ID (from chrome://extensions): "
if "!EXT_ID!"=="" (
    echo [WARNING] No ID entered. Bridge might not work.
    set "EXT_ID=hfopjgfdmfckmjkhghjdfmlhfmfmclhf"
)

:: Get absolute path for the manifest
set "MANIFEST_PATH=%~dp0server\com.lumina.bridge.json"
set "BRIDGE_BAT_PATH=%~dp0server\bridge.bat"

:: Update the path inside the json manifest to be absolute (Crucial for Chrome)
:: Also update the allowed_origins ID
set "ESCAPED_PATH=!BRIDGE_BAT_PATH:\=\\!"
powershell -Command "(gc 'server\com.lumina.bridge.json') -replace 'bridge.bat', '!ESCAPED_PATH!' -replace 'hfopjgfdmfckmjkhghjdfmlhfmfmclhf', '!EXT_ID!' | Out-File -encoding utf8 'server\com.lumina.bridge.json'"

:: Add to Windows Registry
REG ADD "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.lumina.bridge" /ve /t REG_SZ /d "!MANIFEST_PATH!" /f >nul

echo.
echo ========================================
echo   🎉 SETUP COMPLETE!
echo ========================================
echo.
echo 1. Open Chrome and go to: chrome://extensions
echo 2. Enable "Developer Mode" (top-right).
echo 3. Click "Load Unpacked" and select the 'extension' folder.
echo 4. Click the Lumina icon to start your engine!
echo.
echo Press any key to finish and open Chrome...
pause >nul
start chrome "chrome://extensions"
exit
