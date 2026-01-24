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

:: Update Shortcuts using temporary script
echo [1/2] Updating shortcuts to Silent Mode...
echo $startup = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup) > "%TEMP%\lumina_silent.ps1"
echo $desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop) >> "%TEMP%\lumina_silent.ps1"
echo $projectDir = "%~dp0" >> "%TEMP%\lumina_silent.ps1"
echo $launchVbs = Join-Path $projectDir "Launch_Lumina.vbs" >> "%TEMP%\lumina_silent.ps1"
echo $ws = New-Object -ComObject WScript.Shell >> "%TEMP%\lumina_silent.ps1"
echo $targets = @((Join-Path $startup "Lumina_AI_Engine.lnk"), (Join-Path $desktop "Lumina AI Engine.lnk")) >> "%TEMP%\lumina_silent.ps1"
echo foreach ($path in $targets) { >> "%TEMP%\lumina_silent.ps1"
echo    $sc = $ws.CreateShortcut($path) >> "%TEMP%\lumina_silent.ps1"
echo    $sc.TargetPath = "wscript.exe" >> "%TEMP%\lumina_silent.ps1"
echo    $sc.Arguments = "`"$launchVbs`"" >> "%TEMP%\lumina_silent.ps1"
echo    $sc.WorkingDirectory = $projectDir >> "%TEMP%\lumina_silent.ps1"
echo    $sc.Save() >> "%TEMP%\lumina_silent.ps1"
echo } >> "%TEMP%\lumina_silent.ps1"

powershell -ExecutionPolicy Bypass -File "%TEMP%\lumina_silent.ps1"
del "%TEMP%\lumina_silent.ps1"

echo.
echo ========================================
echo   SILENT MODE ACTIVATED!
echo ========================================
echo.
echo From now on, Lumina will run invisibly in the background.
echo You can still use the Desktop shortcut to restart it manually.
echo.
pause
