from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Message:
    role: str
    content: str
    created_at: datetime | None = None


@dataclass
class Chat:
    id: int | None = None
    title: str | None = None
    created_at: datetime | None = None
    messages: list[Message] = field(default_factory=list)
