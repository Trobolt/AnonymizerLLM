# Feature: Database — Persist Chats and Messages

The backend currently stores chats in a Python list that resets on every restart.
This feature replaces it with a real database, split into 4 sub-features that build on each other.

---

## Sub-feature 1: Schema — Define the Tables

**Why:**
Before any code can connect to a database, the structure of the data needs to be defined. This sub-feature answers: what tables exist, what columns do they have, and how are they related?

**What:**
Create `backend/models.py` with two SQLModel table definitions:

**Chat**
| Column | Type | Notes |
|--------|------|-------|
| `id` | int | primary key, auto-increment |
| `title` | str | nullable — does not need to be set on creation |
| `created_at` | datetime | set automatically on insert |

**Message**
| Column | Type | Notes |
|--------|------|-------|
| `id` | int | primary key, auto-increment |
| `chat_id` | int | foreign key → Chat.id |
| `role` | str | `'user'` or `'model'` |
| `content` | TEXT | plain text — keeps FTS straightforward |
| `created_at` | datetime | set automatically on insert |

`models.py` has no database connection logic — it only defines the shape of the data.

**Key files:**
- `backend/models.py` *(new)*

**Missing / open questions:**

- **Index on `Message.chat_id`** — loading a chat's messages filters by `chat_id`. Without an index, the database scans every row in the messages table on every request. As messages accumulate this becomes slow. An index on `chat_id` must be defined in the schema.
- **Cascade delete on the FK** — the foreign key `Message.chat_id → Chat.id` should be defined with `ON DELETE CASCADE`. This means deleting a Chat row automatically deletes all its Message rows at the database level, not just in application code. Without this, a direct database deletion (or a bug in the app) leaves orphaned message rows behind.
- **Role constraint** — `role` is a plain text column with no database-level constraint. Nothing prevents a row with `role = 'banana'`. SQLite has no native enum type; PostgreSQL does. At minimum, validation belongs in sub-feature 3 (application code). Worth noting explicitly.
- **Ordering by last activity** — the sidebar will likely want to show chats ordered by most recent message, not by `created_at` of the chat itself. Consider whether `Chat` needs an `updated_at` field (updated on every new message), or whether this will be derived by querying the latest message timestamp. Deciding now avoids a schema change later.

**Acceptance criteria:**
- [ ] `Chat` table defined with `id`, `title` (nullable), `created_at`
- [ ] `Message` table defined with `id`, `chat_id` (FK → Chat), `role`, `content`, `created_at`
- [ ] Index defined on `Message.chat_id`
- [ ] FK `Message.chat_id` defined with `ON DELETE CASCADE`
- [ ] `models.py` contains no DB connection or query logic

**Out of scope:**
- FTS index (planned separately — will live in a separate `search.db` file)
- Encryption
- Chat rename
- Message metadata / multimodal content

**How to test:**
Point an in-memory SQLite connection at `models.py` and call `create_all()`. Then inspect the created tables: verify both `chat` and `message` exist, that `title` accepts `NULL`, that inserting a `Message` with a non-existent `chat_id` raises a FK error, and that deleting a `Chat` row cascades to its messages. No HTTP server or domain logic is needed — this tests the schema in isolation.

---

## Sub-feature 2: Adapter — Connect Python to the Database

**Why:**
The rest of the codebase should never know whether it is talking to SQLite or PostgreSQL. This layer provides a single, uniform interface for all database operations and hides the driver details behind an adapter pattern.

**What:**
Create a `backend/db/` folder with the adapter pattern:

```
backend/db/
├── __init__.py     # factory: reads DATABASE_URL, returns the right adapter
├── interface.py    # abstract base class — low-level primitives only
├── sqlite.py       # SQLite implementation (aiosqlite driver)
└── postgresql.py   # PostgreSQL implementation (asyncpg driver)
```

**`interface.py`** defines only database-agnostic primitives — no knowledge of chats or messages:
```python
class DatabaseAdapter(ABC):
    async def connect(self) -> None: ...
    # Opens the connection to the database and creates any missing tables.
    # Called once on application startup. After this, the DB is ready for queries.

    async def disconnect(self) -> None: ...
    # Closes the connection and releases all resources.
    # Called on application shutdown to avoid leaving open file handles or connections.

    async def execute(self, statement) -> None: ...
    # Runs a write statement: INSERT, UPDATE, or DELETE.
    # Does not return data. Raises on failure (e.g. FK violation, constraint error).

    async def fetch_one(self, statement) -> dict | None: ...
    # Runs a SELECT and returns the first matching row as a plain dict.
    # Returns None if no row matches — never raises on empty result.

    async def fetch_all(self, statement) -> list[dict]: ...
    # Runs a SELECT and returns all matching rows as a list of dicts.
    # Returns an empty list if no rows match — never raises on empty result.
```

**`sqlite.py`** and **`postgresql.py`** each implement `DatabaseAdapter` using their driver.

**`__init__.py`** is the factory:
```python
def get_db() -> DatabaseAdapter:
    url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./data/chats.db")
    return SQLiteAdapter(url) if url.startswith("sqlite") else PostgreSQLAdapter(url)
```

`connect()` calls `SQLModel.metadata.create_all()` on startup to create tables from the models defined in sub-feature 1.

**Database location:**
| Mode | DATABASE_URL |
|------|-------------|
| Desktop (Electron) | `sqlite+aiosqlite:///%APPDATA%/BewerbungsBot/chats.db` |
| Dev (local) | `sqlite+aiosqlite:///./data/chats.db` (default) |
| Server | `postgresql+asyncpg://user:pass@host/db` |

`electron/main.ts` sets `DATABASE_URL` when spawning the Python process so the desktop build uses the correct path.

**Key files:**
- `backend/db/interface.py` *(new)*
- `backend/db/sqlite.py` *(new)*
- `backend/db/postgresql.py` *(new)*
- `backend/db/__init__.py` *(new)*
- `backend/requirements.txt` — add `sqlmodel`, `aiosqlite`, `asyncpg`
- `backend/pyinstaller.spec` — add `sqlalchemy`, `aiosqlite` hidden imports
- `electron/main.ts` — set `DATABASE_URL` env var when spawning Python

**Acceptance criteria:**
- [ ] `DatabaseAdapter` defines `connect`, `disconnect`, `execute`, `fetch_one`, `fetch_all`
- [ ] `SQLiteAdapter` implements all methods
- [ ] `PostgreSQLAdapter` implements all methods
- [ ] Factory returns the correct adapter based on `DATABASE_URL`
- [ ] `connect()` creates tables on startup if they do not exist
- [ ] Adapter has no knowledge of chats, messages, or any domain concept
- [ ] Works with SQLite locally and PostgreSQL on server

**Out of scope:**
- Query logic (which rows to fetch, what to insert) — that belongs in sub-feature 3
- FTS index setup

**How to test:**
Test each adapter independently. For `SQLiteAdapter`, use an in-memory database (`sqlite+aiosqlite:///:memory:`) so tests leave no files on disk. For `PostgreSQLAdapter`, spin up a local PostgreSQL instance (or a Docker container) with a dedicated test database. In both cases: call `connect()`, then run `execute()` with an insert statement and verify the row appears via `fetch_one()`. Test `fetch_all()` with multiple rows. Test `fetch_one()` returns `None` on no match. Test the factory by setting `DATABASE_URL` to each format and asserting the correct adapter type is returned.

---

## Sub-feature 3: Domain Classes — Chats and Messages in Memory

**Why:**
`main.py` should not build raw SQL queries. A thin class layer represents chats and messages as Python objects and encapsulates all database access behind readable method calls.

**What:**
Create `backend/chat.py` with two classes that use the adapter from sub-feature 2:

**`Chat`**
```python
class Chat:
    id: int
    title: str | None
    created_at: datetime

    @staticmethod
    async def create(title: str | None = None) -> "Chat": ...   # insert row, return instance
    @staticmethod
    async def get_all() -> list["Chat"]: ...                     # fetch all chats
    @staticmethod
    async def get_by_id(chat_id: int) -> "Chat | None": ...      # fetch single chat

    async def delete(self) -> None: ...                          # delete chat + its messages
    async def add_message(self, role: str, content: str) -> "Message": ...
    async def get_messages(self) -> list["Message"]: ...         # ordered by created_at
```

**`Message`**
```python
class Message:
    id: int
    chat_id: int
    role: str
    content: str
    created_at: datetime
```

All database access inside these classes goes through `get_db()` from sub-feature 2 — no raw SQL in `chat.py`.

**Key files:**
- `backend/chat.py` *(new)*

**Acceptance criteria:**
- [ ] `Chat.create()` inserts a row and returns a `Chat` instance
- [ ] `Chat.get_all()` returns all chats ordered by `created_at`
- [ ] `Chat.get_by_id()` returns a `Chat` or `None`
- [ ] `chat.delete()` removes the chat and all its messages (no orphaned rows)
- [ ] `chat.add_message()` inserts a `Message` row and returns a `Message` instance
- [ ] `chat.get_messages()` returns messages ordered by `created_at`
- [ ] No raw SQL or direct adapter calls outside of `chat.py`

**Out of scope:**
- Chat rename / title update
- Message editing or deletion
- Streaming logic

**How to test:**
Use an in-memory SQLite adapter (from sub-feature 2) as the dependency so tests run without touching the filesystem. Call `Chat.create()` and assert the returned instance has an `id` and the correct `title`. Call `Chat.get_all()` and assert the list grows with each creation. Call `chat.delete()` and assert both the chat and its messages are gone — verify no orphaned messages remain by querying the messages table directly via the adapter. Test `chat.get_messages()` returns rows in chronological order by inserting messages with different timestamps.

---

## Sub-feature 4: Rewrite main.py — Use the Domain Classes

**Why:**
`main.py` currently uses an in-memory list. This sub-feature replaces all five endpoints with the `Chat` and `Message` classes from sub-feature 3, so data is persisted to the database.

**What:**
Rewrite each endpoint in `backend/main.py`:

| Endpoint | Before | After |
|----------|--------|-------|
| `GET /api/chats/list` | return in-memory list | `Chat.get_all()` |
| `POST /api/chats/add` | append to list | `Chat.create(title)` |
| `POST /api/chats/{id}/remove` | remove from list | `chat.delete()` |
| `GET /api/chats/{id}/messages` | return hardcoded message | `chat.get_messages()` |
| `POST /api/chats/{id}/message` | stream simulated response | save user message → stream → save model message |

**Streaming + persistence:** the user message is saved before streaming starts. The model response tokens are accumulated during streaming and saved as a single `Message` row once streaming ends.

The in-memory `chat_ids` list and `next_chat_id` counter are removed entirely.

**Key files:**
- `backend/main.py` — remove in-memory storage, rewrite all five endpoints

**Acceptance criteria:**
- [ ] In-memory `chat_ids` list removed from `main.py`
- [ ] All five endpoints use `Chat` / `Message` classes exclusively
- [ ] User message is persisted before the streaming response begins
- [ ] Model message is persisted after streaming completes (full content, not per-token)
- [ ] All existing API response shapes are unchanged — frontend requires no changes
- [ ] Chats and messages survive a backend restart

**Out of scope:**
- LLM integration (response is still simulated)
- Auth / multi-user
- Alembic migrations (tracks schema changes for live databases with real user data — not needed until post-launch)

**How to test:**
Use FastAPI's built-in `TestClient` to send HTTP requests against the real endpoints. Wire the test setup to use an in-memory SQLite database so no files are created. Test the full flow in sequence: create a chat → verify it appears in the list → send a message → verify both the user message and the model message are returned by the messages endpoint → delete the chat → verify it no longer appears in the list and its messages are gone. Finally, simulate a restart by re-initialising the adapter and verify the data is still present — this confirms persistence, not just in-memory state.
