from unittest.mock import AsyncMock

import pytest

from backend.domain.chat import Chat
from backend.domain.chat_manager import ChatManager


# --- Initialization / lifecycle ---


async def test_initialize_loads_newest_chats_up_to_limit(
    fresh_chat_manager, connect_repo
):
    # Seed 5 chats in the live DB, restart manager with limit=3.
    for _ in range(5):
        await ChatManager.add_chat()
    await ChatManager.shutdown()
    ChatManager.set_initial_limit(3)
    await ChatManager.initialize(await connect_repo(fresh_chat_manager))
    listed = await ChatManager.list_chats()
    assert len(listed) == 3
    ChatManager.set_initial_limit(20)  # restore default for other tests


async def test_set_initial_limit_changes_initialize_window(
    fresh_chat_manager, connect_repo
):
    for _ in range(4):
        await ChatManager.add_chat()
    await ChatManager.shutdown()
    ChatManager.set_initial_limit(2)
    await ChatManager.initialize(await connect_repo(fresh_chat_manager))
    assert len(await ChatManager.list_chats()) == 2
    ChatManager.set_initial_limit(20)


async def test_load_more_chats_pages_in_older_chats(fresh_chat_manager, connect_repo):
    for _ in range(5):
        await ChatManager.add_chat()
    await ChatManager.shutdown()
    ChatManager.set_initial_limit(2)
    await ChatManager.initialize(await connect_repo(fresh_chat_manager))
    assert len(await ChatManager.list_chats()) == 2
    older = await ChatManager.load_more_chats(limit=2, offset=2)
    assert len(older) == 2
    assert len(await ChatManager.list_chats()) == 4
    ChatManager.set_initial_limit(20)


async def test_add_chat_caches_in_memory():
    chat = await ChatManager.add_chat()
    listed = await ChatManager.list_chats()
    assert chat.id in [c.id for c in listed]


async def test_remove_chat_removes_from_cache_and_db(fresh_chat_manager, connect_repo):
    chat = await ChatManager.add_chat()
    await ChatManager.remove_chat(chat.id)
    assert chat.id not in [c.id for c in await ChatManager.list_chats()]
    # Restart and confirm DB-side removal too.
    await ChatManager.shutdown()
    await ChatManager.initialize(await connect_repo(fresh_chat_manager))
    assert chat.id not in [c.id for c in await ChatManager.list_chats()]


# --- Messages (direct add_message) ---


async def test_load_messages_populates_chat():
    chat = await ChatManager.add_chat()
    await ChatManager.add_message(chat.id, "user", "first")
    await ChatManager.add_message(chat.id, "model", "second")
    fresh = Chat(id=chat.id)
    await ChatManager.load_messages(fresh)
    assert [(m.role, m.content) for m in fresh.messages] == [
        ("user", "first"),
        ("model", "second"),
    ]


async def test_add_message_persists(fresh_chat_manager, connect_repo):
    chat = await ChatManager.add_chat()
    await ChatManager.add_message(chat.id, "user", "hello")

    # Restart, confirm the message is on disk.
    await ChatManager.shutdown()
    await ChatManager.initialize(await connect_repo(fresh_chat_manager))
    fresh = next(c for c in await ChatManager.list_chats() if c.id == chat.id)
    await ChatManager.load_messages(fresh)
    assert [(m.role, m.content) for m in fresh.messages] == [("user", "hello")]


async def test_add_message_updates_cache():
    chat = await ChatManager.add_chat()
    await ChatManager.add_message(chat.id, "user", "cached")
    cached = next(c for c in await ChatManager.list_chats() if c.id == chat.id)
    assert [(m.role, m.content) for m in cached.messages] == [("user", "cached")]


async def test_add_message_propagates_db_error():
    chat = await ChatManager.add_chat()
    real_repo = ChatManager._repo
    real_repo.push_message = AsyncMock(  # type: ignore[union-attr]
        side_effect=RuntimeError("disk full")
    )
    with pytest.raises(RuntimeError, match="disk full"):
        await ChatManager.add_message(chat.id, "user", "x")
