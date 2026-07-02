@echo off
title Voucher Tracker - Dev Server
cd /d "D:\AIProjects\voucher-tracker"

echo ============================================
echo   Voucher Tracker Startup
echo ============================================

:: 1. Start Docker Desktop if not running
docker info >nul 2>&1
if errorlevel 1 (
    call :start_docker
) else (
    echo [1/4] Docker already running.
)

:: 2. Start the PostgreSQL container
echo [2/4] Starting database container...
docker start vt-postgres >nul 2>&1
if errorlevel 1 (
    echo       Container not found, creating via docker compose...
    docker compose up -d postgres
)
call :wait_for_db

:: 3. Free ports 3001 and 5173
echo [3/4] Clearing ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

:: 4. Start dev server
echo [4/4] Starting Voucher Tracker...
echo.
npm run dev
pause
exit /b

:start_docker
echo [1/4] Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo       Waiting for Docker to be ready (may take 30s)...
:docker_loop
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto docker_loop
echo       Docker is ready.
exit /b

:wait_for_db
echo       Waiting for database to be ready...
:db_loop
timeout /t 3 /nobreak >nul
docker exec vt-postgres pg_isready -U voucher_user -d voucher_tracker >nul 2>&1
if errorlevel 1 goto db_loop
echo       Database is ready.
exit /b
