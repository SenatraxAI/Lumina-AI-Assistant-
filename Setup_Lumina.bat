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

:: 4. Engine Mode Selection
echo.
echo [3/3] Configure Engine Startup...
echo.
echo   FIRST-TIME SETUP: Using DEBUG MODE
echo   - You'll see a BLACK TERMINAL window when the engine starts.
echo   - This lets you verify everything works correctly.
echo   - Once confirmed, run "Switch_To_Silent.bat" to hide the window.
echo.
set "MODE_CHOICE=2"

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "PROJECT_DIR=%~dp0"
set "LAUNCH_VBS=%~dp0Launch_Lumina.vbs"
set "LAUNCH_BAT=%~dp0Run_Lumina.bat"
set "SC_PATH=%STARTUP_FOLDER%\Lumina_AI_Engine.lnk"
set "DESKTOP_SC=%USERPROFILE%\Desktop\Lumina AI Engine.lnk"

:: DEBUG MODE: Link directly to .bat
set "TARGET_APP=cmd.exe"
set "TARGET_ARG=/k \"%LAUNCH_BAT%\""
echo [i] Configured for VISIBLE DEBUG WINDOW.

:: Create Shortcut using temporary script for robustness
echo [i] Creating shortcuts...
echo $startup = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup) > "%TEMP%\lumina_sc.ps1"
echo $projectDir = "%PROJECT_DIR%" >> "%TEMP%\lumina_sc.ps1"
echo $launchBat = "%LAUNCH_BAT%" >> "%TEMP%\lumina_sc.ps1"
echo $launchVbs = "%LAUNCH_VBS%" >> "%TEMP%\lumina_sc.ps1"
echo $mode = "%MODE_CHOICE%" >> "%TEMP%\lumina_sc.ps1"
echo $ws = New-Object -ComObject WScript.Shell >> "%TEMP%\lumina_sc.ps1"
echo if ($mode -eq "2") { $target = "cmd.exe"; $args = "/k `"$launchBat`"" } else { $target = "wscript.exe"; $args = "`"$launchVbs`"" } >> "%TEMP%\lumina_sc.ps1"
echo $sc = $ws.CreateShortcut((Join-Path $startup "Lumina_AI_Engine.lnk")) >> "%TEMP%\lumina_sc.ps1"
echo $sc.TargetPath = $target >> "%TEMP%\lumina_sc.ps1"
echo $sc.Arguments = $args >> "%TEMP%\lumina_sc.ps1"
echo $sc.WorkingDirectory = $projectDir >> "%TEMP%\lumina_sc.ps1"
echo $sc.IconLocation = "shell32.dll, 24" >> "%TEMP%\lumina_sc.ps1"
echo $sc.Save() >> "%TEMP%\lumina_sc.ps1"
echo $desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop) >> "%TEMP%\lumina_sc.ps1"
echo $dsc = $ws.CreateShortcut((Join-Path $desktop "Lumina AI Engine.lnk")) >> "%TEMP%\lumina_sc.ps1"
echo $dsc.TargetPath = $target >> "%TEMP%\lumina_sc.ps1"
echo $dsc.Arguments = $args >> "%TEMP%\lumina_sc.ps1"
echo $dsc.WorkingDirectory = $projectDir >> "%TEMP%\lumina_sc.ps1"
echo $dsc.IconLocation = "shell32.dll, 24" >> "%TEMP%\lumina_sc.ps1"
echo $dsc.Save() >> "%TEMP%\lumina_sc.ps1"

powershell -ExecutionPolicy Bypass -File "%TEMP%\lumina_sc.ps1"
del "%TEMP%\lumina_sc.ps1"

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
