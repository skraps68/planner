"""Short-lived, single-use tickets that authorize an SSE connection."""
import secrets
from typing import Optional

from app.core.config import settings
from app.realtime.redis_clients import get_sync_redis

_PREFIX = "rt:ticket:"


def mint_ticket(user_id: str) -> Optional[str]:
    client = get_sync_redis()
    if client is None:
        return None
    token = secrets.token_urlsafe(32)
    try:
        client.setex(f"{_PREFIX}{token}", settings.REALTIME_TICKET_TTL_S, user_id)
        return token
    except Exception:  # noqa: BLE001
        return None


def consume_ticket(token: str) -> Optional[str]:
    client = get_sync_redis()
    if client is None:
        return None
    try:
        return client.getdel(f"{_PREFIX}{token}")
    except Exception:  # noqa: BLE001
        return None
