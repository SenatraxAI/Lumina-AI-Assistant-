@echo off
:: Switch Lumina AI to Silent Mode
title Lumina AI - Switch to Silent Mode
setlocal enabledelayedexpansion

echo ========================================
echo   LUMINA AI: SILENT MODE SWITCHER
echo ========================================
echo.
echo This will update your shortcuts to run Lumina invisibly.
echo.
pause

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "PROJECT_DIR=%~dp0"
set "LAUNCH_VBS=%~dp0Launch_Lumina.vbs"
set "SC_PATH=%STARTUP_FOLDER%\Lumina_AI_Engine.lnk"
set "DESKTOP_SC=%USERPROFILE%\Desktop\Lumina AI Engine.lnk"

:: Update to Silent Mode
set "TARGET_APP=wscript.exe"
set "TARGET_ARG=\"%LAUNCH_VBS%\""

echo [1/2] Updating Startup shortcut...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SC_PATH%'); $Shortcut.TargetPath = '%TARGET_APP%'; $Shortcut.Arguments = '%TARGET_ARG%'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.IconLocation = 'shell32.dll, 24'; $Shortcut.Save()"

echo [2/2] Updating Desktop shortcut...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%DESKTOP_SC%'); $Shortcut.TargetPath = '%TARGET_APP%'; $Shortcut.Arguments = '%TARGET_ARG%'; $Shortcut.WorkingDirectory = '%PROJECT_DIR%'; $Shortcut.IconLocation = 'shell32.dll, 24'; $Shortcut.Save()"

echo.
echo ========================================
echo   SILENT MODE ACTIVATED!
echo ========================================
echo.
echo From now on, Lumina will run invisibly in the background.
echo You can still use the Desktop shortcut to restart it manually.
echo.
pause
