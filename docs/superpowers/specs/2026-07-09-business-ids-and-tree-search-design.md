# Business IDs + Hierarchy Tree Search/Collapse — Design

**Date:** 2026-07-09
**Status:** Approved (design), pending implementation plan
**Branch:** `business-ids` (off `nav-redesign`; merges after/with it)

## Problem & Goal

Two related improvements:

1. **Human-friendly business IDs.** Portfolios, programs, and projects only have
   UUIDs. Users need short, typeable, recognizable identifiers — for search, for
   verbal reference, and for display. IDs must be 9 numeric digits with leading
   zeros always displayed, auto-generated, and typed by range so a reader can
   tell what kind of entity an ID names.
2. **Hierarchy tree UX.** The slim nav tree (from the nav redesign) needs: a
   search field that filters it without misrepresenting the hierarchy, an ID
   search/display toggle, and a collapse control so the tree can get out of the
   way horizontally.

## Part 1 — Business IDs (full-stack)

### ID format and typed ranges

- 9 numeric digits, stored and displayed **with leading zeros** → stored as a
  9-char string (`CHAR/VARCHAR(9)`), never an integer, in API responses and
  frontend types alike.
- IDs are allocated per entity type from a configurable base, making the type
  readable from the first digits:

| entity_type | base_id     | first assigned |
|-------------|-------------|----------------|
| portfolio   | 010000000   | 010000001      |
| program     | 020000000   | 020000001      |
| project     | 030000000   | 030000001      |

- Globally unambiguous in practice (ranges don't overlap below 10M entities per
  type); each table also carries its own UNIQUE constraint on `business_id`.

### `business_id_config` table

One row per entity type; directly editable in the database (no admin UI yet):

```
business_id_config(
  entity_type  VARCHAR PK   -- 'portfolio' | 'program' | 'project'
  base_id      INTEGER NOT NULL
  next_sequence INTEGER NOT NULL DEFAULT 1
)
```

Allocation: `business_id = zero_pad9(base_id + next_sequence)`, then increment
`next_sequence`, in the same transaction as the entity INSERT (`SELECT … FOR
UPDATE` on Postgres; SQLite's single-writer semantics suffice for tests).
Changing a base later affects only future IDs; existing rows keep theirs. The
UNIQUE constraint is the safety net against collisions.

### Schema & migration (Alembic)

- Add `business_id VARCHAR(9)` (nullable) to `portfolios`, `programs`,
  `projects`.
- Create `business_id_config`, seed the three rows with the bases above.
- Backfill all existing rows per type in `created_at` order, consuming
  sequences from the config table.
- Tighten: `business_id` NOT NULL + UNIQUE (per table) + index.

### Backend integration

- Generation happens in the **create paths** of the three entities (service or
  repository layer, wherever each entity's create currently lives) — never
  client-supplied. `business_id` is absent from create/update request schemas
  and read-only in responses.
- Pydantic response schemas for portfolio, program, project gain
  `business_id: str`.
- Baseline caution: the pre-existing broken backend test suites (parked
  backlog) must not get *worse*; new/changed code paths get their own tests.

### Frontend surfacing

- `business_id: string` added to the Portfolio, Program, Project TS types.
- Detail pages: an **ID** field in each details section (read-only).
- Rich list + tree: see Part 2 (display governed by the `#` toggle; the shared
  search always matches `business_id` when the toggle is on).

## Part 2 — Hierarchy tree search, `#` toggle, collapse

### Header row

The tree pane gains a compact header: `[ search field ][ # ][ ‹ ]`
(search input, ID-mode toggle button, collapse chevron).

### Search behavior (shared state)

- The search field binds to the **existing shared persisted search** in
  `usePortfolioListState` — the same state the rich list uses. Filtering in
  the tree pre-filters the rich list on return, and vice versa.
- **Filtered rendering (the hierarchy-honesty rule):** show every match plus
  all its ancestors, auto-expanded; hide everything else. Non-matching
  ancestors render **dimmed** (context, not matches). A matching parent shows
  all its children. The **matched substring is highlighted** within each name.
  These are the same visibility semantics the rich list already implements.

### `#` toggle (ID mode)

- Small toggle button (`#`) right of the search field; state persisted in
  `usePortfolioListState` alongside search/expansion.
- **ON:** every tree name renders as `(business_id) Name`; search matches
  against business IDs in addition to names; the rich list's name columns show
  the same `(business_id) Name` prefix; the tree widens modestly (~280px) to
  absorb the prefix.
- **OFF:** names only, name-only matching, 240px width.

### Collapse control

- Chevron in the tree header collapses the pane to a **~24px vertical rail**
  containing a single expand chevron; the content pane takes the freed width.
- Collapsed state persists in sessionStorage with the rest of list state.
- Narrow-screen swap mode (below `md`) is unaffected — it already alternates
  tree/content and keeps its own toggle.

## Out of scope

- Admin UI for `business_id_config` (edit directly in DB for now).
- Business IDs for entities other than portfolio/program/project (workers,
  resources, actuals unchanged).
- Repairing the pre-existing broken test suites (parked backlog).

## Testing

- Backend: unit tests for the allocator (zero-padding, per-type bases,
  sequential increments, uniqueness on conflict/retry) and create-path
  integration (new entity gets the next typed ID); migration backfill verified
  against the dev DB.
- Frontend: tree filter tests (match visible + ancestors dimmed + others
  hidden + auto-expand), highlight rendering, `#` toggle display/matching,
  collapse rail toggle + persistence; rich list ID-prefix rendering when
  toggle on.
- Live E2E: seed DB → verify typed IDs backfilled; tree search by name and by
  ID fragment; collapse/expand round-trip; screenshot review.

## Risks / notes

- The tree header adds vertical height before the first row (accepted).
- Backfill order is `created_at` — arbitrary but stable; acceptable for
  auto-generated placeholder IDs.
- Concurrent creates race on `next_sequence`; row-level locking + UNIQUE
  constraint + single retry covers it.
- `business_id` stays a string end-to-end; any code that parseInt()s it loses
  leading zeros and is a bug.
