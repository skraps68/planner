"""Auto-publish change events from SQLAlchemy session commits."""
import logging
import time
from typing import List, Tuple

from sqlalchemy import event
from sqlalchemy.orm import Session as OrmSession

from app.realtime.events import ChangeEvent, publish_change
from app.realtime.scope import entity_type_name, resolve_scope_ids

logger = logging.getLogger(__name__)

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
    # Listeners are global on the ORM Session class: never let an exception
    # escape into an unrelated application flush.
    try:
        pending = session.info.setdefault(_PENDING_KEY, [])
        _collect(session, session.new, "created", pending)
        _collect(session, session.dirty, "updated", pending)
        _collect(session, session.deleted, "deleted", pending)
    except Exception:  # noqa: BLE001
        logger.warning("realtime: change collection failed", exc_info=True)


def _after_commit(session):
    pending = session.info.pop(_PENDING_KEY, [])
    now = time.time()
    for etype, eid, action, scope_ids in pending:
        # Per-event guard: one bad event must not drop the rest, and nothing
        # may raise into the committing request. publish_change never raises,
        # but ChangeEvent validation can.
        try:
            publish_change(ChangeEvent(type=etype, id=eid, action=action,
                                       scope_ids=scope_ids, actor_id=None,
                                       ts=now))
        except Exception:  # noqa: BLE001
            logger.warning("realtime: publish of change event failed",
                           exc_info=True)


def _clear(session, previous_transaction=None):
    # Savepoint rollbacks keep the pending list: an id-only invalidation for a
    # change that didn't persist costs one harmless refetch; losing the event
    # for a change that DID commit means another client never updates.
    if previous_transaction is not None and getattr(previous_transaction, "nested", False):
        return
    session.info.pop(_PENDING_KEY, None)


def install_listeners() -> None:
    global _installed
    if _installed:
        return
    event.listen(OrmSession, "after_flush", _after_flush)
    event.listen(OrmSession, "after_commit", _after_commit)
    # Clear only via after_soft_rollback: it fires for every rollback and is
    # the only hook that carries the transaction, letting _clear distinguish
    # savepoint rollbacks. after_rollback also fires on savepoint rollback
    # (observed on SQLAlchemy 2.0.23) but passes no transaction, so binding
    # _clear to it would wipe pending events the outer transaction commits.
    event.listen(OrmSession, "after_soft_rollback", _clear)
    _installed = True
