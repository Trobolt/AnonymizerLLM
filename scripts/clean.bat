@echo off
setlocal
REM Move to the directory where the script is located
cd /d "%~dp0"
cd ".."

echo [clean] Starting deep clean of compiled artifacts...

REM --- Frontend Compiled Files (Next.js & TS) ---
echo Cleaning Frontend...
if exist "frontend\.next" (
    rmdir /s /q "frontend\.next"
    echo   - Removed frontend\.next
)
if exist "frontend\out" (
    rmdir /s /q "frontend\out"
    echo   - Removed frontend\out
)
if exist "frontend\tsconfig.tsbuildinfo" (
    del /f /q "frontend\tsconfig.tsbuildinfo"
    echo   - Removed frontend\tsconfig.tsbuildinfo
)

REM --- Backend Compiled Files (PyInstaller/Build) ---
echo Cleaning Backend...
if exist "backend\build" (
    rmdir /s /q "backend\build"
    echo   - Removed backend\build
)
if exist "backend\dist" (
    rmdir /s /q "backend\dist"
    echo   - Removed backend\dist
)

REM --- Root Dist Folder ---
if exist "dist" (
    echo Cleaning Root...
    rmdir /s /q "dist"
    echo   - Removed root\dist
)

REM --- Cache Folders ---
echo Cleaning Caches...
if exist ".data" (
    rmdir /s /q ".data"
    echo   - Removed data
)
if exist ".mypy_cache" (
    rmdir /s /q ".mypy_cache"
    echo   - Removed .mypy_cache
)
if exist ".ruff_cache" (
    rmdir /s /q ".ruff_cache"
    echo   - Removed .ruff_cache
)

if exist ".pytest_cache" (
    rmdir /s /q ".pytest_cache"
    echo   - Removed .pytest_cache
)


REM --- Python Bytecode (Recursive) ---
set "pycache_removed="

for /d /r "backend" %%d in (__pycache__) do (
    if exist "%%d" (
        rmdir /s /q "%%d"
        set "pycache_removed=1"
    )
)

if defined pycache_removed (
    echo   - Removed __pycache__ recursively
)
echo [clean] Success! Compiled files removed.
endlocal