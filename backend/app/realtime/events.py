"""Change-event schema and best-effort publisher."""
import logging
from typing import List, Literal, Optional

from pydantic import BaseModel

from app.realtime.redis_clients import CHANGES_CHANNEL, get_sync_redis

logger = logging.getLogger(__name__)


class ChangeEvent(BaseModel):
    type: str
    id: str
    action: Literal["created", "updated", "deleted"]
    scope_ids: List[str] = []
    actor_id: Optional[str] = None
    ts: float


def publish_change(event: ChangeEvent) -> bool:
    client = get_sync_redis()
    if client is None:
        return False
    try:
        client.publish(CHANGES_CHANNEL, event.model_dump_json())
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("realtime: publish failed: %s", exc)
        return False
