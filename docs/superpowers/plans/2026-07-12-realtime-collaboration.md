# Real-Time Collaboration & Concurrency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server-side edits visible to other clients within a configurable tolerance, and protect large in-progress edits, without weakening the existing optimistic-locking safety net.

**Architecture:** Three cooperating layers on top of the existing optimistic locking (L1): L2 freshness publishes id-only change events to Redis on every commit and fans them out to browsers over Server-Sent Events, which invalidate React Query caches so clients refetch; L3 adds Redis-backed presence badges (all editable entities) and advisory soft-locks with TTL+heartbeat (resource calendar + workers only). See spec: `docs/superpowers/specs/2026-07-12-realtime-collaboration-design.md`.

**Tech Stack:** Backend — FastAPI, SQLAlchemy, `redis==5.0.1` (sync client for PUBLISH, `redis.asyncio` for the SSE subscriber; **no new dependency** — SSE is hand-rolled with `StreamingResponse`). Frontend — React 18 + TypeScript, MUI, `@tanstack/react-query`, axios, native `EventSource`. Tests — pytest (+ existing patterns) backend, vitest + Testing Library frontend.

## Global Constraints

- **No new backend dependencies.** Use `redis==5.0.1` (already present); hand-roll SSE with `fastapi.responses.StreamingResponse`. Do not add `sse-starlette`.
- **Degrade gracefully, never break a request.** Every publish/presence/lock call is best-effort: if Redis is unavailable or `REALTIME_ENABLED=false`, the feature no-ops and the underlying create/update/delete still succeeds. Optimistic locking (L1) remains the correctness guarantee at all times.
- **Events carry identifiers only, never entity payloads.** Shape: `{type, id, action, scope_ids, actor_id, ts}`.
- **API base path is `/api/v1`** (`settings.API_V1_STR`). New endpoints live under `/api/v1/realtime/...`.
- **Auth token** lives in `localStorage.getItem('token')` on the frontend and is sent as `Authorization: Bearer <token>` by the axios client (`frontend/src/api/client.ts`). `EventSource` cannot set headers, so the stream authenticates with a short-lived ticket.
- **Config is env-driven** via `app/core/config.py` `Settings`. Defaults: `REALTIME_ENABLED=true`, `REALTIME_TOLERANCE_ACTIVE_MS=3000`, `REALTIME_TOLERANCE_LIST_MS=20000`, `REALTIME_TICKET_TTL_S=30`, `LOCK_TTL_MS=90000`, `LOCK_HEARTBEAT_MS=30000`.
- **Redis connection** is built from existing `settings.REDIS_HOST/REDIS_PORT/REDIS_DB/REDIS_PASSWORD` (see `app/services/permission_cache.py` for the established pattern).
- **Backend tests** run in the `planner-app` container or the project venv; **frontend tests** run with `npx vitest run <file>` from `frontend/`.
- **Commit after every task** with the message shown in that task's final step.

---

## File Structure

**Backend (new package `app/realtime/`):**
- `app/realtime/__init__.py` — package marker.
- `app/realtime/config.py` — typed accessors for the realtime settings (thin wrapper over `settings`).
- `app/realtime/redis_clients.py` — lazy singletons: sync client (PUBLISH, tickets, presence, locks) and async client factory (SSE subscribe).
- `app/realtime/events.py` — `ChangeEvent` schema, channel name, `publish_change()`.
- `app/realtime/scope.py` — `resolve_scope_ids(entity)` best-effort scope derivation.
- `app/realtime/listeners.py` — SQLAlchemy session listeners that collect versioned changes on flush and publish them on commit.
- `app/realtime/tickets.py` — mint/consume short-lived SSE tickets.
- `app/realtime/presence.py` — register/heartbeat/release/list presence (Phase 3).
- `app/realtime/locks.py` — acquire/heartbeat/release/status advisory locks (Phase 4).
- `app/api/v1/endpoints/realtime.py` — ticket, SSE stream, presence, lock endpoints.

**Backend (modified):**
- `app/core/config.py` — add realtime settings.
- `app/api/v1/api.py` — register the realtime router.
- `app/main.py` — attach SQLAlchemy listeners on startup.

**Frontend (new folder `src/realtime/`):**
- `src/realtime/eventKeyMap.ts` — entity type → React Query key prefixes.
- `src/realtime/realtimeApi.ts` — ticket/presence/lock REST calls.
- `src/realtime/useRealtime.ts` — SSE connection + cache invalidation (Phase 1).
- `src/realtime/usePresence.ts` + `src/realtime/PresenceBadge.tsx` — Phase 3.
- `src/realtime/useEntityLock.ts` + `src/realtime/LockBanner.tsx` — Phase 4.

**Frontend (modified):**
- `src/components/layout/Layout.tsx` — mount `useRealtime()` once for authenticated users.
- `src/components/resources/ResourceAssignmentCalendar.tsx` — L1 bulk-conflict hardening (Phase 2) + lock wiring (Phase 4).
- `src/pages/resources/ResourceDetailPage.tsx` / `src/pages/workers/WorkerDetailPage.tsx` — presence + lock wiring (Phases 3–4).

---

# PHASE 1 — L2 Freshness (SSE + Redis pub/sub)

## Task 1: Realtime settings & config accessors

**Files:**
- Modify: `backend/app/core/config.py`
- Create: `backend/app/realtime/__init__.py`
- Create: `backend/app/realtime/config.py`
- Test: `backend/tests/unit/test_realtime_config.py`

**Interfaces:**
- Produces: `settings.REALTIME_ENABLED: bool`, `settings.REALTIME_TOLERANCE_ACTIVE_MS: int`, `settings.REALTIME_TOLERANCE_LIST_MS: int`, `settings.REALTIME_TICKET_TTL_S: int`, `settings.LOCK_TTL_MS: int`, `settings.LOCK_HEARTBEAT_MS: int`. Helper `realtime_enabled() -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_realtime_config.py
from app.core.config import settings
from app.realtime.config import realtime_enabled


def test_realtime_defaults_present():
    assert isinstance(settings.REALTIME_ENABLED, bool)
    assert settings.REALTIME_TOLERANCE_ACTIVE_MS == 3000
    assert settings.REALTIME_TOLERANCE_LIST_MS == 20000
    assert settings.REALTIME_TICKET_TTL_S == 30
    assert settings.LOCK_TTL_MS == 90000
    assert settings.LOCK_HEARTBEAT_MS == 30000


def test_realtime_enabled_helper_reads_setting():
    assert realtime_enabled() == settings.REALTIME_ENABLED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_config.py -v`
Expected: FAIL — `ModuleNotFoundError: app.realtime` / missing settings attributes.

- [ ] **Step 3: Add settings**

In `backend/app/core/config.py`, inside `class Settings`, after the Redis block (`REDIS_PASSWORD`), add:

```python
    # Realtime collaboration (L2 freshness, L3 presence/locks)
    REALTIME_ENABLED: bool = True
    REALTIME_TOLERANCE_ACTIVE_MS: int = 3000
    REALTIME_TOLERANCE_LIST_MS: int = 20000
    REALTIME_TICKET_TTL_S: int = 30
    LOCK_TTL_MS: int = 90000
    LOCK_HEARTBEAT_MS: int = 30000
```

Create `backend/app/realtime/__init__.py` (empty). Create `backend/app/realtime/config.py`:

```python
"""Typed accessors for realtime settings."""
from app.core.config import settings


def realtime_enabled() -> bool:
    return bool(settings.REALTIME_ENABLED)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/unit/test_realtime_config.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/realtime/__init__.py backend/app/realtime/config.py backend/tests/unit/test_realtime_config.py
git commit -m "feat(realtime): add realtime settings and config accessor"
```

---

## Task 2: Redis client singletons

**Files:**
- Create: `backend/app/realtime/redis_clients.py`
- Test: `backend/tests/unit/test_realtime_redis_clients.py`

**Interfaces:**
- Produces: `get_sync_redis() -> redis.Redis | None` (returns `None` if `REALTIME_ENABLED` is false or connection fails), `make_async_redis() -> redis.asyncio.Redis` (fresh connection for a single SSE subscriber), `CHANGES_CHANNEL = "rt:changes"`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_realtime_redis_clients.py
from unittest.mock import patch
from app.realtime import redis_clients


def test_get_sync_redis_returns_none_when_disabled():
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", False):
        redis_clients._sync_client = None  # reset memoization
        assert redis_clients.get_sync_redis() is None


def test_get_sync_redis_returns_none_on_connection_error():
    redis_clients._sync_client = None
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", True), \
         patch("app.realtime.redis_clients.redis.Redis.ping", side_effect=Exception("down")):
        assert redis_clients.get_sync_redis() is None


def test_changes_channel_constant():
    assert redis_clients.CHANGES_CHANNEL == "rt:changes"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_redis_clients.py -v`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```python
# backend/app/realtime/redis_clients.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/unit/test_realtime_redis_clients.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/redis_clients.py backend/tests/unit/test_realtime_redis_clients.py
git commit -m "feat(realtime): best-effort redis client singletons"
```

---

## Task 3: Change event schema + publisher

**Files:**
- Create: `backend/app/realtime/events.py`
- Test: `backend/tests/unit/test_realtime_events.py`

**Interfaces:**
- Consumes: `get_sync_redis`, `CHANGES_CHANNEL` from Task 2.
- Produces: `ChangeEvent` (pydantic model: `type: str`, `id: str`, `action: str` in {"created","updated","deleted"}, `scope_ids: list[str]`, `actor_id: str | None`, `ts: float`), and `publish_change(event: ChangeEvent) -> bool` (returns True if published, False if skipped/failed; never raises).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_realtime_events.py
import json
from unittest.mock import MagicMock, patch
from app.realtime.events import ChangeEvent, publish_change


def _event():
    return ChangeEvent(type="resource", id="abc", action="created",
                       scope_ids=["proj-1"], actor_id="user-1", ts=1.0)


def test_publish_change_publishes_json_to_channel():
    fake = MagicMock()
    with patch("app.realtime.events.get_sync_redis", return_value=fake):
        assert publish_change(_event()) is True
    fake.publish.assert_called_once()
    channel, payload = fake.publish.call_args[0]
    assert channel == "rt:changes"
    assert json.loads(payload)["id"] == "abc"


def test_publish_change_noops_when_redis_unavailable():
    with patch("app.realtime.events.get_sync_redis", return_value=None):
        assert publish_change(_event()) is False


def test_publish_change_swallows_errors():
    fake = MagicMock()
    fake.publish.side_effect = Exception("boom")
    with patch("app.realtime.events.get_sync_redis", return_value=fake):
        assert publish_change(_event()) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_events.py -v`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```python
# backend/app/realtime/events.py
"""Change-event schema and best-effort publisher."""
import logging
from typing import List, Optional

from pydantic import BaseModel

from app.realtime.redis_clients import CHANGES_CHANNEL, get_sync_redis

logger = logging.getLogger(__name__)


class ChangeEvent(BaseModel):
    type: str
    id: str
    action: str  # "created" | "updated" | "deleted"
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/unit/test_realtime_events.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/events.py backend/tests/unit/test_realtime_events.py
git commit -m "feat(realtime): change-event schema and best-effort publisher"
```

---

## Task 4: Scope resolver

**Files:**
- Create: `backend/app/realtime/scope.py`
- Test: `backend/tests/unit/test_realtime_scope.py`

**Interfaces:**
- Produces: `entity_type_name(obj) -> str` (snake, e.g. `Resource` → `"resource"`), `resolve_scope_ids(obj) -> list[str]`. Returns explicit self-id scope for Portfolio/Program/Project; the project id for ProjectPhase and ResourceAssignment; and `[]` (broadcast) otherwise. Empty list means "no scope restriction" — the SSE filter treats it as visible to all authenticated users (safe because events are id-only).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_realtime_scope.py
from types import SimpleNamespace
from app.realtime.scope import entity_type_name, resolve_scope_ids


def test_entity_type_name_snakecases_class():
    class ResourceAssignment: ...
    assert entity_type_name(ResourceAssignment()) == "resource_assignment"


def test_project_scopes_to_self_id():
    class Project: ...
    p = Project(); p.id = "p1"
    assert resolve_scope_ids(p) == ["p1"]


def test_assignment_scopes_to_project_id():
    class ResourceAssignment: ...
    a = ResourceAssignment(); a.id = "a1"; a.project_id = "p9"
    assert resolve_scope_ids(a) == ["p9"]


def test_unknown_entity_broadcasts():
    class Worker: ...
    w = Worker(); w.id = "w1"
    assert resolve_scope_ids(w) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_scope.py -v`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```python
# backend/app/realtime/scope.py
"""Best-effort mapping of an ORM entity to the scope ids it belongs to.

Empty list == broadcast (no scope restriction). Because change events carry
only identifiers, broadcasting is low-risk; explicit scopes are provided where
they are cheap to derive so the SSE filter can narrow delivery.
"""
import re
from typing import Any, List

_CAMEL = re.compile(r"(?<!^)(?=[A-Z])")


def entity_type_name(obj: Any) -> str:
    return _CAMEL.sub("_", type(obj).__name__).lower()


def resolve_scope_ids(obj: Any) -> List[str]:
    name = entity_type_name(obj)
    if name in ("portfolio", "program", "project"):
        return [str(obj.id)] if getattr(obj, "id", None) is not None else []
    if name in ("project_phase", "resource_assignment"):
        pid = getattr(obj, "project_id", None)
        return [str(pid)] if pid is not None else []
    return []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/unit/test_realtime_scope.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/scope.py backend/tests/unit/test_realtime_scope.py
git commit -m "feat(realtime): entity scope resolver"
```

---

## Task 5: SQLAlchemy commit listeners (auto-publish)

**Files:**
- Create: `backend/app/realtime/listeners.py`
- Modify: `backend/app/main.py` (call `install_listeners()` at import/startup)
- Test: `backend/tests/integration/test_realtime_listeners.py`

**Interfaces:**
- Consumes: `ChangeEvent`, `publish_change` (Task 3); `entity_type_name`, `resolve_scope_ids` (Task 4).
- Produces: `install_listeners() -> None`. It listens on the app's `Session` class: `after_flush` collects `(type, id, action, scope_ids)` for every instance that is an `AsyncAttrs`-free versioned model (detected via presence of a `version` attribute) into `session.info["_rt_pending"]`; `after_commit` calls `publish_change` for each and clears; `after_soft_rollback`/`after_rollback` clears.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_realtime_listeners.py
from unittest.mock import patch
from app.realtime.listeners import install_listeners
from app.models.resource import WorkerType


def test_commit_publishes_created_event(db_session):
    install_listeners()
    with patch("app.realtime.listeners.publish_change") as pub:
        wt = WorkerType(type="RT-Test", description="d")
        db_session.add(wt)
        db_session.commit()
    published = [c.args[0] for c in pub.call_args_list]
    assert any(e.type == "worker_type" and e.action == "created" for e in published)


def test_rollback_publishes_nothing(db_session):
    install_listeners()
    with patch("app.realtime.listeners.publish_change") as pub:
        wt = WorkerType(type="RT-Rollback", description="d")
        db_session.add(wt)
        db_session.flush()
        db_session.rollback()
    pub.assert_not_called()
```

> Note: `db_session` is the existing fixture in `backend/tests/conftest.py`. `install_listeners()` must be idempotent (guard against double-registration) because the fixture and app may both call it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_realtime_listeners.py -v`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```python
# backend/app/realtime/listeners.py
"""Auto-publish change events from SQLAlchemy session commits."""
import time
from typing import List, Tuple

from sqlalchemy import event

from app.db.base import SessionLocal
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
    event.listen(SessionLocal, "after_flush", _after_flush)
    event.listen(SessionLocal, "after_commit", _after_commit)
    event.listen(SessionLocal, "after_rollback", _clear)
    event.listen(SessionLocal, "after_soft_rollback", _clear)
    _installed = True
```

In `backend/app/main.py`, after `app = FastAPI(...)` is created and routers are included, add:

```python
from app.realtime.listeners import install_listeners

install_listeners()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/integration/test_realtime_listeners.py -v`
Expected: PASS (2 passed). If `dirty` picks up no-op updates, that is acceptable (idempotent invalidation downstream).

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/listeners.py backend/app/main.py backend/tests/integration/test_realtime_listeners.py
git commit -m "feat(realtime): auto-publish change events on commit"
```

---

## Task 6: SSE tickets

**Files:**
- Create: `backend/app/realtime/tickets.py`
- Test: `backend/tests/unit/test_realtime_tickets.py`

**Interfaces:**
- Consumes: `get_sync_redis` (Task 2), `settings.REALTIME_TICKET_TTL_S` (Task 1).
- Produces: `mint_ticket(user_id: str) -> str | None` (random token stored in Redis `rt:ticket:<token> = user_id` with TTL; None if Redis down), `consume_ticket(token: str) -> str | None` (atomic GETDEL; returns user_id or None if missing/expired/reused).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_realtime_tickets.py
from unittest.mock import MagicMock, patch
from app.realtime import tickets


def test_mint_ticket_stores_with_ttl_and_returns_token():
    fake = MagicMock()
    with patch("app.realtime.tickets.get_sync_redis", return_value=fake):
        tok = tickets.mint_ticket("user-1")
    assert tok
    args, kwargs = fake.setex.call_args
    assert args[0] == f"rt:ticket:{tok}"
    assert args[2] == "user-1"


def test_consume_ticket_is_single_use():
    fake = MagicMock()
    fake.getdel.return_value = "user-1"
    with patch("app.realtime.tickets.get_sync_redis", return_value=fake):
        assert tickets.consume_ticket("t") == "user-1"
    fake.getdel.assert_called_once_with("rt:ticket:t")


def test_consume_ticket_none_when_redis_down():
    with patch("app.realtime.tickets.get_sync_redis", return_value=None):
        assert tickets.consume_ticket("t") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_tickets.py -v`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```python
# backend/app/realtime/tickets.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/unit/test_realtime_tickets.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/tickets.py backend/tests/unit/test_realtime_tickets.py
git commit -m "feat(realtime): single-use SSE tickets"
```

---

## Task 7: Realtime router — ticket + SSE stream endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/realtime.py`
- Modify: `backend/app/api/v1/api.py` (register router with prefix `/realtime`)
- Test: `backend/tests/integration/test_realtime_api.py`

**Interfaces:**
- Consumes: `mint_ticket`, `consume_ticket` (Task 6); `make_async_redis`, `CHANGES_CHANNEL` (Task 2); `get_current_user`, `get_db` (existing deps); `scope_validator_service` (existing) to compute the connecting user's accessible scope.
- Produces: `POST /api/v1/realtime/ticket` → `{"ticket": "..."}`; `GET /api/v1/realtime/stream?ticket=...` → `text/event-stream`. The stream forwards each `ChangeEvent` where the user has global scope OR `event.scope_ids` is empty OR intersects the user's accessible project/portfolio ids. Sends `: keepalive` comments every 15s.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_realtime_api.py
# Uses the existing `client` (TestClient) and auth-header fixtures from conftest.
def test_ticket_requires_auth(client):
    resp = client.post("/api/v1/realtime/ticket")
    assert resp.status_code in (401, 403)


def test_ticket_returns_token_when_authed(client, admin_auth_header):
    resp = client.post("/api/v1/realtime/ticket", headers=admin_auth_header)
    assert resp.status_code == 200
    assert resp.json().get("ticket")


def test_stream_rejects_bad_ticket(client):
    resp = client.get("/api/v1/realtime/stream?ticket=nope")
    assert resp.status_code == 401
```

> Note: use whatever the existing auth-header fixture is named in `conftest.py` (e.g. `admin_auth_header` / `auth_headers`). If ticket minting requires Redis and CI has none, `test_ticket_returns_token_when_authed` should be marked to skip when `get_sync_redis()` returns None; keep the two negative tests unconditional.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/integration/test_realtime_api.py -v`
Expected: FAIL — routes 404.

- [ ] **Step 3: Implement**

```python
# backend/app/api/v1/endpoints/realtime.py
"""Realtime endpoints: SSE ticket + change stream."""
import asyncio
import json
from typing import Set

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


def _accessible_scope(db: Session, user_id) -> tuple[bool, Set[str]]:
    """(has_global, accessible_ids). Reuses the existing scope validator."""
    summary = scope_validator_service.get_scope_summary(db, user_id)
    if summary.get("has_global_scope"):
        return True, set()
    ids: Set[str] = set()
    for key in ("project_ids", "program_ids", "portfolio_ids"):
        ids.update(str(x) for x in summary.get(key, []) or [])
    return False, ids


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired ticket")
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
                msg = await pubsub.get_message(ignore_subscribe_messages=True,
                                               timeout=15.0)
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

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})
```

In `backend/app/api/v1/api.py`, add near the other includes:

```python
from app.api.v1.endpoints import realtime

api_router.include_router(realtime.router, prefix="/realtime", tags=["realtime"])
```

> Verify `scope_validator_service.get_scope_summary` returns keys `project_ids`/`program_ids`/`portfolio_ids`; if the actual key names differ, adjust `_accessible_scope` to match (grep `def get_scope_summary`). This is the only integration point with existing scope code.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/integration/test_realtime_api.py -v`
Expected: PASS (negative tests always; ticket test passes with Redis, else skipped).

- [ ] **Step 5: Manually verify the stream end-to-end**

Run (in the container, with Redis up):
```bash
# terminal A: mint a ticket (reuse the token-mint pattern from earlier debugging)
# terminal B:
curl -N "http://localhost:8000/api/v1/realtime/stream?ticket=<TICKET>"
# terminal C: edit any entity via the API; terminal B should print a `data: {...}` line
```
Expected: `: connected`, periodic `: keepalive`, and a `data:` line when an entity changes.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/realtime.py backend/app/api/v1/api.py backend/tests/integration/test_realtime_api.py
git commit -m "feat(realtime): SSE ticket and change-stream endpoints"
```

---

## Task 8: Frontend event→query-key map

**Files:**
- Create: `frontend/src/realtime/eventKeyMap.ts`
- Test: `frontend/src/realtime/eventKeyMap.test.ts`

**Interfaces:**
- Produces: `queryKeyPrefixesFor(entityType: string): Array<Array<string>>` — the React Query key prefixes to invalidate for a given change event `type`. Unknown types return `[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/realtime/eventKeyMap.test.ts
import { describe, it, expect } from 'vitest'
import { queryKeyPrefixesFor } from './eventKeyMap'

describe('queryKeyPrefixesFor', () => {
  it('maps resource changes to resource + assignment lists', () => {
    expect(queryKeyPrefixesFor('resource')).toEqual(
      expect.arrayContaining([['resources'], ['resource'], ['assignments']]),
    )
  })
  it('maps worker changes to worker and resource lists (rename cascade)', () => {
    expect(queryKeyPrefixesFor('worker')).toEqual(
      expect.arrayContaining([['workers'], ['resources']]),
    )
  })
  it('returns [] for unknown types', () => {
    expect(queryKeyPrefixesFor('mystery')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/realtime/eventKeyMap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/realtime/eventKeyMap.ts
// Maps a backend ChangeEvent `type` to the React Query key prefixes that
// should be invalidated. Prefix arrays match any query key that starts with them.
const MAP: Record<string, Array<Array<string>>> = {
  resource: [['resources'], ['resource'], ['assignments']],
  resource_assignment: [['assignments'], ['forecast'], ['actuals']],
  worker: [['workers'], ['worker'], ['resources']],
  worker_type: [['workers'], ['worker-types']],
  project: [['projects'], ['project'], ['forecast']],
  project_phase: [['phases'], ['project'], ['forecast']],
  program: [['programs'], ['program']],
  portfolio: [['portfolios'], ['portfolio']],
  rate: [['rates'], ['forecast']],
  actual: [['actuals'], ['forecast']],
}

export function queryKeyPrefixesFor(entityType: string): Array<Array<string>> {
  return MAP[entityType] ?? []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/realtime/eventKeyMap.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/realtime/eventKeyMap.ts frontend/src/realtime/eventKeyMap.test.ts
git commit -m "feat(realtime): map change events to query-key prefixes"
```

---

## Task 9: Frontend realtime REST client

**Files:**
- Create: `frontend/src/realtime/realtimeApi.ts`
- Test: `frontend/src/realtime/realtimeApi.test.ts`

**Interfaces:**
- Consumes: `apiClient` (`frontend/src/api/client.ts`).
- Produces: `realtimeApi.mintTicket(): Promise<string>` (POST `/realtime/ticket`, returns `ticket`). (Presence/lock methods are added in later phases.)

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/realtime/realtimeApi.test.ts
import { describe, it, expect, vi } from 'vitest'
import apiClient from '../api/client'
import { realtimeApi } from './realtimeApi'

describe('realtimeApi.mintTicket', () => {
  it('POSTs to /realtime/ticket and returns the ticket', async () => {
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { ticket: 'T1' } } as any)
    await expect(realtimeApi.mintTicket()).resolves.toBe('T1')
    expect(spy).toHaveBeenCalledWith('/realtime/ticket')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/realtime/realtimeApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/realtime/realtimeApi.ts
import apiClient from '../api/client'

export const realtimeApi = {
  mintTicket: async (): Promise<string> => {
    const res = await apiClient.post<{ ticket: string }>('/realtime/ticket')
    return res.data.ticket
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/realtime/realtimeApi.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/realtime/realtimeApi.ts frontend/src/realtime/realtimeApi.test.ts
git commit -m "feat(realtime): frontend ticket REST client"
```

---

## Task 10: `useRealtime` hook — connect, invalidate, coalesce, reconnect

**Files:**
- Create: `frontend/src/realtime/useRealtime.ts`
- Test: `frontend/src/realtime/useRealtime.test.tsx`

**Interfaces:**
- Consumes: `realtimeApi.mintTicket` (Task 9), `queryKeyPrefixesFor` (Task 8), `useQueryClient`.
- Produces: `useRealtime(): void`. On mount (authenticated), mints a ticket, opens an `EventSource` to `${API_BASE}/realtime/stream?ticket=...`, and for each message collects the mapped prefixes and flushes `queryClient.invalidateQueries({queryKey: prefix})` on a coalescing timer (`REALTIME_TOLERANCE_ACTIVE_MS`, default 3000). On `open` (including reconnect) it invalidates all active queries to self-heal missed events. Cleans up the connection and timers on unmount. All failures are swallowed (feature is best-effort).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/realtime/useRealtime.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRealtime } from './useRealtime'
import { realtimeApi } from './realtimeApi'

// Minimal EventSource mock
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onopen: ((e: any) => void) | null = null
  onmessage: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  closed = false
  constructor(url: string) { this.url = url; MockEventSource.instances.push(this) }
  emitOpen() { this.onopen?.({}) }
  emitMessage(data: any) { this.onmessage?.({ data: JSON.stringify(data) }) }
  close() { this.closed = true }
}

beforeEach(() => {
  MockEventSource.instances = []
  ;(globalThis as any).EventSource = MockEventSource as any
  localStorage.setItem('token', 'tok')
  vi.spyOn(realtimeApi, 'mintTicket').mockResolvedValue('T1')
})

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRealtime', () => {
  it('invalidates mapped query keys when a change event arrives', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useRealtime(), { wrapper: wrap(qc) })

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    const es = MockEventSource.instances[0]
    expect(es.url).toContain('ticket=T1')

    await act(async () => {
      es.emitMessage({ type: 'resource', id: 'r1', action: 'created', scope_ids: [] })
      // advance past the coalescing window
      await new Promise((r) => setTimeout(r, 3100))
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['resources'] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/realtime/useRealtime.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/realtime/useRealtime.ts
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeApi } from './realtimeApi'
import { queryKeyPrefixesFor } from './eventKeyMap'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const COALESCE_MS = Number(import.meta.env.VITE_REALTIME_TOLERANCE_ACTIVE_MS) || 3000

export function useRealtime(): void {
  const queryClient = useQueryClient()
  const esRef = useRef<EventSource | null>(null)
  const pendingRef = useRef<Map<string, Array<string>>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    let cancelled = false

    const flush = () => {
      timerRef.current = null
      const prefixes = Array.from(pendingRef.current.values())
      pendingRef.current.clear()
      for (const prefix of prefixes) {
        queryClient.invalidateQueries({ queryKey: prefix })
      }
    }

    const schedule = (prefix: Array<string>) => {
      pendingRef.current.set(prefix.join(' '), prefix)
      if (timerRef.current == null) {
        timerRef.current = setTimeout(flush, COALESCE_MS)
      }
    }

    const connect = async () => {
      try {
        const ticket = await realtimeApi.mintTicket()
        if (cancelled) return
        const es = new EventSource(`${API_BASE}/realtime/stream?ticket=${encodeURIComponent(ticket)}`)
        esRef.current = es
        es.onopen = () => {
          // Reconnect self-heal: refetch everything currently mounted.
          queryClient.invalidateQueries()
        }
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data)
            for (const prefix of queryKeyPrefixesFor(data.type)) schedule(prefix)
          } catch { /* ignore malformed */ }
        }
        es.onerror = () => { /* EventSource auto-reconnects */ }
      } catch { /* best-effort; try again on next mount */ }
    }

    connect()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [queryClient])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/realtime/useRealtime.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/realtime/useRealtime.ts frontend/src/realtime/useRealtime.test.tsx
git commit -m "feat(realtime): useRealtime SSE hook with coalesced invalidation"
```

---

## Task 11: Mount `useRealtime` for authenticated users

**Files:**
- Modify: `frontend/src/components/layout/Layout.tsx`
- Test: `frontend/src/components/layout/Layout.realtime.test.tsx`

**Interfaces:**
- Consumes: `useRealtime` (Task 10). `Layout` wraps all authenticated pages (per `App.tsx`), so mounting the hook here gives one connection per session.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/layout/Layout.realtime.test.tsx
import { describe, it, expect, vi } from 'vitest'
import * as rt from '../../realtime/useRealtime'

// Assert Layout calls useRealtime exactly once when rendered.
describe('Layout wires realtime', () => {
  it('invokes useRealtime', async () => {
    const spy = vi.spyOn(rt, 'useRealtime').mockImplementation(() => {})
    const { render } = await import('../../test/test-utils')
    const Layout = (await import('./Layout')).default
    render(<Layout>content</Layout>)
    expect(spy).toHaveBeenCalled()
  })
})
```

> If `Layout` requires router/store context beyond what `test-utils` provides, extend the render options as other Layout tests do; the assertion of interest is only that `useRealtime` is invoked.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/layout/Layout.realtime.test.tsx`
Expected: FAIL — `useRealtime` not called.

- [ ] **Step 3: Implement**

In `frontend/src/components/layout/Layout.tsx`, import and call the hook at the top of the component body:

```typescript
import { useRealtime } from '../../realtime/useRealtime'
// ...inside the Layout component, before the return:
  useRealtime()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/layout/Layout.realtime.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Verify the original bug is fixed (end-to-end)**

With backend + frontend running and two browser sessions:
1. Session A on the Resources list (Labor tab).
2. Session B creates a new labor resource.
3. Within ~3s, Session A's list shows the new resource without a manual refresh.
4. Also confirm Session B's own list is fresh after it navigates back (the self-event invalidates its cache).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Layout.tsx frontend/src/components/layout/Layout.realtime.test.tsx
git commit -m "feat(realtime): mount useRealtime in Layout; live list refresh"
```

---

# PHASE 2 — L1 Bulk-conflict hardening (frontend)

The backend `POST /assignments/bulk-update` already returns `BulkUpdateResult { succeeded, failed }` (see `app/schemas/assignment.py`), and `assignmentsApi.bulkUpdate` already types it. The calendar currently **ignores `result.failed`**, so a per-row conflict is silently dropped. This phase makes the calendar surface conflicts per-cell and preserve the user's other edits.

## Task 12: Calendar preserves non-conflicting edits and flags conflicts

**Files:**
- Modify: `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` (the `handleSave` in `ResourceAllocationCalendar`, ~lines 251–341)
- Test: `frontend/src/components/resources/ResourceAssignmentCalendar.bulkConflict.test.tsx` (existing file — add a case)

**Interfaces:**
- Consumes: `assignmentsApi.bulkUpdate` returning `BulkUpdateResult { succeeded: {id, version}[], failed: {id, current_state}[] }`.
- Behavior: after `bulkUpdate`, if `result.failed` is non-empty: (a) keep only the failed cells in `editedCells`, clear the succeeded ones; (b) set a validation error on each failed cell keyed by its `project:date:type`; (c) surface a summary `saveError` ("N change(s) conflicted and were kept for review"); (d) invalidate assignments query so versions refresh; (e) stay in edit mode. If `failed` is empty, behave as today (clear edits, exit edit mode, success snackbar).

- [ ] **Step 1: Write the failing test**

```typescript
// add to ResourceAssignmentCalendar.bulkConflict.test.tsx
it('keeps conflicting cells in edit mode and preserves them after partial failure', async () => {
  // Arrange: mock assignmentsApi.getByResource with two assignments (two projects,
  // same date) and bulkUpdate resolving to one success + one failure.
  // Enter edit mode, change both cells, Save.
  // Assert: the failed cell still shows its edited value and an error state;
  //         the succeeded cell is cleared; a conflict summary is shown;
  //         the component is still in edit mode.
  // (Follow the arrange/act pattern already used in this test file.)
})
```

> Fill in the arrange/act using the mocks and helpers already present in `ResourceAssignmentCalendar.bulkConflict.test.tsx`. The assertion set above is the contract.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/resources/ResourceAssignmentCalendar.bulkConflict.test.tsx`
Expected: FAIL — conflicts are currently ignored; failed cell is cleared/lost.

- [ ] **Step 3: Implement**

Replace the success branch of `handleSave` (currently `await assignmentsApi.bulkUpdate(bulkUpdates)` followed by unconditional clear/exit) with handling of the returned result:

```typescript
      const result = await assignmentsApi.bulkUpdate(bulkUpdates)

      if (result.failed && result.failed.length > 0) {
        // Map each failed assignment id back to its project:date cell keys.
        const failedByAssignmentId = new Set(result.failed.map((f) => f.id))
        const nextEdits = new Map<string, number>()
        const nextErrors = new Map<string, string>()
        for (const [key, value] of editedCells) {
          const [projectId, dateStr] = key.split(':')
          const existing = assignments.find(
            (a) => a.project_id === projectId && a.assignment_date === dateStr,
          )
          if (existing && failedByAssignmentId.has(existing.id)) {
            nextEdits.set(key, value)
            nextErrors.set(key, 'Changed by someone else — review and re-save')
          }
        }
        setEditedCells(nextEdits)
        setValidationErrors(nextErrors)
        setSaveError(
          `${result.failed.length} change(s) conflicted with edits by another user and were kept for review.`,
        )
        await queryClient.invalidateQueries({ queryKey: ['assignments', 'resource', resourceId] })
        return // stay in edit mode
      }

      await queryClient.invalidateQueries({ queryKey: ['assignments', 'resource', resourceId] })
      setEditedCells(new Map())
      setValidationErrors(new Map())
      setIsEditMode(false)
      setSaveSuccess(true)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/resources/ResourceAssignmentCalendar.bulkConflict.test.tsx`
Expected: PASS. Also run the sibling calendar suites to ensure no regression: `npx vitest run src/components/resources/ResourceAssignmentCalendar.save.test.tsx` (note: these suites have pre-existing `AuthProvider` failures per the test-repair backlog — confirm you introduce no *new* failures).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/resources/ResourceAssignmentCalendar.tsx frontend/src/components/resources/ResourceAssignmentCalendar.bulkConflict.test.tsx
git commit -m "feat(realtime): calendar preserves non-conflicting edits on bulk conflict"
```

---

# PHASE 3 — L3 Presence

## Task 13: Backend presence store + endpoints

**Files:**
- Create: `backend/app/realtime/presence.py`
- Modify: `backend/app/api/v1/endpoints/realtime.py` (add presence routes)
- Test: `backend/tests/unit/test_realtime_presence.py`, and add API cases to `backend/tests/integration/test_realtime_api.py`

**Interfaces:**
- Consumes: `get_sync_redis` (Task 2), `settings.LOCK_TTL_MS`/heartbeat for TTL reuse.
- Produces (`presence.py`): `register_presence(entity_type, entity_id, user_id, user_name) -> None` (Redis hash `rt:presence:{type}:{id}` field `user_id` → JSON `{name, ts}`, with a TTL refreshed on each call), `release_presence(entity_type, entity_id, user_id) -> None`, `list_presence(entity_type, entity_id) -> list[{user_id, name}]` (drops entries older than TTL).
- Produces (endpoints): `POST /realtime/presence/{type}/{id}` (register+heartbeat; body `{}`; uses current_user), `DELETE /realtime/presence/{type}/{id}` (release), `GET /realtime/presence/{type}/{id}` (list). Register/release also `publish_change` a synthetic `{type: "presence", id, action, scope_ids: []}` event so viewers refresh their presence query.

- [ ] **Step 1: Write the failing test** (unit — store semantics with a fake Redis)

```python
# backend/tests/unit/test_realtime_presence.py
from unittest.mock import MagicMock, patch
from app.realtime import presence


def test_register_writes_hash_field_and_sets_ttl():
    fake = MagicMock()
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        presence.register_presence("resource", "r1", "u1", "Alice")
    fake.hset.assert_called_once()
    assert fake.pexpire.called or fake.expire.called


def test_release_removes_field():
    fake = MagicMock()
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        presence.release_presence("resource", "r1", "u1")
    fake.hdel.assert_called_once_with("rt:presence:resource:r1", "u1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_presence.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `presence.py`**

```python
# backend/app/realtime/presence.py
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
```

Add endpoints to `realtime.py`:

```python
from app.realtime.presence import register_presence, release_presence, list_presence
from app.realtime.events import ChangeEvent, publish_change
import time as _time


@router.post("/presence/{entity_type}/{entity_id}")
def presence_register(entity_type: str, entity_id: str,
                      current_user: User = Depends(get_current_user)):
    register_presence(entity_type, entity_id, str(current_user.id), current_user.username)
    publish_change(ChangeEvent(type="presence", id=entity_id, action="updated",
                               scope_ids=[], actor_id=str(current_user.id), ts=_time.time()))
    return {"ok": True}


@router.delete("/presence/{entity_type}/{entity_id}")
def presence_release(entity_type: str, entity_id: str,
                     current_user: User = Depends(get_current_user)):
    release_presence(entity_type, entity_id, str(current_user.id))
    publish_change(ChangeEvent(type="presence", id=entity_id, action="updated",
                               scope_ids=[], actor_id=str(current_user.id), ts=_time.time()))
    return {"ok": True}


@router.get("/presence/{entity_type}/{entity_id}")
def presence_get(entity_type: str, entity_id: str,
                 current_user: User = Depends(get_current_user)):
    return {"present": list_presence(entity_type, entity_id)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/unit/test_realtime_presence.py tests/integration/test_realtime_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/presence.py backend/app/api/v1/endpoints/realtime.py backend/tests/unit/test_realtime_presence.py backend/tests/integration/test_realtime_api.py
git commit -m "feat(realtime): editing-presence store and endpoints"
```

---

## Task 14: Frontend presence hook + badge, wired into edit screens

**Files:**
- Modify: `frontend/src/realtime/realtimeApi.ts` (add presence methods)
- Create: `frontend/src/realtime/usePresence.ts`
- Create: `frontend/src/realtime/PresenceBadge.tsx`
- Modify: `frontend/src/pages/resources/ResourceDetailPage.tsx`, `frontend/src/pages/workers/WorkerDetailPage.tsx`
- Test: `frontend/src/realtime/usePresence.test.tsx`

**Interfaces:**
- `realtimeApi.registerPresence(type, id)`, `realtimeApi.releasePresence(type, id)`, `realtimeApi.getPresence(type, id): Promise<{user_id, name}[]>`.
- `usePresence(entityType, entityId, active): { others: {user_id, name}[] }` — when `active` (edit mode), POST presence on an interval (`LOCK_HEARTBEAT_MS`), DELETE on unmount/inactive; always subscribes via a React Query `['presence', type, id]` query (invalidated by the `presence` change events through `useRealtime` — extend `eventKeyMap` with `presence: [['presence']]`). `others` excludes the current user.
- `<PresenceBadge others={...} />` renders "N editing" with names.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/realtime/usePresence.test.tsx — assert:
//  - when active becomes true, realtimeApi.registerPresence is called
//  - on unmount, realtimeApi.releasePresence is called
//  - `others` filters out the current user's own id
// Mock realtimeApi and the auth store (current user id) following existing test-utils.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/realtime/usePresence.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Add to `eventKeyMap.ts`: `presence: [['presence']],`. Add presence methods to `realtimeApi.ts`:

```typescript
  registerPresence: (type: string, id: string) =>
    apiClient.post(`/realtime/presence/${type}/${id}`).then(() => undefined),
  releasePresence: (type: string, id: string) =>
    apiClient.delete(`/realtime/presence/${type}/${id}`).then(() => undefined),
  getPresence: (type: string, id: string) =>
    apiClient.get<{ present: Array<{ user_id: string; name: string }> }>(
      `/realtime/presence/${type}/${id}`,
    ).then((r) => r.data.present),
```

Create `usePresence.ts`:

```typescript
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { realtimeApi } from './realtimeApi'

const HEARTBEAT_MS = Number(import.meta.env.VITE_LOCK_HEARTBEAT_MS) || 30000

export function usePresence(entityType: string, entityId: string | undefined, active: boolean) {
  const currentUserId = useSelector((s: any) => s.auth.user?.id)

  const { data: present = [] } = useQuery({
    queryKey: ['presence', entityType, entityId],
    queryFn: () => realtimeApi.getPresence(entityType, entityId as string),
    enabled: !!entityId,
    staleTime: 0,
  })

  useEffect(() => {
    if (!active || !entityId) return
    let stopped = false
    const beat = () => { if (!stopped) realtimeApi.registerPresence(entityType, entityId).catch(() => {}) }
    beat()
    const h = setInterval(beat, HEARTBEAT_MS)
    return () => {
      stopped = true
      clearInterval(h)
      realtimeApi.releasePresence(entityType, entityId).catch(() => {})
    }
  }, [active, entityType, entityId])

  const others = present.filter((p) => p.user_id !== currentUserId)
  return { others }
}
```

Create `PresenceBadge.tsx`:

```typescript
import React from 'react'
import { Chip, Tooltip } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'

export const PresenceBadge: React.FC<{ others: Array<{ user_id: string; name: string }> }> = ({ others }) => {
  if (others.length === 0) return null
  const names = others.map((o) => o.name).join(', ')
  return (
    <Tooltip title={`Editing now: ${names}`}>
      <Chip size="small" color="warning" icon={<PeopleIcon />} label={`${others.length} editing`} sx={{ ml: 1 }} />
    </Tooltip>
  )
}
```

Wire into `ResourceDetailPage.tsx` (existing resource) and `WorkerDetailPage.tsx`: call `const { others } = usePresence('resource', id, isEditing)` and render `<PresenceBadge others={others} />` next to the section title / Edit button. For workers use `'worker'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/realtime/usePresence.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify end-to-end**

Two sessions open the same resource; Session A clicks Edit → Session B sees "1 editing (Alice)" within the tolerance; A leaves edit mode → badge disappears within TTL/heartbeat.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/realtime/realtimeApi.ts frontend/src/realtime/eventKeyMap.ts frontend/src/realtime/usePresence.ts frontend/src/realtime/PresenceBadge.tsx frontend/src/realtime/usePresence.test.tsx frontend/src/pages/resources/ResourceDetailPage.tsx frontend/src/pages/workers/WorkerDetailPage.tsx
git commit -m "feat(realtime): editing presence badges on resource and worker screens"
```

---

# PHASE 4 — L3 Advisory soft-locks (resource calendar + workers)

## Task 15: Backend lock store + endpoints

**Files:**
- Create: `backend/app/realtime/locks.py`
- Modify: `backend/app/api/v1/endpoints/realtime.py` (lock routes)
- Test: `backend/tests/unit/test_realtime_locks.py`, API cases in `test_realtime_api.py`

**Interfaces:**
- Produces (`locks.py`): `acquire_lock(entity_type, entity_id, user_id, user_name) -> dict` → `{"acquired": bool, "holder": {user_id, name} | None}` (uses `SET rt:lock:{type}:{id} <json> NX PX LOCK_TTL_MS`; if already held, returns holder), `heartbeat_lock(...) -> bool` (refresh PX only if caller is holder — Lua/`GET`+owner check), `release_lock(...) -> None` (DEL only if holder), `get_lock(entity_type, entity_id) -> dict | None` (current holder or None).
- Produces (endpoints): `POST /realtime/locks/{type}/{id}/acquire`, `POST /realtime/locks/{type}/{id}/heartbeat`, `POST /realtime/locks/{type}/{id}/release`, `GET /realtime/locks/{type}/{id}`. Acquire/release publish a `{type:"lock", id, ...}` event.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_realtime_locks.py
from unittest.mock import MagicMock, patch
from app.realtime import locks


def test_acquire_returns_true_when_setnx_succeeds():
    fake = MagicMock()
    fake.set.return_value = True
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res["acquired"] is True


def test_acquire_returns_holder_when_already_locked():
    fake = MagicMock()
    fake.set.return_value = None
    fake.get.return_value = '{"user_id": "u2", "name": "Bob"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res["acquired"] is False
    assert res["holder"]["user_id"] == "u2"


def test_release_only_deletes_when_owner():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u1", "name": "Alice"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        locks.release_lock("resource", "r1", "u1")
    fake.delete.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/unit/test_realtime_locks.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `locks.py`**

```python
# backend/app/realtime/locks.py
"""Redis-backed advisory soft-locks (best-effort, TTL + heartbeat)."""
import json
from typing import Optional

from app.core.config import settings
from app.realtime.redis_clients import get_sync_redis


def _key(entity_type: str, entity_id: str) -> str:
    return f"rt:lock:{entity_type}:{entity_id}"


def _holder(client, key) -> Optional[dict]:
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


def acquire_lock(entity_type: str, entity_id: str, user_id: str, user_name: str) -> dict:
    client = get_sync_redis()
    if client is None:
        return {"acquired": True, "holder": None}  # degrade open: rely on L1
    key = _key(entity_type, entity_id)
    payload = json.dumps({"user_id": user_id, "name": user_name})
    try:
        ok = client.set(key, payload, nx=True, px=settings.LOCK_TTL_MS)
    except Exception:  # noqa: BLE001
        return {"acquired": True, "holder": None}
    if ok:
        return {"acquired": True, "holder": {"user_id": user_id, "name": user_name}}
    holder = _holder(client, key)
    if holder and holder.get("user_id") == user_id:  # re-entrant
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


def release_lock(entity_type: str, entity_id: str, user_id: str) -> None:
    client = get_sync_redis()
    if client is None:
        return
    key = _key(entity_type, entity_id)
    holder = _holder(client, key)
    if holder and holder.get("user_id") == user_id:
        try:
            client.delete(key)
        except Exception:  # noqa: BLE001
            pass


def get_lock(entity_type: str, entity_id: str) -> Optional[dict]:
    client = get_sync_redis()
    if client is None:
        return None
    return _holder(client, _key(entity_type, entity_id))
```

Add endpoints to `realtime.py` (acquire/heartbeat/release/get), each using `current_user`, and publish a `{type:"lock", id, action}` event on acquire/release. Return the `acquire_lock`/`get_lock` dicts directly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/unit/test_realtime_locks.py tests/integration/test_realtime_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/realtime/locks.py backend/app/api/v1/endpoints/realtime.py backend/tests/unit/test_realtime_locks.py backend/tests/integration/test_realtime_api.py
git commit -m "feat(realtime): advisory soft-lock store and endpoints"
```

---

## Task 16: Frontend lock hook + banner, wired into calendar and worker edit

**Files:**
- Modify: `frontend/src/realtime/realtimeApi.ts` (lock methods)
- Modify: `frontend/src/realtime/eventKeyMap.ts` (`lock: [['lock']]`)
- Create: `frontend/src/realtime/useEntityLock.ts`
- Create: `frontend/src/realtime/LockBanner.tsx`
- Modify: `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` (gate edit mode by lock, keyed by `resourceId`)
- Modify: `frontend/src/pages/workers/WorkerDetailPage.tsx` (gate worker edit, keyed by worker id)
- Test: `frontend/src/realtime/useEntityLock.test.tsx`

**Interfaces:**
- `realtimeApi.acquireLock/heartbeatLock/releaseLock/getLock`.
- `useEntityLock(entityType, entityId, wantLock): { state: 'idle'|'held'|'blocked', holder?: {name}, takeOver: () => Promise<void> }`. When `wantLock` becomes true it calls acquire; on success `state='held'` and it heartbeats (`LOCK_HEARTBEAT_MS`); on failure `state='blocked'` with `holder`. Releases on unmount / `wantLock=false` / `beforeunload`. `takeOver()` force-acquires (release-then-acquire) after an explicit confirm.
- `<LockBanner holder state onTakeOver />` renders the read-only notice + "Take over" button when blocked.
- Calendar: when `state==='blocked'`, render read-only (do not enter edit mode) and show `<LockBanner>`. When `state==='held'`, edit as normal. Enforcement is advisory — the existing L1 bulk-conflict handling (Task 12) remains the correctness backstop.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/realtime/useEntityLock.test.tsx — assert:
//  - wantLock=true with acquire → { acquired: true } sets state 'held' and starts heartbeat
//  - acquire → { acquired: false, holder } sets state 'blocked' with holder
//  - unmount calls realtimeApi.releaseLock
//  - takeOver() calls releaseLock then acquireLock
// Mock realtimeApi; use fake timers for the heartbeat assertion.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/realtime/useEntityLock.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** `useEntityLock.ts`, `LockBanner.tsx`, and the `realtimeApi` lock methods (`acquireLock` returns `{acquired, holder}`; `heartbeatLock`; `releaseLock`; `getLock`). Wire `useEntityLock('resource', resourceId, isEditMode)` into the calendar: block entering edit mode when `state==='blocked'`, render `<LockBanner>`; and `useEntityLock('worker', id, isEditing)` into `WorkerDetailPage`. Add `lock: [['lock']]` to `eventKeyMap` so lock changes refresh any lock status query. Attach a `beforeunload` handler in `useEntityLock` that calls `releaseLock` (best-effort via `navigator.sendBeacon` or sync fetch).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/realtime/useEntityLock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify end-to-end**

Session A opens a resource calendar in edit mode (acquires lock). Session B opens the same calendar → sees read-only + "Locked by Alice"; B cannot enter edit mode. A saves/cancels/closes → lock releases (or expires within TTL) → B can now edit. Kill A's tab without saving → B can edit within ≤90s (TTL). Confirm "Take over" works with the confirm gate.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/realtime/realtimeApi.ts frontend/src/realtime/eventKeyMap.ts frontend/src/realtime/useEntityLock.ts frontend/src/realtime/LockBanner.tsx frontend/src/realtime/useEntityLock.test.tsx frontend/src/components/resources/ResourceAssignmentCalendar.tsx frontend/src/pages/workers/WorkerDetailPage.tsx
git commit -m "feat(realtime): advisory locks on resource calendar and worker edit"
```

---

## Final verification (whole feature)

- [ ] Backend: `cd backend && pytest tests/unit/test_realtime_*.py tests/integration/test_realtime_*.py -v` — all green.
- [ ] Frontend: `cd frontend && npx vitest run src/realtime/` — all green; confirm no *new* failures in `ResourceAssignmentCalendar.*` beyond the pre-existing AuthProvider backlog.
- [ ] `REALTIME_ENABLED=false` smoke test: with the flag off, all create/update/delete flows still work and the app behaves exactly as before (pure L1). Confirms graceful degradation.
- [ ] Redis-down smoke test: stop `planner-redis`; confirm edits still succeed (publish/presence/lock no-op) and the app does not error.

---

## Self-review notes (author)

- **Spec coverage:** L1 (Task 12) · L2 freshness incl. SSE+Redis+tickets+scope filter+client invalidation+reconnect (Tasks 1–11) · L3 presence (Tasks 13–14) · L3 advisory locks incl. TTL/heartbeat/release/take-over (Tasks 15–16) · configurable tolerance (Task 1 settings + Task 10 coalescing) · all-entity coverage via the generic commit listener (Task 5) · graceful degradation (Global Constraints + final verification). The "row-level nuance" motivating locks is addressed by Task 12 (per-row conflict surfacing) + Task 16 (locks on the two heavy surfaces).
- **Integration points to confirm during execution (grep, don't assume):** the auth-header fixture name in `conftest.py` (Task 7); the exact key names returned by `scope_validator_service.get_scope_summary` (Task 7); the current-user id selector shape in the Redux `auth` slice (Task 14); that `WorkerDetailPage.tsx` exposes an `isEditing`-style flag (Tasks 14/16).
- **No new dependencies**; SSE hand-rolled; every realtime call is best-effort.
