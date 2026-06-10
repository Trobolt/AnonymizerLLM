from abc import ABC, abstractmethod
from datetime import datetime


class Database(ABC):
    """Connection lifecycle for a backend. Subclasses manage a live connection
    and expose it to repositories; the query logic lives on the repositories,
    which are constructed against a connected Database, not owned by it.
    """

    @staticmethod
    def parse_timestamp(s: int) -> datetime:
        return datetime.fromtimestamp(s)

    @staticmethod
    def format_timestamp(dt: datetime) -> int:
        return int(dt.timestamp())

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...
