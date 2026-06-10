from datetime import datetime

import aiosqlite

from backend.db.chat_repository_interface import ChatRepository
from backend.db.database_interface import Database
from backend.db.sqlite.sqlite_database import SQLiteDatabase
from backend.domain.chat import Chat, Message

_DDL = """
CREATE TABLE IF NOT EXISTS chats (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id    INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user','model')),
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created
    ON messages(chat_id, created_at);
"""


class SQLiteChatRepository(ChatRepository):
    def __init__(self) -> None:
        self._db = None

    @classmethod
    async def create(cls, db: Database) -> "SQLiteChatRepository":
        """Construct the repository and ensure its tables exist. Use this
        instead of the bare constructor (``__init__`` cannot be async) so the
        schema is ready before any query runs. The owning ``db`` must already
        be connected."""
        assert isinstance(db, SQLiteDatabase), (
            "SQLiteChatRepository requires a SQLiteDatabase"
        )
        self = cls()
        self._db = db
        await self.initialize_schema()
        return self

    @property
    def _c(self) -> aiosqlite.Connection:
        # Pull the live connection lazily so a reconnect never leaves us holding
        # a closed handle.
        return self._db.connection

    async def initialize_schema(self) -> None:
        """Create the chat/message tables and set the connection pragmas."""
        await self._c.execute("PRAGMA foreign_keys = ON")
        await self._c.execute("PRAGMA journal_mode = WAL")
        await self._c.executescript(_DDL)
        await self._c.commit()

    async def list_chats(self, limit: int | None = None, offset: int = 0) -> list[Chat]:
        sql = (
            "SELECT id, title, created_at FROM chats ORDER BY created_at DESC, id DESC"
        )
        params: tuple = ()
        if limit is not None:
            sql += " LIMIT ? OFFSET ?"
            params = (limit, offset)
        async with self._c.execute(sql, params) as cur:
            rows = await cur.fetchall()
        return [
            Chat(id=row[0], title=row[1], created_at=Database.parse_timestamp(row[2]))
            for row in rows
        ]

    async def add_chat(self) -> Chat:
        async with self._c.execute(
            "INSERT INTO chats (title) VALUES (NULL) RETURNING id, created_at"
        ) as cur:
            row = await cur.fetchone()
        await self._c.commit()
        assert row is not None
        return Chat(id=row[0], title=None, created_at=Database.parse_timestamp(row[1]))

    async def remove_chat(self, chat_id: int) -> None:
        await self._c.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        await self._c.commit()

    async def load_messages(self, chat: Chat) -> None:
        async with self._c.execute(
            "SELECT role, content, created_at FROM messages "
            "WHERE chat_id = ? ORDER BY created_at ASC, id ASC",
            (chat.id,),
        ) as cur:
            rows = await cur.fetchall()
        chat.messages = [
            Message(
                role=row[0], content=row[1], created_at=Database.parse_timestamp(row[2])
            )
            for row in rows
        ]

    async def push_message(
        self,
        chat_id: int,
        role: str,
        content: str,
        created_at: datetime,
    ) -> None:
        await self._c.execute(
            "INSERT INTO messages (chat_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?)",
            (chat_id, role, content, Database.format_timestamp(created_at)),
        )
        await self._c.commit()
