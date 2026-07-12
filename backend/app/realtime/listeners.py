"""Auto-publish change events from SQLAlchemy session commits."""
import time
from typing import List, Tuple

from sqlalchemy import event
from sqlalchemy.orm import Session as OrmSession

from app.realtime.events import ChangeEvent, publish_change
from app.realtime.scope import entity_type_name, resolve_scope_ids

_installed = False
_PENDING_KEY = "_rt_pending"


def _is_versioned(obj) -> bool:
    return hasattr(obj, "version") and hasattr(obj, "id")


def _collect(session, objects, action: str, out: List[Tuple]):
    for obj in objects:
        if _is_versioned(obj) and getattr(obj, "id", None) is not None:
            out.append((entity_type_name(obj), str(obj.id), action,
                        resolve_scope_ids(obj)))


def _after_flush(session, flush_context):
    pending = session.info.setdefault(_PENDING_KEY, [])
    _collect(session, session.new, "created", pending)
    _collect(session, session.dirty, "updated", pending)
    _collect(session, session.deleted, "deleted", pending)


def _after_commit(session):
    pending = session.info.pop(_PENDING_KEY, [])
    now = time.time()
    for etype, eid, action, scope_ids in pending:
        publish_change(ChangeEvent(type=etype, id=eid, action=action,
                                   scope_ids=scope_ids, actor_id=None, ts=now))


def _clear(session, *args):
    session.info.pop(_PENDING_KEY, None)


def install_listeners() -> None:
    global _installed
    if _installed:
        return
    event.listen(OrmSession, "after_flush", _after_flush)
    event.listen(OrmSession, "after_commit", _after_commit)
    event.listen(OrmSession, "after_rollback", _clear)
    event.listen(OrmSession, "after_soft_rollback", _clear)
    _installed = True
