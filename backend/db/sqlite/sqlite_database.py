from pathlib import Path

import aiosqlite

from backend.db.database_interface import Database


class SQLiteDatabase(Database):
    def __init__(self, path: Path) -> None:
        if not isinstance(path, Path):
            raise TypeError(
                f"SQLiteDatabase requires a pathlib.Path; got {type(path).__name__}. "
                "':memory:' is not supported."
            )
        if not path.parent.exists():
            raise FileNotFoundError(f"Parent directory does not exist: {path.parent}")
        self._path = path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._conn = await aiosqlite.connect(self._path)

    async def disconnect(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    @property
    def connection(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("SQLiteDatabase used before connect()")
        return self._conn
