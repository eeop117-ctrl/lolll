@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0legacy-ui-reference\Claude"
if not exist start.bat (
  echo UI source was not found.
  pause
  exit /b 1
)
call start.bat
