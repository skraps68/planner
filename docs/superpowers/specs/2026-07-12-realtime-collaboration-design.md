# Real-Time Collaboration & Concurrency — Design

**Date:** 2026-07-12
**Status:** Approved (design), pending implementation plan
**Branch:** target TBD (feature branch off the current line of work)
**Predecessor:** this is the "Plan B" companion referenced by
`2026-07-11-workers-resources-integrity-design.md` — that spec guaranteed
*database* consistency; this one makes changes *visible live* and protects
large in-progress edits.

## Problem being solved

Two orthogonal gaps, on top of the concurrency control the app already has:

1. **Freshness / propagation.** When one user edits an entity, other users
   with it open do not see the change until they manually refetch. We need
   server-side edits to be picked up by other clients within a *configurable
   tolerance*, via a lightweight publish-on-a-channel signal that triggers
   clients to pull a refreshed copy (not push the data itself).
2. **Wasted local work.** A user can invest significant local effort (e.g.
   restructuring a resource's allocation calendar, or reassigning a worker
   across projects) and then have it invalidated by someone else's concurrent
   change. Optimistic locking keeps this *safe* (no silent loss) but the loser
   still wastes the work.

### What already exists (and stays)

The app has **optimistic locking on all 13 user-editable entity types** via
SQLAlchemy `version_id_col`: updates carry a `version`, a mismatch raises
`StaleDataError` → HTTP 409 with the entity's `current_state`, and the frontend
shows a `ConflictDialog` (refresh-and-retry that preserves attempted changes).
Bulk assignment updates are *designed* for per-row partial success. See
`.kiro/specs/optimistic-locking/design.md`.

This design **adds to** that; it does not replace it. Optimistic locking
remains the universal correctness backstop for every entity.

## Design decisions (chosen)

- **Concurrency model:** optimistic locking (kept) + real-time freshness +
  presence signals, **plus advisory soft-locks on the two high-investment
  surfaces only** (resource allocation calendar, worker create/edit). Not full
  pessimistic locking.
- **Transport:** Server-Sent Events (SSE) fanned out via Redis pub/sub. Lock
  and presence operations are ordinary REST calls.
- **Tolerance:** a single configurable knob with tiered per-view defaults
  (~2–5s on active-editing views, ~15–30s on lists/dashboards).

## Architecture: three cooperating layers

| Layer | Purpose | Mechanism | Status |
|---|---|---|---|
| **L1 Optimistic locking** | Prevent *corruption* (never lose data silently) | Existing `version_id_col` → 409 + `current_state` | Exists; minor hardening |
| **L2 Freshness** | Others *see* changes within a tolerance | SSE + Redis pub/sub → client refetch | New |
| **L3 Presence + advisory locks** | Prevent *wasted work* on heavy surfaces | Redis locks w/ TTL + heartbeat; presence badges | New |

L1 stays the universal backstop (cheap, correct, already there). L2 makes
changes visible and *shrinks the L1 conflict window*. L3 targets only the
surfaces where a collision is expensive.

## Why every entity stays protected

L3's advisory locks are an *extra* layer on two surfaces; they remove nothing.
For every other entity, concurrent edits behave exactly as they do today:
whoever saves second against a stale `version` gets the 409 + `ConflictDialog`.
No data is ever silently lost for *any* entity.

| Entity | L1 optimistic lock | L2 freshness | L3 presence badge | L3 advisory lock |
|---|---|---|---|---|
| Portfolio | ✅ (unchanged) | ✅ | ✅ | ❌ |
| Program | ✅ | ✅ | ✅ | ❌ |
| Project | ✅ | ✅ | ✅ | ❌ |
| ProjectPhase | ✅ | ✅ | ✅ | ❌ |
| Rate | ✅ | ✅ | ✅ | ❌ |
| **Resource / assignments** | ✅ | ✅ | ✅ | ✅ |
| **Worker** | ✅ | ✅ | ✅ | ✅ |
| WorkerType, Actual, User, UserRole, ScopeAssignment | ✅ | ✅ | ✅ | ❌ |

Only two surfaces earn the advisory lock because L1 already makes quick
single-field edits *safe*, and a conflict there costs the loser only a moment's
re-entry. The advisory lock exists purely to protect a *large, multi-step local
editing session*. Adding locks to low-investment entities would add stale-lock
friction for little benefit.

### The row-level nuance (why the two surfaces genuinely need more than L1)

L1 protects each **row** individually. In the motivating example — one user
reassigns a worker while another edits that worker's assignment — if the two
users touch *different* rows (one edits assignment cells; the other deletes or
moves the assignment record), the per-row `version` checks may not collide, so
both writes can "succeed" yet leave an inconsistent picture. That structural,
cross-entity case is exactly what an advisory lock **on the worker/resource**
catches, since L1's per-row check alone would not. This is the core reason
those two surfaces get the extra layer.

## L1 — Optimistic locking (keep, harden one spot)

No structural change. Close one gap: the allocation calendar's `bulkUpdate` is
*designed* for per-row partial success, but the frontend currently treats any
failure as a whole-batch error. Harden it to consume the per-row
`succeeded`/`failed` result so that when a conflict hits, **only the conflicting
cells** are flagged and the user's other local edits survive. This alone
materially reduces "lost work" on the busiest surface.

## L2 — Freshness (SSE + Redis pub/sub)

- **Publish.** A small `events.publish(entity_type, entity_id, scope_ids,
  action)` helper is called after every successful create/update/delete commit,
  wrapped in the service/endpoint layer so coverage is uniform. It writes a
  compact JSON event to a Redis channel. Events carry **only identifiers, never
  payloads** — the lightweight "publish → clients pull" model.
- **Fan-out.** Each API process (uvicorn worker / container) runs an `asyncio`
  SSE endpoint subscribed to Redis pub/sub, so delivery works across multiple
  workers/instances. Redis is already in the stack.
- **Scope filtering.** Events include the affected `scope_ids`
  (project/portfolio). The SSE endpoint only forwards events the connected
  user's scope grants, reusing the existing scope model, so the stream leaks no
  data.
- **Auth.** `EventSource` cannot send `Authorization` headers. Clients first
  `POST /realtime/ticket` (authenticated) to mint a short-lived, single-use
  ticket, then connect `GET /realtime/stream?ticket=…`. Avoids putting the real
  bearer token in a URL.
- **Tolerance = server-side batching.** The configurable tolerance is a
  debounce/coalesce window per channel tier: active-editing events flush in
  ~2–5s, list/dashboard events coalesce to ~15–30s. One entity changing 10× in
  a burst yields one client refetch, not ten.
- **Client.** A `useRealtime` hook maps incoming events →
  `queryClient.invalidateQueries` on the matching keys (`['resources']`,
  `['assignments','resource',id]`, `['workers']`, …). React Query refetches only
  what is mounted. This also subsumes the "list is stale after I create a
  resource" bug: the creating client's own event refreshes the list.
- **Reconnect.** SSE auto-reconnects; on (re)connect the client invalidates all
  *active* queries (best-effort `Last-Event-ID`, with a full refresh of
  on-screen data as the robust fallback). Missed events during a blip self-heal.

## L3 — Presence + advisory soft-locks

- **Presence (all editable entities).** When a user opens an entity in edit
  mode, the client registers presence; others viewing it see a badge — *"Alice
  is editing."* Non-blocking, informational, prevents most collisions socially.
- **Advisory locks (heavy surfaces only):** the **resource allocation
  calendar** (keyed by resource) and **worker create/edit incl. reassignment**
  (keyed by worker). Not portfolios/programs/projects/rates.
  - **Store:** Redis `lock:{type}:{id}` via `SET NX PX <ttl>` holding
    `{userId, sessionId}`. Redis = shared across workers and gives TTL for free.
  - **Stale-lock defense:** short TTL (~90s) + client **heartbeat** (~30s)
    refreshing it. Crash/close ⇒ lock expires on its own. No permanent locks, no
    admin unlock needed.
  - **Release:** explicit owner-checked `DELETE` on Save / Cancel /
    navigate-away / tab close (`beforeunload`).
  - **Acquire-fail UX:** the second editor gets a **read-only view** with
    *"Locked by Alice (auto-releases if idle)."* plus an explicit
    **"Request / Take over"** gated behind a clear warning, so override is
    possible but never accidental.
  - **Enforcement:** advisory — enforced in the UI and re-checked at save. L1
    optimistic locking remains the true correctness guarantee even if a lock is
    bypassed or expired. Locks reduce *wasted work*; they are not the
    data-safety mechanism.

## Configuration (env-driven)

- `REALTIME_ENABLED` — kill-switch; off ⇒ pure L1 behavior.
- `REALTIME_TOLERANCE_ACTIVE_MS` / `REALTIME_TOLERANCE_LIST_MS` — tiered knobs.
- `LOCK_TTL_MS`, `LOCK_HEARTBEAT_MS`.
- Lock-enabled surfaces list.

## Usage profile (sizing assumptions)

Edits arrive in bursts, not continuously. A single project/resource manager
handles most of a project's resources; several people *can* have edit rights.
Concurrent editors on the *same* entities are expected to be ≤3 typically and
≤10 in an extreme, unlikely case. This low-contention, bursty profile is why
targeted advisory locks + optimistic backstop beat global pessimistic locking.

## Failure modes

- **Redis down:** L2/L3 degrade off; the app runs on L1 alone (kill-switch
  semantics). Editing stays safe.
- **SSE unsupported/blocked:** the client hook falls back to interval polling at
  the tolerance bound.
- **Lock holder crashes:** TTL expiry (≤90s) releases the lock.
- **Two acquire races:** `SET NX` guarantees a single winner.

## Testing strategy

- **L1 hardening:** bulk-conflict partial-success test on the calendar (only
  conflicting cells flagged; other local edits preserved).
- **L2:** publish-on-commit fires with correct scope; SSE respects scope
  filtering; client invalidates the correct query keys; reconnect triggers
  refetch; burst coalescing respects the tolerance.
- **L3:** `SET NX` mutual exclusion; TTL expiry; heartbeat refresh; owner-only
  release; acquire-fail read-only; take-over path.

## Phasing (each independently shippable)

1. **L2 freshness** — highest value; fixes the visible stale-list bug and
   delivers the "publish → pull" requirement.
2. **L1 bulk-conflict hardening** — cheap, big lost-work win on the calendar.
3. **L3 presence** — editing badges.
4. **L3 advisory locks** — calendar + workers.

## Out of scope

- Operational-transform / CRDT live co-editing (cursor-level merge).
- Advisory locking of portfolios / programs / projects / rates.
- Offline edit queueing.
- Changing any existing optimistic-locking behavior beyond the calendar
  bulk-conflict hardening.
