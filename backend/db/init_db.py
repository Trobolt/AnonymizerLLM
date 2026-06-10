from enum import Enum
from pathlib import Path

from backend.db.chat_repository_interface import ChatRepository
from backend.db.database_interface import Database
from backend.db.sqlite.sqlite_chat_repository import SQLiteChatRepository
from backend.db.sqlite.sqlite_database import SQLiteDatabase


class DatabaseManager:
    """Owns the Database connection lifecycle and the repositories built on it.

    __init__ constructs the (unconnected) Database; connect() opens it and builds
    the repositories; close() disconnects. Repositories are handed out via
    get_chat_repo()."""

    class DatabaseType(Enum):
        SQLITE = "sqlite"

    def __init__(self, db_path: Path, db_type: "DatabaseManager.DatabaseType") -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        match db_type:
            case DatabaseManager.DatabaseType.SQLITE:
                self._db: Database = SQLiteDatabase(db_path)
                self._repo_cls: type[SQLiteChatRepository] = SQLiteChatRepository
            case _:
                raise ValueError(f"Unsupported database type: {db_type}")
        self._chat_repo: ChatRepository | None = None

    async def connect(self) -> None:
        await self._db.connect()
        self._chat_repo = await self._repo_cls.create(self._db)

    async def close(self) -> None:
        await self._db.disconnect()

    def get_chat_repo(self) -> ChatRepository:
        if self._chat_repo is None:
            raise RuntimeError("DatabaseManager.connect() has not been called")
        return self._chat_repo
