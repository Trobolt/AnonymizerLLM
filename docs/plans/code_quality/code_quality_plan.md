# Feature: Code Quality & Testing Infrastructure

Replaces the current zero-test, zero-CI codebase with a layered quality system: linting/formatting enforced locally via pre-commit, unit tests for backend and frontend, E2E tests via Playwright, all gated by GitHub Actions — with Docker available for fully isolated test runs.
This feature is split into 4 sub-features that build on each other.

---

## Sub-feature 1: Static Analysis & Formatting Tooling

**Why:**
The project currently has ESLint on the frontend only. The Python backend has no linter, no formatter, and no type checker. This makes code review inconsistent and lets trivial bugs (unused imports, wrong types) slip through. Fixing this first means CI can enforce it from day one.

**What:**

*Python — Ruff + Mypy*
- **Ruff** replaces black + isort + flake8 in one tool. Extremely fast. Add `ruff.toml` at repo root.
- **Mypy** for static type checking. Add `mypy.ini` at repo root. `backend/main.py` already has some type hints; mypy will surface gaps.
- Add a `requirements-dev.txt` next to `requirements.txt` for dev-only deps.

*Frontend — Prettier*
- Prettier for consistent formatting (Next.js has no formatter currently).
- Add `.prettierrc` and `.prettierignore` in `frontend/`.
- Wire into `frontend/package.json` scripts: `"format": "prettier --write ."` and `"format:check": "prettier --check ."`.

*Pre-commit hooks*
- `pre-commit` framework (`pip install pre-commit`) with a `.pre-commit-config.yaml` at repo root.
- Hooks: `ruff` (lint), `ruff-format` (format), `mypy`, `prettier` (via `prettier-hooks` mirror), `eslint`.
- Runs automatically on `git commit`; CI runs `pre-commit run --all-files`.

```
# .pre-commit-config.yaml skeleton
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.4
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        files: backend/
        additional_dependencies: [fastapi, pydantic]
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v4.0.0-alpha.8
    hooks:
      - id: prettier
        files: ^frontend/
```

*TypeScript strict mode*
- Set `"strict": true` in `electron/tsconfig.json` and `frontend/tsconfig.json`.
- Fix any errors this surfaces.

**Key files:**
- `ruff.toml` — new; configures Python lint rules and target Python version
- `mypy.ini` — new; configures mypy for `backend/`
- `.pre-commit-config.yaml` — new; hooks for all stacks
- `frontend/.prettierrc` — new; Prettier config
- `frontend/tsconfig.json` — enable `strict`
- `electron/tsconfig.json` — enable `strict`
- `backend/requirements-dev.txt` — new; `ruff`, `mypy`, `pre-commit`

**Missing / open questions:**
- Mypy strictness level: start with `--ignore-missing-imports` to avoid stubs noise, tighten later
- Decide if Prettier replaces the ESLint formatting rules or complements them (recommend: Prettier for format, ESLint for logic)

**Acceptance criteria:**
- [ ] `pre-commit run --all-files` exits 0 on a clean repo
- [ ] `cd frontend && npm run format:check` exits 0
- [ ] `mypy backend/` exits 0
- [ ] TypeScript `tsc --noEmit` exits 0 in both `frontend/` and `electron/`

**Out of scope:**
- Fixing every existing lint error before merging (use `# noqa` sparingly to unblock, clean up separately)
- Linting generated files (`.next/`, `dist/`, `frontend/out/`)

**How to test:**
Introduce a deliberate formatting error in `backend/main.py` (e.g., wrong spacing), run `pre-commit run --all-files`, verify it fails. Fix it, verify it passes.

---

## Sub-feature 2: Unit & Integration Tests

**Why:**
No test files exist anywhere in the project. This means every change is manually verified (or not). Unit tests give confidence that API contracts hold and that component logic is correct without running the full app.

**What:**

*Backend — pytest + httpx*

FastAPI ships with a `TestClient` built on `httpx`. Tests live in `tests/backend/`.

```
tests/
└── backend/
    ├── conftest.py       # TestClient fixture, mock data
    ├── test_health.py    # GET /health → 200
    ├── test_chats.py     # CRUD: list, add, remove
    └── test_messages.py  # POST message, streaming NDJSON response
```

`conftest.py` creates a `TestClient(app)` fixture and a temporary in-memory state (or monkeypatches the chat store) so tests are independent and don't touch real files/DBs.

Key tests:
- `GET /health` returns `{"status": "ok"}`
- `POST /api/chats/add` creates a chat, returns its ID
- `GET /api/chats/list` returns list including the created chat
- `POST /api/chats/{id}/remove` returns 200 and chat is gone
- `POST /api/chats/{id}/message` returns streaming NDJSON with at least one line

*Frontend — Vitest + React Testing Library*

Vitest is the natural choice for Next.js with TypeScript. Tests live in `tests/frontend/` or co-located as `*.test.tsx`.

```
tests/
└── frontend/
    ├── components/
    │   ├── Sidebar.test.tsx
    │   ├── ChatInterface.test.tsx
    │   └── Settings.test.tsx
    └── lib/
        └── api.factory.test.ts   # factory returns correct adapter
```

Add to `frontend/package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^1",
  "@testing-library/react": "^15",
  "@testing-library/user-event": "^14",
  "@vitejs/plugin-react": "^4",
  "jsdom": "^24"
}
```

Add `frontend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
})
```

Key tests:
- `Sidebar` renders chat list, calls `onNewChat` when button clicked
- `ChatInterface` renders messages, calls API on submit
- `api.factory` returns `HttpAdapter` when `NEXT_PUBLIC_API_MODE=http`

**Key files:**
- `tests/backend/conftest.py` — new
- `tests/backend/test_chats.py` — new
- `tests/backend/test_messages.py` — new
- `tests/frontend/components/*.test.tsx` — new
- `frontend/vitest.config.ts` — new
- `frontend/package.json` — add test scripts + vitest deps
- `backend/requirements-dev.txt` — add `pytest`, `httpx`, `pytest-asyncio`

**Missing / open questions:**
- Backend chat state: is it in-memory (dict) or persisted? If persisted (SQLite/file), tests need to reset state between runs — either inject a dependency or use `monkeypatch`.
- Streaming NDJSON tests: `TestClient` supports streaming via `with client.stream(...)`. Confirm this works with FastAPI's `StreamingResponse`.

**Acceptance criteria:**
- [ ] `cd tests/backend && pytest` exits 0, all endpoints covered
- [ ] `cd frontend && npm test` exits 0, all components have at least one test
- [ ] Tests are independent (no shared state between test cases)
- [ ] Test run takes < 30 seconds

**Out of scope:**
- 100% line coverage (aim for critical paths only)
- Testing Electron IPC (that's E2E territory)
- Mocking the LLM (real calls would be slow/expensive; tests should stub the AI response)

**How to test:**
Break a known endpoint (e.g., return wrong status code), run pytest, verify the test fails. Restore the endpoint, verify green.

---

## Sub-feature 3: End-to-End Tests (Playwright)

**Why:**
Unit tests don't catch integration failures between the frontend and backend, or UI flows that depend on real HTTP calls. Playwright tests the app as a user would — in a real browser — and can also drive Electron directly.

**What:**

Playwright runs against the dev server (`npm run dev` from repo root). Tests live in `tests/e2e/`.

```
tests/
└── e2e/
    ├── playwright.config.ts
    ├── chat.spec.ts       # full chat flow: create chat → send message → see response
    ├── sidebar.spec.ts    # create/delete chats, switch between them
    └── settings.spec.ts   # open/close settings panel
```

`playwright.config.ts` sets `baseURL: 'http://localhost:3000'` and uses `webServer` to auto-start the dev stack before tests.

Install: `npm install -D @playwright/test` at repo root, then `npx playwright install chromium`.

Key flows:
- User opens app → sidebar shows "No chats" state
- User clicks "New Chat" → chat appears in sidebar
- User types a message and submits → spinner shows → assistant response appears
- User deletes chat → chat removed from sidebar

**Key files:**
- `tests/e2e/playwright.config.ts` — new
- `tests/e2e/chat.spec.ts` — new
- `tests/e2e/sidebar.spec.ts` — new
- `package.json` (root) — add `"test:e2e": "playwright test"` script

**Missing / open questions:**
- The backend calls an LLM for real responses; E2E tests either need a mock server or should use a stub LLM endpoint. Recommend adding an env var `BEWERBUNGSBOT_TEST_MODE=1` that makes the backend return a fixed "echo" response.
- CI will need the dev server running before Playwright starts — `webServer` in playwright config handles this automatically.

**Acceptance criteria:**
- [ ] `npm run test:e2e` passes against a running dev server
- [ ] All 3 spec files have at least one passing test
- [ ] Playwright HTML report generated in `tests/e2e/playwright-report/`

**Out of scope:**
- Electron-native Playwright tests (requires `electron` launch mode — add later)
- Visual regression testing (screenshots)
- Cross-browser testing in CI (chromium only is fine initially)

**How to test:**
Remove the `onNewChat` handler from Sidebar, run E2E, verify `sidebar.spec.ts` fails. Restore it, verify green.

---

## Sub-feature 4: GitHub Actions CI Pipeline

**Why:**
Without CI, quality checks only run if developers remember to. GitHub Actions enforces lint, types, and tests on every push and pull request, blocking merges when checks fail.

**What:**

Two workflows:

*`.github/workflows/ci.yml`* — runs on every push and PR to `master`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
      - run: ruff check backend/
      - run: mypy backend/
      - run: pytest tests/backend/

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run format:check
      - run: cd frontend && npx tsc --noEmit
      - run: cd frontend && npm test

  e2e:
    runs-on: ubuntu-latest
    needs: [backend, frontend]   # only run after unit tests pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pip install -r backend/requirements.txt
      - run: cd frontend && npm ci
      - run: npm ci  # root (installs playwright)
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          BEWERBUNGSBOT_TEST_MODE: '1'
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/
```

*Docker (optional, for local parity with CI)*

A `docker-compose.test.yml` at repo root spins up an isolated backend + runs pytest against it:

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports: ["8000:8000"]
    environment:
      - BEWERBUNGSBOT_TEST_MODE=1
  test-runner:
    build:
      context: ./tests
      dockerfile: Dockerfile.test
    depends_on: [backend]
    environment:
      - BACKEND_URL=http://backend:8000
```

`backend/Dockerfile.dev` — lightweight Python image, not PyInstaller:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt -r requirements-dev.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Run with: `docker compose -f docker-compose.test.yml up --abort-on-container-exit`

The Docker setup is optional for CI (GitHub Actions runners are fast enough), but useful for contributors who want fully reproducible test runs without polluting their local Python environment.

**Key files:**
- `.github/workflows/ci.yml` — new; main CI pipeline
- `backend/Dockerfile.dev` — new; dev/test Docker image for backend
- `docker-compose.test.yml` — new; isolated test environment

**Missing / open questions:**
- Does the E2E job need the backend and frontend both running? Yes — `playwright.config.ts` `webServer` should start both via `npm run dev`.
- GitHub Actions minutes: E2E tests add ~3-5 min. Consider running E2E only on PRs, not every push.
- Branch protection rules in GitHub repo settings must be enabled to actually block merges on CI failure.

**Acceptance criteria:**
- [ ] Pushing to `master` triggers the CI workflow in GitHub Actions
- [ ] A PR with a failing test cannot be merged (branch protection enabled)
- [ ] `docker compose -f docker-compose.test.yml up --abort-on-container-exit` runs backend tests in isolation
- [ ] Playwright report uploaded as artifact on E2E failure

**Out of scope:**
- Deployment (CD) — out of scope for now, app is a desktop installer
- Build artifact publishing (installer `.exe`) — separate workflow, add later
- Windows runners in CI — ubuntu is fine for server-side tests; electron packaging can stay local

**How to test:**
Open a PR that breaks a backend test. Verify CI fails and merge is blocked. Fix the test, verify CI goes green.

---

## Other Quality Improvements (Not Planned as Sub-features)

These are high-value, low-effort changes that don't warrant their own sub-feature doc:

1. **`.env.example` file** — the project likely has env vars (API keys, ports). Document them with an example file so new contributors know what to set. Add `.env` to `.gitignore` if not already there.

2. **Error boundaries in React** — wrap `ChatInterface` in a React `ErrorBoundary` so a crash in one component doesn't blank the whole app.

3. **`CONTRIBUTING.md`** — one-page doc: how to set up the dev environment, run tests, run linting. This is the first thing a new contributor reads.

4. **Pin dependency versions** — `requirements.txt` already pins versions. Do the same for `requirements-dev.txt`. Frontend uses `^` ranges; consider `package-lock.json` being committed (already is) — ensure CI uses `npm ci` not `npm install`.

5. **`pyproject.toml`** — consolidate Python config (ruff, mypy, pytest settings) into a single `pyproject.toml` at repo root instead of multiple `*.ini`/`*.toml` files.
