Set WshShell = CreateObject("WScript.Shell")
strPath = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
WshShell.Run chr(34) & strPath & "Run_Lumina.bat" & chr(34), 0
Set WshShell = Nothing
