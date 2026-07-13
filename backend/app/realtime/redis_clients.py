"""Redis client singletons for realtime features. Best-effort: never raise."""
import logging
import time
from typing import Optional

import redis
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

CHANGES_CHANNEL = "rt:changes"

_RETRY_COOLDOWN_S = 5.0

_sync_client: Optional[redis.Redis] = None
_last_failure_ts: Optional[float] = None


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
    global _sync_client, _last_failure_ts
    if not settings.REALTIME_ENABLED:
        return None
    if _sync_client is not None:
        return _sync_client
    if (
        _last_failure_ts is not None
        and time.monotonic() - _last_failure_ts < _RETRY_COOLDOWN_S
    ):
        return None
    try:
        client = redis.Redis(
            **_redis_kwargs(),
            socket_connect_timeout=0.5,
            socket_timeout=2.0,
        )
        client.ping()
        _sync_client = client
        _last_failure_ts = None
        return _sync_client
    except Exception as exc:  # noqa: BLE001
        logger.warning("realtime: sync redis unavailable: %s", exc)
        _last_failure_ts = time.monotonic()
        return None


def make_async_redis() -> aioredis.Redis:
    """Fresh async client for a single SSE subscriber (caller must aclose)."""
    return aioredis.Redis(**_redis_kwargs(), socket_connect_timeout=2.0)
