import asyncio
import json
import os
import random
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

from backend.db.init_db import DatabaseManager
from backend.domain.chat_manager import ChatManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Own the DB lifecycle here (connect/close); ChatManager only needs the repo.
    # Skip entirely if a repository was already injected (tests inject their own).
    owns_db = ChatManager._repo is None
    db_manager = None
    if owns_db:
        db_manager = DatabaseManager(
            Path(".data/database/chats.db"), DatabaseManager.DatabaseType.SQLITE
        )
        await db_manager.connect()
        await ChatManager.initialize(db_manager.get_chat_repo())
    try:
        yield
    finally:
        if owns_db and db_manager is not None:
            await ChatManager.shutdown()
            await db_manager.close()


app = FastAPI(title="BewerbungsBot Backend", lifespan=lifespan)


@app.get("/api/chats/list")
async def get_chats_list():
    chats = await ChatManager.list_chats()
    return {"chat_ids": [c.id for c in chats]}


@app.post("/api/chats/add")
async def add_chat():
    chat = await ChatManager.add_chat()
    return {"chat_id": chat.id}


@app.post("/api/chats/{chat_id}/remove")
async def remove_chat(chat_id: int):
    await ChatManager.remove_chat(chat_id)
    return {"status": "success", "removed_chat_id": chat_id}


@app.get("/api/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: int):
    chat = next(
        (c for c in await ChatManager.list_chats() if c.id == chat_id),
        None,
    )
    if chat is None:
        return {"chat_id": chat_id, "messages": []}
    await ChatManager.load_messages(chat)
    return {
        "chat_id": chat_id,
        "messages": [{"role": m.role, "content": m.content} for m in chat.messages],
    }


@app.post("/api/chats/{chat_id}/message")
async def send_message(chat_id: int, request_body: dict):
    """Persist the user message, stream a token-by-token response as NDJSON,
    then persist the assembled assistant message."""
    user_message = str(request_body.get("message", ""))
    await ChatManager.add_message(chat_id, "user", user_message)

    async def fake_llm_stream(prompt: str) -> AsyncIterator[str]:
        """Placeholder token stream. Echoes the prompt as discrete tokens
        followed by a short canned tail, with a tiny inter-token delay so the
        client actually sees streaming behavior. Replace with a real model in
        backend/llm.py."""
        tail = ["(", "echo", ":", " ", *list(prompt), ")"]
        for tok in tail:
            await asyncio.sleep(random.expovariate(20))
            yield tok

    async def token_generator():
        collected: list[str] = []
        async for tok in fake_llm_stream(user_message):
            collected.append(tok)
            yield json.dumps({"type": "token", "content": tok}) + "\n"
        await ChatManager.add_message(chat_id, "model", "".join(collected))

    return StreamingResponse(token_generator(), media_type="application/x-ndjson")


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
