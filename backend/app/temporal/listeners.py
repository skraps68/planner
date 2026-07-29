"""Capture immutable snapshots in the same transaction as planning mutations."""
from __future__ import annotations

import enum
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterable

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session as OrmSession

from app.models.temporal import EntityRevision

logger = logging.getLogger(__name__)

ACTOR_KEY = "temporal_actor_id"
TRANSACTION_KEY = "temporal_transaction_id"

_installed = False

# These records affect assignment utilization or financial projections. Keeping
# the list explicit prevents preferences/security administration from being
# copied into financial history accidentally.
_CAPTURED_TABLES = {
    "projects",
    "project_phases",
    "resources",
    "workers",
    "worker_types",
    "resource_roles",
    "rates",
    "resource_assignments",
    "nonlabor_plan_lines",
    "nonlabor_plan_occurrences",
    "nonlabor_plan_line_references",
    "resource_external_references",
    "external_references",
    "actuals",
    "actual_import_batches",
}


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    return str(value)


def _snapshot(obj: Any) -> dict[str, Any]:
    mapper = inspect(obj).mapper
    return {
        column.key: _json_value(getattr(obj, column.key))
        for column in mapper.column_attrs
    }


def _effective_dates(obj: Any) -> tuple[date | None, date | None]:
    for field in ("assignment_date", "actual_date", "occurrence_date"):
        value = getattr(obj, field, None)
        if value is not None:
            return value, value

    start = next(
        (
            getattr(obj, field)
            for field in (
                "start_date",
                "effective_start_date",
                "amortization_start_date",
            )
            if hasattr(obj, field) and getattr(obj, field) is not None
        ),
        None,
    )
    end = next(
        (
            getattr(obj, field)
            for field in (
                "end_date",
                "effective_end_date",
                "amortization_end_date",
            )
            if hasattr(obj, field) and getattr(obj, field) is not None
        ),
        None,
    )
    return start, end


def _capture(
    session: OrmSession,
    objects: Iterable[Any],
    operation: str,
    transaction_id: uuid.UUID,
    recorded_at: datetime,
) -> None:
    for obj in list(objects):
        table_name = getattr(obj, "__tablename__", "")
        if table_name not in _CAPTURED_TABLES:
            continue
        if operation == "UPDATE" and not session.is_modified(
            obj,
            include_collections=False,
        ):
            continue

        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

        current_version = int(getattr(obj, "version", 1) or 1)
        entity_version = current_version + 1 if operation == "UPDATE" else current_version
        effective_from, effective_to = _effective_dates(obj)
        session.add(EntityRevision(
            entity_type=table_name,
            entity_id=obj.id,
            entity_version=entity_version,
            operation=operation,
            snapshot=_snapshot(obj),
            effective_from=effective_from,
            effective_to=effective_to,
            recorded_at=recorded_at,
            actor_id=session.info.get(ACTOR_KEY),
            transaction_id=transaction_id,
            is_tombstone=operation == "DELETE",
        ))


def _before_flush(session: OrmSession, flush_context, instances) -> None:
    try:
        transaction_id = session.info.setdefault(TRANSACTION_KEY, uuid.uuid4())
        recorded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        _capture(session, session.new, "CREATE", transaction_id, recorded_at)
        _capture(session, session.dirty, "UPDATE", transaction_id, recorded_at)
        _capture(session, session.deleted, "DELETE", transaction_id, recorded_at)
    except Exception:  # noqa: BLE001
        # Revision capture is a correctness feature, so a capture failure must
        # abort the owning write instead of silently losing history.
        logger.exception("temporal revision capture failed")
        raise


def _clear(session: OrmSession, previous_transaction=None) -> None:
    if previous_transaction is not None and getattr(
        previous_transaction,
        "nested",
        False,
    ):
        return
    session.info.pop(TRANSACTION_KEY, None)


def install_temporal_listeners() -> None:
    global _installed
    if _installed:
        return
    event.listen(OrmSession, "before_flush", _before_flush)
    event.listen(OrmSession, "after_commit", _clear)
    event.listen(OrmSession, "after_soft_rollback", _clear)
    _installed = True
