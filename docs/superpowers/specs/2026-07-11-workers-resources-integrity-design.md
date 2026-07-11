# Workers & Resources Integrity + UI Cleanup — Design

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Branch:** `workers-resources` (off `nav-redesign`; merges back into it)
**Companion:** a separate follow-up spec covers real-time UI push (Plan B);
this spec guarantees *database* consistency, that one makes it *visible live*.

## Problems being solved

1. Labor resources display as "Non-Labor" on the resource detail screen.
2. Labor resources have no enforced relationship to workers — the resource
   edit screen accepts any free-text name, and the forecasting service joins
   resources to workers **by name string**.
3. The workers list navigates via a pencil icon while every other list in the
   app navigates by row click.
4. The worker and resource detail screens spend too much vertical space on
   full-width Name/Type fields, with edit controls not in the standard spot.

## Root cause of (1) — and its blast radius

`ResourceType` is `LABOR = "labor"` / `NON_LABOR = "non_labor"`. SQLAlchemy's
`SQLEnum` stores the **names** (`LABOR`) in Postgres, Pydantic serializes the
**values** (`labor`), and the frontend compares against `'LABOR'`. Consequences:

- Every labor resource renders as "Non-Labor" (the reported bug).
- The forecasting service's `resource.resource_type.value == 'LABOR'` check is
  always false → real worker-rate lookups never run → every forecast has been
  silently priced at the $1000/day default fallback.
- Create/update requests sending `'LABOR'` fail enum validation.

### Fix

Change the enum values to equal the names: `LABOR = "LABOR"`,
`NON_LABOR = "NON_LABOR"`. The DB already stores those strings, so no data
migration is needed for the enum itself; API responses start matching both the
DB and the frontend's existing `'LABOR' | 'NON_LABOR'` types; the forecasting
type check starts passing.

**Accepted consequence (user-approved):** forecast numbers change, because
real worker rates replace the default-rate fallback for labor resources.

## Strict worker linkage (user decisions incorporated)

- New column: `resources.worker_id` — FK → `workers.id`.
- **CHECK constraint:** `(resource_type = 'LABOR' AND worker_id IS NOT NULL)
  OR (resource_type = 'NON_LABOR' AND worker_id IS NULL)`.
- **UNIQUE index on `worker_id`** (NULLs exempt): exactly one labor resource
  per worker. (User-confirmed.)
- `business rule:` labor resources' `name` is a denormalized copy of the
  worker's name, maintained by the system — never user-editable.

### Migration / backfill

1. Add nullable `worker_id`.
2. Backfill by exact `resources.name == workers.name` match for LABOR rows.
3. **Purge** LABOR resources with no matching worker (the "Test Resource …"
   rows), including their dependent `resource_assignments` and any `actuals`
   referencing those assignments — deleted in dependency order, with counts
   printed by the migration. (User-confirmed: strict consistency over
   preservation.)
4. Tighten: CHECK constraint + unique index.

### Rename cascade (transactional consistency)

Renaming a worker updates the linked resource's `name` **in the same DB
transaction** (service layer). The database can never hold two different
names for the same person. (Live propagation to other users' screens is Plan
B's job; this guarantees any refetch sees the new name immediately.)

### Forecasting

`_calculate_assignment_cost` resolves the worker **only** via
`resource.worker_id` — the `Worker.name == resource.name` lookup is deleted.
No name-matching fallback exists anywhere after this change (user-confirmed).
The *separate* missing-rate fallback (default $1000/day when a worker has no
rate covering the assignment date) is explicitly **retained unchanged**
(user-confirmed).

### API & schemas

- `ResourceResponse` gains `worker_id: Optional[UUID]`.
- `ResourceCreate`/`ResourceUpdate`: accept `worker_id`; for LABOR it is
  required and `name` is ignored/derived from the worker; for NON_LABOR,
  `worker_id` must be absent and `name` behaves as today. Service-layer
  validation mirrors the DB constraint with friendly errors.
- Worker update service performs the rename cascade.

## UI changes

### Workers list (consistency)

- Row click navigates to the worker detail (matching every other list).
- The pencil icon is removed; the delete icon remains as a row action
  (click stopPropagation so delete doesn't navigate).
- Same treatment on the Worker Types tab if it has the same pattern.

### Resource detail (compaction + linkage)

- Compact header: Name and Type as short side-by-side fields on one row,
  **Edit button top-right** — the same caption/value + top-right-Edit pattern
  as the program/project detail panels.
- LABOR resources: the Name field is replaced by a **worker Autocomplete**
  (options = all workers; current selection = linked worker). Choosing a
  worker sets `worker_id`; the displayed name derives from the worker. The
  resource type remains immutable after creation (as today).
- NON_LABOR resources: free-text Name field, unchanged behavior.
- New-resource form: choosing type LABOR shows the worker Autocomplete
  (required); NON_LABOR shows the free-text name.

### Worker detail (compaction)

- Same compact treatment: short fields, Edit top-right, reduced vertical
  space. Functional behavior otherwise unchanged (renames trigger the cascade
  server-side).

## Testing

- Backend: enum round-trip (API emits `LABOR`); migration backfill + purge
  behavior; constraint violations (labor without worker, non-labor with
  worker, duplicate worker links) rejected; rename cascade (worker rename →
  linked resource name updated in one transaction); forecasting resolves rate
  via FK (and no longer via name).
- Frontend: workers list row-click navigation; delete still works without
  navigating; resource detail shows "Labor" for labor resources (the original
  bug, as a regression test); worker Autocomplete sets worker_id; compact
  headers render Edit top-right.
- Live E2E: Jane Doe's resource shows "Labor" and her linked worker; renaming
  a worker via the UI updates the resource list/detail after refetch; forecast
  endpoint returns rate-based numbers for a labor-heavy project.

## Out of scope

- Real-time push to other users' open screens (Plan B, separate spec).
- Changing the missing-rate default ($1000/day) fallback.
- Worker Types screens beyond the list-navigation consistency fix.
- The Resources/Workers list pages' broader layouts (only navigation
  consistency changes).

## Risks / notes

- Forecast values shift once real rates apply — expected and approved;
  verification includes a before/after comparison for one project.
- The purge deletes data (test rows + dependents); the migration logs exactly
  what it removed, and runs inside one transaction.
- Seed script must set `worker_id` on labor resources (and stays consistent
  with the CHECK constraint).
- Any other code paths that create Resources (tests, scripts) must supply
  `worker_id` for LABOR — the plan enumerates them via grep.
