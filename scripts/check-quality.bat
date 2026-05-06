@echo off
setlocal
set ROOT=%~dp0..
set FAILED=0

echo.
echo === Ruff: Lint ===
"%ROOT%\backend\.venv\Scripts\ruff.exe" check "%ROOT%\backend"
if %errorlevel% neq 0 set FAILED=1

echo.
echo === Mypy: Type Check ===
"%ROOT%\backend\.venv\Scripts\mypy.exe" "%ROOT%\backend"
if %errorlevel% neq 0 set FAILED=1

echo.
echo === Prettier: Format Check ===
cd "%ROOT%\frontend"
call npx prettier --check .
if %errorlevel% neq 0 set FAILED=1

echo.
if %FAILED%==1 (
    echo [FAIL] One or more checks failed.
    exit /b 1
) else (
    echo [OK] All checks passed.
    exit /b 0
)
