# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BewerbungsBot is a desktop chat application: a **Next.js 16 / React 19** frontend, a **Python FastAPI** backend, and an **Electron** shell that bundles both into a Windows app. The same frontend runs either in a browser (talking to the backend over HTTP) or inside Electron (talking over IPC) — chosen at build time, not in code.

The LLM is not yet wired in: `fake_llm_stream` in [backend/domain/chat_manager.py](backend/domain/chat_manager.py) echoes the prompt and is the designated seam for a real model (intended to live in `backend/llm.py`).

## Repository layout

- `backend/` — FastAPI app. Layered: `main.py` (HTTP routes) → `domain/` (business logic) → `db/` (persistence).
- `frontend/` — Next.js app router. UI in `app/` and `components/`; API access in `lib/`.
- `electron/` — TypeScript main + preload, compiled to `electron/dist/`.
- `tests/backend/` — pytest suite (the only test target configured at the repo root).
- `scripts/` — `.bat` (Windows) and `.sh` (POSIX) launchers, paired by name.
- `docs/` — setup guides (`guides/`) and historical fix reports (`reports/`); `guides/PROGRAMM_LOGIK.md` is a German file-by-file map.

## Commands

Run from the repo root unless noted. On Windows the `.bat` scripts are canonical; `.sh` equivalents exist for POSIX.

**Run the app (two modes):**
- Web (browser, HTTP mode): `scripts/dev-web.bat` — backend on `127.0.0.1:8000`, frontend on `localhost:3000`. Also `npm run dev`.
- Electron (dev): press **F5** in VS Code → "Electron: Dev", or `npm run electron:dev`. In dev mode the backend is started **separately** by the dev script; Electron only spawns the PyInstaller `app.exe` in production builds.

**Backend (Python 3.11):** dependencies live in `backend/.venv`; install with `backend\.venv\Scripts\pip install -r backend/requirements.txt`.
- Test: `backend\.venv\Scripts\pytest` (config in `pyproject.toml`: testpaths `tests/backend`, `pythonpath=["."]`, `asyncio_mode=auto`).
- Single test: `backend\.venv\Scripts\pytest tests/backend/test_messages.py::test_name`
- Lint / format: `ruff check .` / `ruff format .`  · Types: `mypy backend`

**Frontend (run inside `frontend/`):**
- Test: `npm test` (Vitest, jsdom) · watch: `npm run test:watch`
- Lint: `npm run lint` · Format: `npm run format`

**Production build:** `npm run electron:build` (PyInstaller backend → IPC frontend build → Electron compile), then `npm run electron:package` for the Windows installer.

## Architecture

### Backend: ChatManager + pluggable Database

`main.py` holds no business logic — every route delegates to **`ChatManager`** ([backend/domain/chat_manager.py](backend/domain/chat_manager.py)), a class with only classmethods and class-level state (a process-wide singleton, not instantiated). It keeps an in-memory `dict[int, Chat]` cache in front of the database and must be `initialize()`-d with a **`ChatRepository`** before use and `shutdown()` after. The manager deliberately does **not** know about connecting/disconnecting — that database lifecycle is owned by the caller. The FastAPI `lifespan` handler opens the `Database`, builds the repository against it (`await SQLiteChatRepository.create(db)`), hands that to the manager, and disconnects on shutdown — but only if no repository was injected first (`_repo is None`), which is how tests inject their own.

Persistence is split in two, with the dependency pointing **repository → database** (never the reverse): the **`Database` ABC** ([backend/db/database_interface.py](backend/db/database_interface.py)) owns only the connection lifecycle (`connect`/`disconnect` plus a live `connection`), and the query logic lives on **repository ABCs** (`ChatRepository` in [backend/db/chat_repository_interface.py](backend/db/chat_repository_interface.py)). A repository is constructed *against* a connected database and owns its own schema — `await SQLiteChatRepository.create(db)` builds it and runs `initialize_schema()` (an async factory, since `__init__` can't await). `SQLiteDatabase` + `SQLiteChatRepository` (in the [backend/db/sqlite/](backend/db/sqlite/) package, one class per file) are the only implementation (aiosqlite, WAL mode, FK cascade); `SQLiteDatabase` has no reference to any repository. Swapping databases means writing a new `Database` subclass plus repository implementations — the manager and routes stay unchanged. This adapter boundary is the focus of the `feature/db-adapter` branch.

Domain models (`Chat`, `Message`) are plain dataclasses in [backend/domain/chat.py](backend/domain/chat.py).

Detailed backend conventions and gotchas (message roles, `BB_DB_PATH`, timestamps, imports) live in [.claude/rules/backend.md](.claude/rules/backend.md), which loads automatically when you edit backend files.

### Streaming responses

`POST /api/chats/{id}/message` returns **NDJSON** (`application/x-ndjson`), one JSON event per line: `{"type":"token","content":"..."}`. The route persists the user message, streams tokens from `fake_llm_stream`, then persists the assembled assistant message. The client parses lines and dispatches on `type`.

### Frontend: HTTP/IPC adapter pattern

`lib/api/factory.ts` is a singleton factory that returns either **`HttpAdapter`** or **`IpcAdapter`** (both implement the `ApiClient` interface in `lib/api/types.ts`), selected by the `NEXT_PUBLIC_API_MODE` env var (`http` = dev/browser, `ipc` = Electron production via `window.electronApi` from `preload.ts`). High-level functions in `lib/api.ts` (`fetchChatList`, `addChat`, …) call through the factory so UI code never knows which transport is in use.

Detailed frontend conventions (including the `streamChatMessage` adapter-bypass gotcha) live in [.claude/rules/frontend.md](.claude/rules/frontend.md), which loads automatically when you edit frontend files.

### Electron process flow

`electron/main.ts` finds an open port (from 8000 up), resolves the venv Python across several candidate paths, and in production spawns the PyInstaller `app.exe` from `resourcesPath`. It exposes an `api:request` IPC handler that proxies fetches to the backend, bridged to the renderer through `preload.ts`. The window loads `localhost:3000` in dev and the static export in production.

## Path-scoped rules

Conventions that only matter in one part of the tree live in `.claude/rules/` and load lazily when Claude reads matching files:

- [.claude/rules/backend.md](.claude/rules/backend.md) — scoped to `backend/**` and `tests/backend/**`
- [.claude/rules/frontend.md](.claude/rules/frontend.md) — scoped to `frontend/**`
