from datetime import UTC, datetime
from typing import ClassVar

from backend.db.chat_repository_interface import ChatRepository
from backend.domain.chat import Chat, Message


class ChatManager:
    _repo: ClassVar[ChatRepository | None] = None
    _chats: ClassVar[dict[int, Chat]] = {}
    _initial_limit: ClassVar[int] = 20

    @classmethod
    def set_initial_limit(cls, n: int) -> None:
        cls._initial_limit = n

    @classmethod
    async def initialize(cls, repo: ChatRepository) -> None:
        """Bind the manager to a chat repository and warm the in-memory cache.

        The caller owns the database lifecycle (connect/disconnect); the manager
        only cares about queries, so it takes a repository, not a Database."""
        cls._repo = repo
        cls._chats = {}
        for chat in await repo.list_chats(limit=cls._initial_limit):
            cls._chats[chat.id] = chat

    @classmethod
    async def shutdown(cls) -> None:
        cls._repo = None
        cls._chats = {}

    @classmethod
    def _require_repo(cls) -> ChatRepository:
        if cls._repo is None:
            raise RuntimeError("ChatManager.initialize() has not been called")
        return cls._repo

    @classmethod
    async def list_chats(cls) -> list[Chat]:
        return sorted(
            cls._chats.values(),
            key=lambda c: (c.created_at or datetime.min, c.id or 0),
            reverse=True,
        )

    @classmethod
    async def load_more_chats(cls, limit: int, offset: int) -> list[Chat]:
        chats = await cls._require_repo().list_chats(limit=limit, offset=offset)
        for c in chats:
            cls._chats[c.id] = c
        return chats

    @classmethod
    async def add_chat(cls) -> Chat:
        chat = await cls._require_repo().add_chat()
        cls._chats[chat.id] = chat
        return chat

    @classmethod
    async def remove_chat(cls, chat_id: int) -> None:
        cls._chats.pop(chat_id, None)
        await cls._require_repo().remove_chat(chat_id)

    @classmethod
    async def load_messages(cls, chat: Chat) -> None:
        await cls._require_repo().load_messages(chat)

    @classmethod
    async def add_message(cls, chat_id: int, role: str, content: str) -> None:
        now = datetime.now(UTC)

        await cls._require_repo().push_message(chat_id, role, content, now)
        cached = cls._chats.get(chat_id)
        if cached is not None:
            cached.messages.append(Message(role=role, content=content, created_at=now))
