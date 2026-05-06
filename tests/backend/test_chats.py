def test_list_chats_empty_at_start(client):
    response = client.get("/api/chats/list")
    assert response.status_code == 200
    assert response.json() == {"chat_ids": []}


def test_add_chat_returns_id(client):
    response = client.post("/api/chats/add")
    assert response.status_code == 200
    data = response.json()
    assert "chat_id" in data
    assert isinstance(data["chat_id"], int)


def test_added_chat_appears_in_list(client):
    chat_id = client.post("/api/chats/add").json()["chat_id"]

    chat_ids = client.get("/api/chats/list").json()["chat_ids"]
    assert chat_id in chat_ids


def test_add_multiple_chats_all_in_list(client):
    ids = [client.post("/api/chats/add").json()["chat_id"] for _ in range(3)]

    listed = client.get("/api/chats/list").json()["chat_ids"]
    for chat_id in ids:
        assert chat_id in listed


def test_remove_chat(client):
    chat_id = client.post("/api/chats/add").json()["chat_id"]

    response = client.post(f"/api/chats/{chat_id}/remove")
    assert response.status_code == 200
    assert response.json()["removed_chat_id"] == chat_id

    listed = client.get("/api/chats/list").json()["chat_ids"]
    assert chat_id not in listed


def test_remove_nonexistent_chat_is_idempotent(client):
    response = client.post("/api/chats/999/remove")
    assert response.status_code == 200
