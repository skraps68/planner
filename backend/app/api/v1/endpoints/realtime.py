"""Realtime endpoints: SSE ticket + change stream."""
import json
from typing import Set
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.realtime.redis_clients import CHANGES_CHANNEL, make_async_redis
from app.realtime.tickets import consume_ticket, mint_ticket
from app.services.scope_validator import scope_validator_service

router = APIRouter()


@router.post("/ticket")
def create_ticket(current_user: User = Depends(get_current_user)):
    token = mint_ticket(str(current_user.id))
    if not token:
        raise HTTPException(status_code=503, detail="Realtime unavailable")
    return {"ticket": token}


def _accessible_scope(db: Session, user_id: str) -> tuple[bool, Set[str]]:
    """(has_global, accessible_ids). Reuses the existing scope services."""
    try:
        uid = UUID(user_id)
        summary = scope_validator_service.get_scope_summary(db, uid)
        if summary.get("has_global_scope"):
            return True, set()
        ids: Set[str] = set()
        ids.update(
            str(x)
            for x in scope_validator_service.get_user_accessible_programs(db, uid)
            or []
        )
        ids.update(
            str(x)
            for x in scope_validator_service.get_user_accessible_projects(db, uid)
            or []
        )
        return False, ids
    except Exception:  # noqa: BLE001
        return False, set()


def _visible(event: dict, has_global: bool, accessible: Set[str]) -> bool:
    if has_global:
        return True
    scope_ids = event.get("scope_ids") or []
    if not scope_ids:  # broadcast (id-only events are low-risk)
        return True
    return any(str(s) in accessible for s in scope_ids)


@router.get("/stream")
async def stream(
    request: Request,
    ticket: str = Query(...),
    db: Session = Depends(get_db),
):
    user_id = consume_ticket(ticket)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired ticket",
        )
    has_global, accessible = _accessible_scope(db, user_id)

    async def event_gen():
        conn = make_async_redis()
        pubsub = conn.pubsub()
        await pubsub.subscribe(CHANGES_CHANNEL)
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=15.0
                )
                if msg is None:
                    yield ": keepalive\n\n"
                    continue
                try:
                    data = json.loads(msg["data"])
                except (ValueError, TypeError):
                    continue
                if _visible(data, has_global, accessible):
                    yield f"data: {json.dumps(data)}\n\n"
        finally:
            await pubsub.unsubscribe(CHANGES_CHANNEL)
            await pubsub.aclose()
            await conn.aclose()

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
