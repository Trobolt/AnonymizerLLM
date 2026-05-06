import pytest
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.main import app


@pytest.fixture(autouse=True)
def reset_chat_state():
    original_ids = list(main_module.chat_ids)
    original_next = main_module.next_chat_id

    main_module.chat_ids.clear()
    main_module.next_chat_id = 1

    yield

    main_module.chat_ids.clear()
    main_module.chat_ids.extend(original_ids)
    main_module.next_chat_id = original_next


@pytest.fixture
def client():
    return TestClient(app)
