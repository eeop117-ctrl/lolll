@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Windows 12 (Claude)

rem Порт по умолчанию; если занят — берём следующий свободный
set "PORT=8080"
:findport
netstat -an | findstr /c:":%PORT% " >nul && (set /a PORT+=1 & goto findport)
set "URL=http://localhost:%PORT%"

echo ============================================
echo   Windows 12 — запуск
echo   Адрес: %URL%
echo   Чтобы остановить, закройте это окно.
echo ============================================
echo.

rem Открыть браузер через 1.5 сек, когда сервер уже поднимется
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 1500; Start-Process '%URL%'"

rem 1) Node.js, если установлен
where node >nul 2>nul
if not errorlevel 1 (
  node server.js
  goto end
)

rem 2) Без Node.js — встроенный в Windows PowerShell
echo Node.js не найден — запускаю встроенный сервер PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT%
if not errorlevel 1 goto end

rem 3) Последний вариант — открыть файл напрямую
echo Не удалось запустить сервер, открываю index.html напрямую...
start "" "%~dp0index.html"

:end
echo.
pause
