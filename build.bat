@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title MiniOS - build installable live ISO (GitHub Actions)
cd /d "%~dp0"
echo ==================================================
echo   MiniOS 0.9 - building installable ISO in the cloud
echo   Needs only Git. No Linux / WSL / winget.
echo ==================================================
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Opening the download page...
  echo Install it with default options, then run build.bat again.
  start "" https://git-scm.com/download/win
  pause & exit /b 1
)
if not exist ".git" git init -b main
for /f "delims=" %%i in ('git config user.email') do set GEM=%%i
if not defined GEM (
  set /p GEM=Your e-mail for git commits: 
  git config user.email "!GEM!"
  git config user.name "MiniOS Builder"
)
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo.
  echo Create an EMPTY repository on GitHub ^(private is fine^); the page will open now.
  start "" https://github.com/new
  set /p URL=Paste the repo URL ^(https://github.com/USER/REPO.git^): 
  git remote add origin "!URL!"
)
if exist "debian-live\auto" del /q "debian-live\auto"
git add -A
git commit -m "MiniOS build" >nul 2>nul
git branch -M main
git push -u origin main
if errorlevel 1 (echo. & echo git push failed - check login/URL and run again. & pause & exit /b 1)
for /f "delims=" %%u in ('git remote get-url origin') do set REMOTE=%%u
set "WEB=!REMOTE:.git=!"

where gh >nul 2>nul
if errorlevel 1 goto manual
gh auth status >nul 2>nul || goto manual
gh workflow run build-live-iso.yml || goto manual
echo Waiting for the run to appear...
timeout /t 10 /nobreak >nul
for /f %%i in ('gh run list --workflow build-live-iso.yml --limit 1 --json databaseId --jq ".[0].databaseId"') do set RUNID=%%i
echo Run !RUNID! - building ^(20-40 min^). Do not close this window.
gh run watch !RUNID! --exit-status || (echo BUILD FAILED & pause & exit /b 1)
if exist build-live rmdir /s /q build-live
gh run download !RUNID! -n minios-0.9-amd64-iso -D build-live || (pause & exit /b 1)
echo DONE: ISO is in build-live\
explorer build-live
pause & exit /b 0

:manual
echo.
echo Code is pushed. Now in the browser that opens:
echo   1. Click "Run workflow" ^(green button^) and wait 20-40 min until it is green.
echo   2. Open the finished run, scroll down to Artifacts, download minios-0.9-amd64-iso.
echo   3. Unzip it - the ISO is inside. Test ONLY in a VirtualBox VM with a blank disk.
start "" "!WEB!/actions/workflows/build-live-iso.yml"
pause
