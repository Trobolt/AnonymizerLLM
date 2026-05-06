import json


def test_get_messages_returns_list(client):
    chat_id = client.post("/api/chats/add").json()["chat_id"]
    response = client.get(f"/api/chats/{chat_id}/messages")
    assert response.status_code == 200
    data = response.json()
    assert data["chat_id"] == chat_id
    assert isinstance(data["messages"], list)


def test_send_message_streams_ndjson_tokens(client):
    chat_id = client.post("/api/chats/add").json()["chat_id"]

    with client.stream(
        "POST",
        f"/api/chats/{chat_id}/message",
        json={"message": "hello"},
    ) as response:
        assert response.status_code == 200
        content = b"".join(response.iter_bytes()).decode()

    lines = [line for line in content.strip().split("\n") if line.strip()]
    assert len(lines) > 0, "Expected at least one streamed token"

    for line in lines:
        token_data = json.loads(line)
        assert "token" in token_data, f"Line missing 'token' key: {line}"


def test_send_empty_message_still_streams(client):
    chat_id = client.post("/api/chats/add").json()["chat_id"]

    with client.stream(
        "POST",
        f"/api/chats/{chat_id}/message",
        json={"message": ""},
    ) as response:
        assert response.status_code == 200
