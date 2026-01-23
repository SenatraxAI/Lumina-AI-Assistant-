@echo off
:: Lumina AI Universal Setup - v4.6
title Lumina AI - Setup Wizard 🎓
setlocal enabledelayedexpansion

echo ========================================
echo   LUMINA AI: PREMIUM SETUP ASSISTANT
echo ========================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. install from: https://www.python.org/
    pause & exit /b
)

:: 2. Virtual Env
if not exist "server\venv" (
    echo [1/3] Creating virtual environment...
    python -m venv server\venv
) else (
    echo [1/3] Environment ready.
)

:: 3. Dependencies
echo [2/3] Installing extensions...
call server\venv\Scripts\activate
pip install -r server\requirements.txt >nul 2>&1

:: 4. Bridge Registration
echo.
echo [3/3] Linking to Chrome...
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo  IMPORTANT: Open chrome://extensions
echo  Copy the ID for 'Lumina Audio Assistant'
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
set /p EXT_ID="Enter Extension ID: "
if "!EXT_ID!"=="" (
    echo [ERROR] Extension ID is required!
    pause & exit /b
)

:: Path Logic
set "BRIDGE_DIR=%~dp0server"
set "PYTHON_EXE=%~dp0server\venv\Scripts\python.exe"
set "BRIDGE_BAT=%~dp0server\bridge.bat"
set "MANIFEST=%~dp0server\com.lumina.bridge.json"

:: Template Replacement (Absolute Paths)
copy /y "!BRIDGE_DIR!\bridge.bat.template" "!BRIDGE_BAT!" >nul
:: Use RAW paths for the batch file
powershell -Command "(gc '!BRIDGE_BAT!') -replace 'PLACEHOLDER_PYTHON_PATH', '!PYTHON_EXE!' | Out-File -encoding utf8 '!BRIDGE_BAT!'"

copy /y "!BRIDGE_DIR!\com.lumina.bridge.json.template" "!MANIFEST!" >nul
:: Use ESCAPED paths for the JSON manifest
set "P_BAT=!BRIDGE_BAT:\=\\!"
powershell -Command "(gc '!MANIFEST!') -replace 'PLACEHOLDER_BRIDGE_PATH', '!P_BAT!' -replace 'PLACEHOLDER_EXTENSION_ID', '!EXT_ID!' | Out-File -encoding utf8 '!MANIFEST!'"

:: Registry
REG ADD "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.lumina.bridge" /ve /t REG_SZ /d "!MANIFEST!" /f >nul

echo.
echo ========================================
echo   🎉 SETUP COMPLETE!
echo ========================================
echo.
echo OPTION A (RECOMENDED): 
echo    Launch the engine in a VISIBLE WINDOW for debugging.
echo.
set /p START_NOW="Launch Engine Window Now? (y/n): "
if /i "!START_NOW!"=="y" (
    start Run_Lumina.bat
    echo.
    echo [!] ENGINE WINDOW OPENED.
)

echo.
echo Final instructions:
echo 1. Reload the Lumina extension in chrome://extensions
echo 2. Open the popup (🎓) - it should turn green automatically.
echo.
pause
