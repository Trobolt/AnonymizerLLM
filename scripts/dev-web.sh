#!/usr/bin/env bash
# ============================================================
#  dev-web.sh  (WSL/Linux companion to dev-web.bat)
#  Starts backend (FastAPI/uvicorn) + frontend (Next.js) in HTTP mode.
# ============================================================
set -euo pipefail

# Ensure all child processes die when this script exits (prevents orphaned node/uvicorn).
trap 'kill 0' EXIT INT TERM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

export NEXT_PUBLIC_API_MODE=http
export BROWSER=none

echo "[dev-web] Starting backend + frontend (HTTP mode)..."

# Pick uvicorn from venv if present, otherwise fall back to system uvicorn
if [[ -x "backend/.venv/Scripts/uvicorn.exe" ]]; then
    UVICORN_CMD="backend/.venv/Scripts/uvicorn.exe"
elif [[ -x "backend/.venv/bin/uvicorn" ]]; then
    UVICORN_CMD="backend/.venv/bin/uvicorn"
else
    UVICORN_CMD="uvicorn"
fi

npx --yes concurrently --kill-others-on-fail \
    --names "BACKEND,FRONTEND" \
    --prefix-colors "blue,green" \
    "cd backend && $UVICORN_CMD main:app --reload --host 127.0.0.1 --port 8000" \
    "cd frontend && node_modules/.bin/next dev"
