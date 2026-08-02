@echo off
title Voucher Tracker - Starting...
cd /d "D:\AIProjects\voucher-tracker"

echo ============================================
echo   Voucher Tracker Dev Server
echo   Frontend: http://localhost:3001
echo   Backend:  http://localhost:3002
echo ============================================

echo [1/3] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to be ready...
    :docker_loop
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 goto docker_loop
    echo Docker is ready.
) else (
    echo Docker already running.
)

echo [2/3] Starting database container...
docker start vt-postgres >nul 2>&1
if errorlevel 1 (
    docker compose up -d postgres >nul 2>&1
)

echo [3/3] Clearing ports and starting servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1

start "Voucher Tracker" cmd /k "cd /d D:\AIProjects\voucher-tracker && npm run dev"

echo Done. Voucher Tracker is starting in a new window.
