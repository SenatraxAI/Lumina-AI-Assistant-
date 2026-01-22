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
echo [!] To link your extension to this engine:
echo     1. Open chrome://extensions
echo     2. Load Unpacked "extension" folder (if you haven't yet)
echo     3. Copy the ID it generates
echo.
set /p EXT_ID="Enter your Lumina Extension ID: "
if "!EXT_ID!"=="" (
    echo [WARNING] No ID entered. Using default placeholder...
    set "EXT_ID=hfopjgfdmfckmjkhghjdfmlhfmfmclhf"
)

:: Get absolute path for the manifest
set "MANIFEST_PATH=%~dp0server\com.lumina.bridge.json"
set "BRIDGE_BAT_PATH=%~dp0server\bridge.bat"

echo [PROGRESS] [##########          ] 50%%

:: Regenerate manifest from template to ensure clean state
copy /y "server\com.lumina.bridge.json.template" "server\com.lumina.bridge.json" >nul

:: Update the path inside the json manifest to be absolute (Crucial for Chrome)
set "ESCAPED_PATH=!BRIDGE_BAT_PATH:\=\\!"
powershell -Command "(gc 'server\com.lumina.bridge.json') -replace 'PLACEHOLDER_BRIDGE_PATH', '!ESCAPED_PATH!' -replace 'PLACEHOLDER_EXTENSION_ID', '!EXT_ID!' | Out-File -encoding utf8 'server\com.lumina.bridge.json'"

echo [PROGRESS] [###############     ] 75%%

:: Add to Windows Registry
REG ADD "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.lumina.bridge" /ve /t REG_SZ /d "!MANIFEST_PATH!" /f >nul

echo [PROGRESS] [####################] 100%%
echo.
echo ========================================
echo   🎉 SETUP COMPLETE!
echo ========================================
echo.
echo Your engine is now "bridged" to ID: !EXT_ID!
echo.
echo FINAL STEP TO START:
echo 1. Click the Lumina icon (🎓) in your Chrome toolbar.
echo 2. Click the "Start Engine" toggle in the menu.
echo 3. It should turn Green (Engine Active) in ~3 seconds.
echo.
echo Press any key to finish...
pause >nul
exit

