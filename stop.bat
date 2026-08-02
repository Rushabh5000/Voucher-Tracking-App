@echo off
echo Stopping Voucher Tracker (ports 3001 and 3002)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
echo Voucher Tracker stopped.
