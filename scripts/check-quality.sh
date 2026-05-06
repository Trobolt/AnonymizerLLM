#!/bin/bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "=== Ruff: Lint ==="
"$ROOT/backend/.venv/bin/ruff" check "$ROOT/backend"

echo ""
echo "=== Mypy: Type Check ==="
"$ROOT/backend/.venv/bin/mypy" "$ROOT/backend"

echo ""
echo "=== Prettier: Format Check ==="
cd "$ROOT/frontend"
npx prettier --check .

echo ""
echo "[OK] All checks passed."
