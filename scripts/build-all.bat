@echo off
REM ============================================================
REM  build-all.bat
REM  Full production build:
REM   1) Compile backend with PyInstaller -> dist\app.exe
REM   2) Build Next.js frontend (IPC mode, static export)
REM   3) Compile electron/*.ts -> electron/dist/*.js
REM   4) Package everything via electron-builder -> dist/ installer
REM
REM  Used by:
REM    - tasks.json   -> "Build: Full Executable"
REM    - package.json -> "npm run build"
REM ============================================================
setlocal
cd /d "%~dp0\.."
echo [build-all] [1/6] clean previous builds...
rmdir /s /q "dist"
rmdir /s /q "backend\build"
rmdir /s /q "backend\dist"
echo [build-all] [2/6] Building backend (PyInstaller)...
pushd backend
powershell -ExecutionPolicy RemoteSigned -File build.ps1 -Clean
if errorlevel 1 (
    popd
    echo [build-all] Backend build failed.
    exit /b 1
)
popd

echo [build-all] [3/6] Building frontend (Next.js, IPC mode)...
set NEXT_PUBLIC_API_MODE=ipc
set NEXT_OUTPUT=export
call npm --prefix frontend run build
if errorlevel 1 (
    echo [build-all] Frontend build failed.
    exit /b 1
)

echo [build-all] [4/6] Compiling Electron TypeScript...
call npx tsc --project electron/tsconfig.json
if errorlevel 1 (
    echo [build-all] Electron TS compile failed.
    exit /b 1
)

echo [build-all] [5/6] Packaging installer (electron-builder)...
call npx electron-builder
if errorlevel 1 (
    echo [build-all] Packaging failed.
    exit /b 1
)

echo [build-all] [6/6] Remove intermediate build files...
rmdir /s /q "backend\build"
rmdir /s /q "backend\dist"
echo [build-all] Done. Installer is in dist\
endlocal
