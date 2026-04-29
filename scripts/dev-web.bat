@echo off
REM ============================================================
REM  dev-web.bat
REM  Starts backend (FastAPI/uvicorn) and frontend (Next.js)
REM  in HTTP mode. Frontend is reachable at http://localhost:3000
REM  Backend is reachable at http://127.0.0.1:8000
REM
REM  Used by:
REM    - launch.json  -> "Web: Dev (HTTP, Firefox)"
REM    - tasks.json   -> "Dev: Web Servers"
REM    - package.json -> "npm run dev"
REM ============================================================
setlocal
cd /d "%~dp0\.."

set NEXT_PUBLIC_API_MODE=http
set BROWSER=none

echo [dev-web] Starting backend + frontend (HTTP mode)...
call npx --yes concurrently --kill-others-on-fail ^
    --names "BACKEND,FRONTEND" ^
    --prefix-colors "blue,green" ^
    "cd backend && .venv\Scripts\uvicorn.exe main:app --reload --host 127.0.0.1 --port 8000" ^
    "cd frontend && node_modules\.bin\next.cmd dev"

endlocal
