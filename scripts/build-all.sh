#!/usr/bin/env bash
# ============================================================
#  build-all.sh  (WSL/Linux companion to build-all.bat)
#  Full production build: backend (PyInstaller) + frontend (Next.js)
#  + Electron (TS) + electron-builder packaging.
#
#  Note: PyInstaller will produce a Linux ELF when run from WSL,
#  not a Windows .exe. For a Windows installer use build-all.bat.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "[build-all] [1/4] Building backend (PyInstaller)..."
pushd backend >/dev/null
if [[ -x ".venv/bin/python" ]]; then
    PY=".venv/bin/python"
elif [[ -x ".venv/Scripts/python.exe" ]]; then
    PY=".venv/Scripts/python.exe"
else
    PY="python3"
fi
"$PY" -m pip install -q pyinstaller
"$PY" -m PyInstaller pyinstaller.spec --distpath dist --noconfirm
popd >/dev/null

echo "[build-all] [2/4] Building frontend (Next.js, IPC mode)..."
export NEXT_PUBLIC_API_MODE=ipc
export NEXT_OUTPUT=export
npm --prefix frontend run build

echo "[build-all] [3/4] Compiling Electron TypeScript..."
npx tsc --project electron/tsconfig.json

echo "[build-all] [4/4] Packaging installer (electron-builder)..."
npx electron-builder

echo "[build-all] Done. Installer is in dist/"
