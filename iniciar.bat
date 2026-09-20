@echo off
cd /d "%~dp0"
echo CreateObject("Wscript.Shell").Run "cmd /c cd /d ""%~dp0"" && node server.js", 0, False > "%temp%\clubetiro_start.vbs"
wscript "%temp%\clubetiro_start.vbs"
timeout /t 2 /nobreak >nul
start http://localhost:3000
