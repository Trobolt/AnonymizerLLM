from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio

from backend.db.sqlite import SQLiteChatRepository, SQLiteDatabase
from backend.domain.chat import Chat


@pytest_asyncio.fixture
async def db(fresh_chat_manager):
    """Use the autouse fixture's on-disk path, but talk to a *separate*
    SQLiteDatabase connection so we exercise this layer in isolation.

    Yields the chat repository directly, since these tests only exercise query
    logic — the Database itself only owns the connection lifecycle."""
    db_path: Path = fresh_chat_manager
    # ChatManager already opened that file; open a second connection on the same
    # file. SQLite handles concurrent connections fine with WAL mode.
    sub_path = db_path.with_name(db_path.stem + ".direct.db")
    inst = SQLiteDatabase(sub_path)
    await inst.connect()
    try:
        yield await SQLiteChatRepository.create(inst)
    finally:
        await inst.disconnect()
        for stale in (
            sub_path,
            sub_path.with_suffix(".db-wal"),
            sub_path.with_suffix(".db-shm"),
        ):
            if stale.exists():
                stale.unlink()


async def test_list_chats_empty(db):
    assert await db.list_chats() == []


async def test_add_chat_returns_chat_with_id_and_timestamp(db):
    chat = await db.add_chat()
    assert isinstance(chat.id, int) and chat.id > 0
    assert chat.title is None
    assert chat.messages == []
    assert isinstance(chat.created_at, datetime)


async def test_list_chats_orders_newest_first(db):
    chats = [await db.add_chat() for _ in range(3)]
    listed = await db.list_chats()
    assert [c.id for c in listed] == [c.id for c in reversed(chats)]


async def test_list_chats_respects_limit_and_offset(db):
    chats = [await db.add_chat() for _ in range(5)]
    page1 = await db.list_chats(limit=2, offset=0)
    page2 = await db.list_chats(limit=2, offset=2)
    assert [c.id for c in page1] == [chats[4].id, chats[3].id]
    assert [c.id for c in page2] == [chats[2].id, chats[1].id]


async def test_remove_chat_removes_chat(db):
    chat = await db.add_chat()
    await db.remove_chat(chat.id)
    assert await db.list_chats() == []


async def test_remove_chat_cascades_to_messages(db):
    chat = await db.add_chat()
    await db.push_message(chat.id, "user", "hi", datetime.utcnow())
    await db.remove_chat(chat.id)
    # Re-adding to verify by reloading messages on a fresh chat-id container
    fresh = await db.add_chat()
    holder = Chat(id=fresh.id)
    await db.load_messages(holder)
    assert holder.messages == []


async def test_remove_chat_idempotent_for_missing_id(db):
    await db.remove_chat(99999)  # no exception


async def test_push_message_inserts_with_supplied_timestamp(db):
    chat = await db.add_chat()
    when = datetime(2024, 1, 2, 3, 4, 5)
    await db.push_message(chat.id, "user", "hello", when)
    holder = Chat(id=chat.id)
    await db.load_messages(holder)
    assert len(holder.messages) == 1
    msg = holder.messages[0]
    assert msg.role == "user"
    assert msg.content == "hello"
    # Stored as integer epoch seconds (UTC); sub-second precision is dropped.
    assert msg.created_at == when.replace(microsecond=0)


async def test_push_message_with_invalid_chat_id_raises(db):
    with pytest.raises(Exception):  # FK violation
        await db.push_message(99999, "user", "x", datetime.utcnow())


async def test_load_messages_populates_chat_in_place(db):
    chat = await db.add_chat()
    base = datetime.utcnow()
    await db.push_message(chat.id, "user", "first", base)
    await db.push_message(chat.id, "model", "second", base + timedelta(seconds=1))
    holder = Chat(id=chat.id)
    await db.load_messages(holder)
    assert [(m.role, m.content) for m in holder.messages] == [
        ("user", "first"),
        ("model", "second"),
    ]


async def test_load_messages_empty_chat(db):
    chat = await db.add_chat()
    holder = Chat(id=chat.id)
    await db.load_messages(holder)
    assert holder.messages == []


async def test_constructor_rejects_memory_string():
    with pytest.raises(TypeError):
        SQLiteDatabase(":memory:")  # type: ignore[arg-type]
