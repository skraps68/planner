"""Redis-backed editing presence (best-effort)."""
import json
import time
from typing import List

from app.core.config import settings
from app.realtime.redis_clients import get_sync_redis


def _key(entity_type: str, entity_id: str) -> str:
    return f"rt:presence:{entity_type}:{entity_id}"


def register_presence(entity_type: str, entity_id: str, user_id: str, user_name: str) -> None:
    client = get_sync_redis()
    if client is None:
        return
    try:
        key = _key(entity_type, entity_id)
        client.hset(key, user_id, json.dumps({"name": user_name, "ts": time.time()}))
        client.pexpire(key, settings.LOCK_TTL_MS)
    except Exception:  # noqa: BLE001
        pass


def release_presence(entity_type: str, entity_id: str, user_id: str) -> None:
    client = get_sync_redis()
    if client is None:
        return
    try:
        client.hdel(_key(entity_type, entity_id), user_id)
    except Exception:  # noqa: BLE001
        pass


def list_presence(entity_type: str, entity_id: str) -> List[dict]:
    client = get_sync_redis()
    if client is None:
        return []
    try:
        raw = client.hgetall(_key(entity_type, entity_id)) or {}
    except Exception:  # noqa: BLE001
        return []
    cutoff = time.time() - settings.LOCK_TTL_MS / 1000.0
    out: List[dict] = []
    for uid, val in raw.items():
        try:
            data = json.loads(val)
        except (ValueError, TypeError):
            continue
        if data.get("ts", 0) >= cutoff:
            out.append({"user_id": uid, "name": data.get("name")})
    return out
