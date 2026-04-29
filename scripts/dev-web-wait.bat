@echo off
REM ============================================================
REM  dev-web-wait.bat
REM  Starts backend (FastAPI/uvicorn) and frontend (Next.js)
REM  in HTTP mode, and WAITS for the frontend to be ready
REM  before returning (allows Firefox debugger to attach).
REM  
REM  Frontend is reachable at http://localhost:3000
REM  Backend is reachable at http://127.0.0.1:8000
REM
REM  Used by:
REM    - launch.json  -> "Web: Dev (HTTP, Firefox)" (via preLaunchTask)
REM ============================================================
setlocal
cd /d "%~dp0\.."

set NEXT_PUBLIC_API_MODE=http
set BROWSER=none

echo [dev-web-wait] Starting backend + frontend (HTTP mode)...
call npx --yes concurrently --kill-others-on-fail ^
    --names "BACKEND,FRONTEND" ^
    --prefix-colors "blue,green" ^
    "cd backend && .venv\Scripts\uvicorn.exe main:app --reload --host 127.0.0.1 --port 8000" ^
    "cd frontend && node_modules\.bin\next.cmd dev" &

REM Get the PID of the concurrently process so we can monitor it
set CONCURRENT_PID=%ERRORLEVEL%

echo [dev-web-wait] Waiting for frontend to be ready on http://localhost:3000...
REM Wait up to 30 seconds for the frontend to respond
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -ErrorAction Stop; exit 0 } catch { exit 1 }" 
    if %ERRORLEVEL% equ 0 (
        echo [dev-web-wait] Frontend is ready!
        endlocal
        exit /b 0
    )
    echo [dev-web-wait] Waiting... %%i/30
    timeout /t 1 /nobreak
)

echo [dev-web-wait] ERROR: Frontend did not start within 30 seconds
endlocal
exit /b 1
