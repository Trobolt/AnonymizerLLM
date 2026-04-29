# Build script for BewerbungsBot FastAPI backend using PyInstaller
# This script builds the Python FastAPI backend into a standalone executable

param(
    [switch]$Clean,
    [switch]$Dist
)

# Get the script directory
$ScriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "Building BewerbungsBot Backend..." -ForegroundColor Green

# Clean previous builds if requested
if ($Clean) {
    Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path "build") {
        Remove-Item -Path "build" -Recurse -Force
    }
    if (Test-Path "dist") {
        Remove-Item -Path "dist" -Recurse -Force
    }
}

# Check if venv exists
if (-not (Test-Path ".venv")) {
    Write-Host "Virtual environment not found. Please activate your venv first." -ForegroundColor Red
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& ".venv\Scripts\Activate.ps1"

# Install/update PyInstaller if needed
Write-Host "Ensuring PyInstaller is installed..." -ForegroundColor Cyan
pip install -q pyinstaller

# Run PyInstaller
Write-Host "Running PyInstaller..." -ForegroundColor Cyan
python -m PyInstaller pyinstaller.spec --distpath dist --workpath build --noconfirm

if ($LASTEXITCODE -ne 0) {
    Write-Host "PyInstaller build failed!" -ForegroundColor Red
    exit 1
}

# Copy requirements.txt for reference (optional)
if (Test-Path "requirements.txt") {
    Copy-Item "requirements.txt" -Destination "dist\backend\"
}

Write-Host "Backend build complete!" -ForegroundColor Green
Write-Host "Output location: dist\backend\app.exe" -ForegroundColor Cyan

# If dist flag is set, show the dist folder
if ($Dist) {
    Invoke-Item "dist"
}

Write-Host "Build finished successfully!" -ForegroundColor Green
