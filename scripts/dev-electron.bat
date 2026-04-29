@echo off
REM ============================================================
REM  dev-electron.bat
REM  Runs Electron in DEBUG mode so errors are visible.
REM   - Compiles electron/*.ts to electron/dist/*.js
REM   - Starts FastAPI backend on http://127.0.0.1:8000
REM   - Starts Next.js dev server in HTTP mode (Electron loads
REM     http://localhost:3000)
REM   - Launches Electron with DevTools and verbose logging
REM
REM  Used by:
REM    - launch.json  -> "Electron: Dev (debug)"
REM    - tasks.json   -> "Dev: Electron (debug)"
REM    - package.json -> "npm run dev:electron"
REM ============================================================
setlocal
cd /d "%~dp0\.."

echo [dev-electron] Compiling Electron TypeScript...
call npx tsc --project electron/tsconfig.json
if errorlevel 1 (
    echo [dev-electron] TypeScript compile failed.
    exit /b 1
)

set NODE_ENV=development
set NEXT_PUBLIC_API_MODE=http
set BROWSER=none
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1

echo [dev-electron] Starting backend + Next.js dev server + Electron (debug)...
call npx --yes concurrently --kill-others ^
    --names "BACKEND,FRONTEND,ELECTRON" ^
    --prefix-colors "blue,green,magenta" ^
    "cd backend && .venv\Scripts\uvicorn.exe main:app --reload --host 127.0.0.1 --port 8000" ^
    "npm --prefix frontend run dev" ^
    "npx --yes wait-on http://localhost:3000 && npx electron --inspect=5858 ."
echo [dev-electron] Ended backend + Next.js dev server + Electron (debug)...

endlocal
