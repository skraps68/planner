"""Redis client singletons for realtime features. Best-effort: never raise."""
import logging
from typing import Optional

import redis
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

CHANGES_CHANNEL = "rt:changes"

_sync_client: Optional[redis.Redis] = None


def _redis_kwargs() -> dict:
    return dict(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
    )


def get_sync_redis() -> Optional[redis.Redis]:
    """Memoized sync client, or None when disabled/unreachable."""
    global _sync_client
    if not settings.REALTIME_ENABLED:
        return None
    if _sync_client is not None:
        return _sync_client
    try:
        client = redis.Redis(**_redis_kwargs())
        client.ping()
        _sync_client = client
        return _sync_client
    except Exception as exc:  # noqa: BLE001
        logger.warning("realtime: sync redis unavailable: %s", exc)
        return None


def make_async_redis() -> aioredis.Redis:
    """Fresh async client for a single SSE subscriber (caller must aclose)."""
    return aioredis.Redis(**_redis_kwargs())
