#!/usr/bin/env bash
# ============================================================
#  dev-electron.sh  (WSL/Linux companion to dev-electron.bat)
#  Runs Electron in debug mode with DevTools + verbose logging.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "[dev-electron] Compiling Electron TypeScript..."
npx tsc --project electron/tsconfig.json

export NODE_ENV=development
export NEXT_PUBLIC_API_MODE=http
export BROWSER=none
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1

echo "[dev-electron] Starting Next.js dev server + Electron (debug)..."
npx --yes concurrently --kill-others-on-fail \
    --names "FRONTEND,ELECTRON" \
    --prefix-colors "green,magenta" \
    "npm --prefix frontend run dev" \
    "npx --yes wait-on http://localhost:3000 && npx electron --inspect=5858 ."
