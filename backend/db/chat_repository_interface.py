from abc import ABC, abstractmethod
from datetime import datetime

from backend.domain.chat import Chat


class ChatRepository(ABC):
    """Query logic for chats and their messages.

    Implementations are constructed by their owning ``Database`` and pull the
    live connection lazily, so they never hold a stale handle across a
    reconnect. A future ``MessageRepository`` may split the message methods out;
    for now they live here because a message only exists within a chat.
    """

    @abstractmethod
    async def list_chats(self, limit: int | None = None, offset: int = 0) -> list[Chat]:
        """Chat metadata (no messages) ordered by created_at DESC."""

    @abstractmethod
    async def add_chat(self) -> Chat:
        """Insert a new chat with NULL title. Returns the Chat with id and created_at."""

    @abstractmethod
    async def remove_chat(self, chat_id: int) -> None:
        """Delete a chat. Cascades to messages. No-op if missing."""

    @abstractmethod
    async def load_messages(self, chat: Chat) -> None:
        """Populate chat.messages in place, ordered by created_at ASC."""

    @abstractmethod
    async def push_message(
        self,
        chat_id: int,
        role: str,
        content: str,
        created_at: datetime,
    ) -> None:
        """Insert a message. Caller supplies created_at so memory and DB stay in sync."""
