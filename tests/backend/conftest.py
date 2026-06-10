from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

from backend.db.chat_repository_interface import ChatRepository
from backend.db.sqlite import SQLiteChatRepository, SQLiteDatabase
from backend.domain.chat_manager import ChatManager
from backend.main import app

TEST_DB_DIR = Path(".data") / "tests" / "database"


@pytest_asyncio.fixture(autouse=True)
async def fresh_chat_manager(request):
    """One on-disk SQLite file per test under .data/tests/database/.

    Real-disk path on purpose — exercises the production code path
    (mkdir, file locking, journal mode). Parallel-safe because the
    filename is unique per test node.
    """
    safe_name = request.node.name.replace("/", "_").replace(":", "_")
    db_path = TEST_DB_DIR / f"{safe_name}.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    for stale in (
        db_path,
        db_path.with_suffix(".db-wal"),
        db_path.with_suffix(".db-shm"),
    ):
        if stale.exists():
            stale.unlink()

    # The fixture owns the database lifecycle; ChatManager only takes the repo.
    db = SQLiteDatabase(db_path)
    await ChatManager.shutdown()
    await db.connect()
    repo = await SQLiteChatRepository.create(db)
    await ChatManager.initialize(repo)
    try:
        yield db_path
    finally:
        await ChatManager.shutdown()
        await db.disconnect()
        for stale in (
            db_path,
            db_path.with_suffix(".db-wal"),
            db_path.with_suffix(".db-shm"),
        ):
            if stale.exists():
                stale.unlink()


@pytest_asyncio.fixture
async def connect_repo():
    """Factory that opens a SQLiteDatabase on a path and returns its
    ChatRepository, disconnecting every database it opened at teardown. Lets a
    test simulate a process restart without owning the connection lifecycle.

    Teardown runs before the autouse `fresh_chat_manager` unlinks the files, so
    no connection is left holding a lock when the .db is removed."""
    opened: list[SQLiteDatabase] = []

    async def _connect(path: Path) -> ChatRepository:
        db = SQLiteDatabase(path)
        await db.connect()
        opened.append(db)
        return await SQLiteChatRepository.create(db)

    yield _connect
    for db in opened:
        await db.disconnect()


@pytest.fixture
def client():
    return TestClient(app)


@pytest_asyncio.fixture
async def aclient():
    """Async HTTP client over ASGI transport. Used for streaming endpoints
    so the response body can be consumed incrementally with `aclient.stream`."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
