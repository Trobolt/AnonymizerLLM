---
paths:
  - "backend/**/*.py"
  - "tests/backend/**/*.py"
---

# Backend conventions

Loaded when editing backend or backend-test files. Architecture overview lives in the root `CLAUDE.md`.

## Domain rules

- Message roles are **`"user"` and `"model"`** — never `"assistant"`. A SQLite `CHECK` constraint enforces this; using any other value will fail at insert time. Match it in routes, tests, and the frontend.
- All business logic goes through `ChatManager` (`backend/domain/chat_manager.py`); `main.py` routes only delegate. `ChatManager` is a classmethod singleton with class-level state — it is never instantiated. Call `ChatManager.initialize(repo)` with a **`ChatRepository`** before use and `ChatManager.shutdown()` after. The manager does **not** connect/disconnect — that database lifecycle belongs to the caller.
- The FastAPI `lifespan` handler owns the `Database`: it connects, hands `db.chats` to the manager, and disconnects on shutdown — but only when no repository was injected first (`_repo is None`). That gap is intentional — it lets tests connect their own `Database` and inject `db.chats` before the app starts (see the `connect_repo` fixture).

## Persistence

- Never touch SQLite directly outside the `backend/db/sqlite/` package. Persistence is split in two: the `Database` ABC (`backend/db/database_interface.py`) owns only the **connection lifecycle** (`connect`/`disconnect`) and exposes per-domain repositories; the query logic lives on **repository ABCs** (one class per file, e.g. `backend/db/chat_repository_interface.py` → `ChatRepository`). Whoever opens the `Database` (the `lifespan`, the test fixtures) passes `db.chats` to consumers — `ChatManager` holds only a `ChatRepository` and uses `repo.list_chats(...)`. Repositories pull the live connection lazily from their owning `Database`, so a reconnect never strands a closed handle. To add a new backend, subclass `Database` **and** each repository ABC (e.g. `SQLiteDatabase` + `SQLiteChatRepository`, one class per file under `backend/db/sqlite/`) — the manager and routes stay unchanged. One class per file is the convention in this package.
- DB path comes from the `BB_DB_PATH` env var (default `data/database/chats.db`). `SQLiteDatabase` requires a `pathlib.Path` and **rejects `":memory:"`**; tests use real per-test files on disk.
- Timestamps are caller-supplied (`add_message` passes `datetime.now(UTC)`) so the in-memory cache and DB stay in sync.
- **`created_at` is stored as integer seconds since the Unix epoch (UTC)**, and loaded back as a naive datetime in **local** time. The converters live on the `Database` ABC (`backend/db/interface.py`) as shared static methods so every backend uses the same representation: `format_timestamp(dt) -> int` is `int(dt.timestamp())` (casts to UTC epoch seconds); `parse_timestamp(s) -> datetime` is `datetime.fromtimestamp(s)` (UTC instant → naive local). Sub-second precision is dropped.

## Streaming

- `POST /api/chats/{id}/message` returns **NDJSON** (`application/x-ndjson`), one JSON event per line: `{"type":"token","content":"..."}`. Persist the user message, stream tokens, then persist the assembled assistant message.
- `fake_llm_stream` is the placeholder model seam (intended to be replaced in `backend/llm.py`).

## Style & imports

- Python 3.11, double quotes, 88-col (ruff format owns wrapping; `E501` is ignored). Imports sorted by ruff's isort rules.
- Imports are absolute from the repo root (`from backend.db.sqlite import SQLiteDatabase`, re-exported by the package `__init__`). This is why pytest sets `pythonpath=["."]`.
- Tests: `backend\.venv\Scripts\pytest`; single test: `pytest tests/backend/test_messages.py::test_name`. Config in `pyproject.toml` (`asyncio_mode=auto`, real on-disk per-test SQLite files).
