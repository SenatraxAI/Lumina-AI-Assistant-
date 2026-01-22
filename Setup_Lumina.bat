@echo off
:: Lumina AI One-Click Setup - v4.5.0
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
if not exist "server\venv" (
    echo [1/3] Initializing Virtual Environment...
    echo [PROGRESS] [##########          ] 50%%
    python -m venv server\venv
    echo [PROGRESS] [####################] 100%%
    echo Done.
) else (
    echo [1/3] Virtual Environment already exists. Skipping...
)

echo.
echo [2/3] Installing AI dependencies...
echo [INFO] This downloads ~500MB of high-quality AI models. 
echo [INFO] Please wait while we prepare your engine...
echo.

call server\venv\Scripts\activate
:: Remove --quiet so user can see real pip progress
pip install -r server\requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies. 
    echo [TIP] Check your internet connection and try running this again.
    pause
    exit /b
)

echo.
echo [3/3] Finalizing configuration...
echo [PROGRESS] [#####               ] 25%%

:: 🎯 v4.0: Get Extension ID from User
echo.
set /p EXT_ID="Enter your Lumina Extension ID (from chrome://extensions): "
if "!EXT_ID!"=="" (
    echo [WARNING] No ID entered. Using default placeholder...
    set "EXT_ID=hfopjgfdmfckmjkhghjdfmlhfmfmclhf"
)

:: Get absolute path for the manifest
set "MANIFEST_PATH=%~dp0server\com.lumina.bridge.json"
set "BRIDGE_BAT_PATH=%~dp0server\bridge.bat"

echo [PROGRESS] [##########          ] 50%%

:: Update the path inside the json manifest to be absolute (Crucial for Chrome)
set "ESCAPED_PATH=!BRIDGE_BAT_PATH:\=\\!"
powershell -Command "(gc 'server\com.lumina.bridge.json') -replace 'bridge.bat', '!ESCAPED_PATH!' -replace 'hfopjgfdmfckmjkhghjdfmlhfmfmclhf', '!EXT_ID!' | Out-File -encoding utf8 'server\com.lumina.bridge.json'"

echo [PROGRESS] [###############     ] 75%%

:: Add to Windows Registry
REG ADD "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.lumina.bridge" /ve /t REG_SZ /d "!MANIFEST_PATH!" /f >nul

echo [PROGRESS] [####################] 100%%
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
