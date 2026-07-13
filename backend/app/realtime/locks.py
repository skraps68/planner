"""Redis-backed advisory soft-locks (best-effort, TTL + heartbeat).

Locks are advisory only: they exist to warn collaborators that someone
else is editing, never to gate writes. Any failure talking to Redis must
degrade OPEN (acquired=True, holder=None) rather than block real editing.
"""
import json
from typing import Optional

from app.core.config import settings
from app.realtime.redis_clients import get_sync_redis


def _key(entity_type: str, entity_id: str) -> str:
    return f"rt:lock:{entity_type}:{entity_id}"


def _holder(client, key: str) -> Optional[dict]:
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


def acquire_lock(entity_type: str, entity_id: str, user_id: str, user_name: str) -> dict:
    client = get_sync_redis()
    if client is None:
        return {"acquired": True, "holder": None}  # degrade open
    key = _key(entity_type, entity_id)
    payload = json.dumps({"user_id": user_id, "name": user_name})
    try:
        ok = client.set(key, payload, nx=True, px=settings.LOCK_TTL_MS)
    except Exception:  # noqa: BLE001
        return {"acquired": True, "holder": None}  # degrade open
    if ok:
        return {"acquired": True, "holder": {"user_id": user_id, "name": user_name}}
    holder = _holder(client, key)
    if holder and holder.get("user_id") == user_id:  # re-entrant: refresh TTL
        try:
            client.pexpire(key, settings.LOCK_TTL_MS)
        except Exception:  # noqa: BLE001
            pass
        return {"acquired": True, "holder": holder}
    return {"acquired": False, "holder": holder}


def heartbeat_lock(entity_type: str, entity_id: str, user_id: str) -> bool:
    client = get_sync_redis()
    if client is None:
        return False
    key = _key(entity_type, entity_id)
    holder = _holder(client, key)
    if holder and holder.get("user_id") == user_id:
        try:
            client.pexpire(key, settings.LOCK_TTL_MS)
            return True
        except Exception:  # noqa: BLE001
            return False
    return False


def release_lock(entity_type: str, entity_id: str, user_id: str) -> bool:
    """Delete the lock only if `user_id` is the current holder.

    Returns True if the lock was actually deleted, False if it was a no-op
    (caller isn't the holder, no lock exists, Redis is unavailable, or the
    delete itself failed) — callers should treat False as "nothing changed".
    """
    client = get_sync_redis()
    if client is None:
        return False
    key = _key(entity_type, entity_id)
    holder = _holder(client, key)
    if holder and holder.get("user_id") == user_id:
        try:
            client.delete(key)
            return True
        except Exception:  # noqa: BLE001
            return False
    return False


def force_release_lock(entity_type: str, entity_id: str) -> bool:
    """Delete the lock unconditionally, regardless of who holds it.

    This is the "Take over" primitive: no owner check (that's the point of
    "force"). Returns True if a key existed and was deleted, False if no lock
    existed or Redis is unavailable/errors (best-effort, matches this
    module's degrade-open style).
    """
    client = get_sync_redis()
    if client is None:
        return False
    key = _key(entity_type, entity_id)
    try:
        deleted = client.delete(key)
        return bool(deleted)
    except Exception:  # noqa: BLE001
        return False


def get_lock(entity_type: str, entity_id: str) -> Optional[dict]:
    client = get_sync_redis()
    if client is None:
        return None
    return _holder(client, _key(entity_type, entity_id))
