@echo off
setlocal EnableExtensions
chcp 65001 >nul
title MiniOS C - Windows Build (no Linux / no WSL)
cd /d "%~dp0"
echo ==================================================
echo   MiniOS C Kernel - native Windows build tools
echo   No WSL, no Ubuntu, no Linux distribution
echo ==================================================
echo.
set "MSYS=C:\msys64"
if not exist "%MSYS%\usr\bin\bash.exe" (
  echo MSYS2 build tools are not installed yet.
  echo This is a Windows toolchain environment, NOT a Linux installation.
  echo.
  where winget.exe >nul 2>nul
  if errorlevel 1 (
    echo Install MSYS2 from https://www.msys2.org/ and run this file again.
    pause
    exit /b 1
  )
  echo Installing MSYS2 once via winget...
  winget install --id MSYS2.MSYS2 --exact --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Could not install MSYS2 automatically. Install it from https://www.msys2.org/
    pause
    exit /b 1
  )
  if not exist "%MSYS%\usr\bin\bash.exe" (
    echo MSYS2 was installed to a custom location or needs setup.
    echo Install it to C:\msys64, then run build.bat again.
    pause
    exit /b 1
  )
)
echo Project: %~dp0
echo.
echo BUILD SCRIPT VERSION: 2026-10-18-MULTIBOOT2-DIAGNOSTICS-0.6
echo Installing/checking Windows build tools (one-time; no Linux/WSL)...
"%MSYS%\usr\bin\bash.exe" "%~dp0build-msys.sh"
if errorlevel 1 (
  echo.
  echo BUILD FAILED. The complete error is shown above.
  pause
  exit /b 1
)
echo.
echo SUCCESS: build\minios-c.iso
echo Open the ISO in VirtualBox/QEMU using Legacy BIOS mode.
if exist "%~dp0build" explorer "%~dp0build"
pause
