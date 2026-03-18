@echo off
chcp 65001 >nul 2>&1
title Wspólne Pastwisko
cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   Node.js nie jest zainstalowany!
    echo.
    echo   Zainstaluj go z: https://nodejs.org
    echo   [wystarczy wersja LTS]
    echo.
    pause
    exit /b 1
)

echo.
echo   Wspólne Pastwisko
echo.

if not exist "node_modules" (
    echo   Instalowanie zaleznosci [pierwszy raz]...
    call npm install --silent
    if %errorlevel% neq 0 (
        echo.
        echo   Blad instalacji. Sprawdz polaczenie z internetem.
        pause
        exit /b 1
    )
    echo   Zaleznosci zainstalowane!
)

echo   Uruchamianie serwera...
echo.

node server.js

echo.
echo   Serwer zatrzymany.
pause
