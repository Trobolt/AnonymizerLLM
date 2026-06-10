import json


async def test_streaming_round_trip_persists_user_and_model(aclient):
    add = await aclient.post("/api/chats/add")
    chat_id = add.json()["chat_id"]

    async with aclient.stream(
        "POST",
        f"/api/chats/{chat_id}/message",
        json={"message": "hi", "chat_id": chat_id},
    ) as resp:
        assert resp.status_code == 200
        events = []
        async for line in resp.aiter_lines():
            if line.strip():
                events.append(json.loads(line))

    assert events, "expected at least one streamed event"
    assert all(ev.get("type") == "token" for ev in events), events
    streamed = "".join(ev["content"] for ev in events)

    msgs = (await aclient.get(f"/api/chats/{chat_id}/messages")).json()
    assert msgs["chat_id"] == chat_id
    assert [m["role"] for m in msgs["messages"]] == ["user", "model"]
    assert msgs["messages"][0]["content"] == "hi"
    assert msgs["messages"][1]["content"] == streamed


async def test_get_messages_for_missing_chat_returns_empty(aclient):
    resp = await aclient.get("/api/chats/999999/messages")
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"chat_id": 999999, "messages": []}
