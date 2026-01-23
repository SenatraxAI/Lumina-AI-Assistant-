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

:: 4. Resident Engine Setup
echo [3/3] Setting up Background Resident Mode...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "PROJECT_DIR=%~dp0"
set "LAUNCH_VBS=%~dp0Launch_Lumina.vbs"
set "SC_PATH=%STARTUP_FOLDER%\Lumina_AI_Engine.lnk"
set "DESKTOP_SC=%USERPROFILE%\Desktop\Lumina AI Engine.lnk"

:: Create vbs shortcut in Startup (using PowerShell)
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SC_PATH%'); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"%LAUNCH_VBS%\"'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.IconLocation = 'shell32.dll, 24'; $Shortcut.Save()"

:: Create desktop shortcut for manual launch
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%DESKTOP_SC%'); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"%LAUNCH_VBS%\"'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.IconLocation = 'shell32.dll, 24'; $Shortcut.Save()"

:: Cleanup Legacy Native Messaging
REG DELETE "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.lumina.bridge" /f >nul 2>&1

echo.
echo ========================================
echo   🎉 RESIDENT SETUP COMPLETE!
echo ========================================
echo.
echo 1. Lumina will now start AUTOMATICALLY when Windows boots.
echo 2. We've added a shortcut to your DESKTOP to start it manually.
echo.
set /p START_NOW="Launch Engine Invisibly Now? (y/n): "
if /i "!START_NOW!"=="y" (
    start "" wscript.exe "!LAUNCH_VBS!"
    echo.
    echo [!] ENGINE STARTED IN BACKGROUND.
)

echo.
echo Final instructions:
echo 1. Reload the Lumina extension in chrome://extensions.
echo 2. Open the popup (🎓) - it should turn green once the engine boots.
echo.
pause
