@echo off
cd /d c:\saversureV2\backend
echo Killing existing backend process on port 30400...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":30400" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo Starting backend...
start /B go run ./cmd/api/... > out.log 2>&1
timeout /t 5 /nobreak >nul
echo Backend restarted.
echo AGENT_SCRIPT_DONE
