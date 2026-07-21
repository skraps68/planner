# Worker Cost Center + Detail-Page Edit Gating + Workers List Tidy-up — Design

**Date:** 2026-07-20
**Status:** Agreed design (brainstormed & confirmed 2026-07-20), not yet implemented. Build on a **new branch** off `main`.
**Scope:** Full-stack — add a required cost-center field to Worker, surface it on the Workers list and the worker detail/create page, gate worker editing/creation behind the edit permission, and compress the Workers list rows.

---

## 1. Goal

Give every Worker a **cost center** (same text format as a Project's cost center), show it on the Workers list and the worker detail/create screen, make it required, gate worker **edit** and **create** behind the `manage_workers` permission (edit happens only on the detail page, active only for users with edit rights), and tidy the Workers list by compressing row height.

## 2. Decisions locked during brainstorming

- **Cost center is required and non-unique.** Same format as Project's `cost_center_code` (free text, `String(50)`, 1–50 chars), but unlike Project it is **not unique** — many workers can share a cost center.
- **No inline editing on the list, no pencil icon.** Row click still opens the detail page (unchanged). Editing happens only on the detail page, and only when the user has edit rights. (This reverses an earlier idea for inline row editing; it is explicitly out of scope now.)
- **Edit and Create are both gated** by `manage_workers` on the client, for coherence (a user who cannot edit should not create).

## 3. Data model

Add to the **Worker** model (`backend/app/models/resource.py`, class `Worker`):

```python
cost_center_code = Column(String(50), nullable=False, server_default=text("'CC-0000'"), index=True)
```
(Use `text("'CC-0000'")` — a quoted SQL literal — not a bare `"CC-0000"`, which SQLAlchemy does not reliably quote.)

- `nullable=False` (required), **not `unique`** (workers share cost centers), indexed for parity with the other worker string columns (`name`, `external_id`).
- **The `server_default` is deliberate and does real work:** (a) it lets the migration add the column and fill every existing row in a single `ALTER` (no backfill loop); (b) it lets the ~17 backend test fixtures and scripts that construct `Worker(...)` directly keep working without listing the field (SQLAlchemy omits the column and the DB supplies the default), avoiding a broad fixture sweep. The **real** requiredness is enforced at the API boundary (§5): `WorkerCreate` requires a non-empty `cost_center_code`, so no worker created through the app relies on the placeholder.

## 4. Migration & seed

One Alembic migration (`down_revision` = current head `27f01e1d45e6`):

1. `op.add_column("workers", sa.Column("cost_center_code", sa.String(50), nullable=False, server_default=sa.text("'CC-0000'")))` — Postgres fills all existing rows with `CC-0000` and sets `NOT NULL` atomically; no separate backfill step.
2. Add the index on the new column.
3. `downgrade()` drops the index and the column.

The existing workers all receive the single placeholder `CC-0000`; they're dev placeholders anyway, and a real value is set by editing each worker. (A varied per-worker backfill was considered and rejected as unnecessary complexity for placeholder data.)

Also update **`backend/scripts/seed_data.py`** (`create_workers`) so each seeded worker is constructed with a distinct sample `cost_center_code` (e.g. `CC-1001` … `CC-1007`), so a fresh seed carries realistic, varied values rather than the placeholder.

## 5. Schema / API / service

- **`backend/app/schemas/resource.py`:**
  - `WorkerBase` gains `cost_center_code: str = Field(min_length=1, max_length=50, description="Cost center code")` — this flows into `WorkerCreate` and `WorkerResponse`.
  - `WorkerUpdate` gains `cost_center_code: Optional[str] = Field(default=None, min_length=1, max_length=50, ...)`.
- **`backend/app/services/resource.py`:**
  - `create_worker(...)` gains a `cost_center_code: str` parameter and includes it in the constructed create dict (alongside `external_id`, `name`, `worker_type_id`).
  - `update_worker(...)` gains `cost_center_code: Optional[str] = None`; when provided, it is added to `update_data` (same conditional pattern as the other optional fields).
- **`backend/app/api/v1/endpoints/workers.py`:** the create and update worker endpoints pass `worker_in.cost_center_code` through to the service. No change to the endpoints' auth dependency — worker (non-type) writes remain `get_current_user` (any authenticated user), the pre-existing posture. This feature's access control is **client-side only** (see §7); hardening the server is a separate, pre-existing follow-up and not in scope.

## 6. Frontend types & API

- **`frontend/src/types/index.ts`:** `Worker` gains `cost_center_code: string`.
- **`frontend/src/api/workers.ts`:** `WorkerCreateInput` gains `cost_center_code: string`; `WorkerUpdateInput` gains `cost_center_code?: string`.

## 7. Workers list (`frontend/src/pages/workers/WorkersListPage.tsx`)

- **New column "Cost Center"**, placed after Worker Type: `Name | External ID | Worker Type | Cost Center | Rate | Created | Actions`. (Header `colSpan` for the empty state updates from 6 → 7.)
- **Compress rows:** switch the `Table` to `size="small"`, change the name cell from `Typography variant="body1" fontWeight="medium"` to `variant="body2" fontWeight="medium"`, and drop the per-row `transition: 'all 0.2s ease'` (keep the hover background and the row-click navigation).
- **No inline editing, no pencil icon.** Row click still navigates to `/workers/:id`; the delete icon is unchanged.

## 8. Worker detail / create page (`frontend/src/pages/workers/WorkerDetailPage.tsx`)

- **Cost Center field** added to the existing-worker view/edit grid: a read-only value in view mode, an editable `TextField` in edit mode (placed alongside External ID / Worker Type). Included in `formData` and in the create (`isNewWorker`) form as a **required** input.
- **Edit gating:** compute `canEdit = hasPermission(user, 'manage_workers').hasPermission` (via `useAuth()`, mirroring `ResourceAllocationCalendar`). The **Edit** button renders only when `canEdit`; without it the page is read-only (view only). This makes the detail page the single edit surface, active only with edit rights.
- **Create gating:** the create flow (`/workers/new`) is also gated — if `!canEdit`, redirect away (e.g. to `/workers`) rather than showing the create form; and the **"Create Worker"** button on the list is shown only when `canEdit`.
- Cost center is validated as required in the create flow (non-empty) before submit, consistent with the other required fields there. The persisted read-only **Rate** display added previously is unchanged.

## 9. Out of scope (per the brainstorm revision)

- Inline row editing on the Workers list and the pencil-to-edit affordance.
- The "no column/field jump between view and edit modes" handling (was for inline editing).
- Server-side permission enforcement of worker writes (pre-existing open posture retained).
- Filtering/sorting the list by cost center.

## 10. Testing strategy (full cases in the plan)

- **Backend:**
  - Migration presence test (string-presence smoke, per repo convention) and a model/schema check that `cost_center_code` is required on `WorkerCreate`.
  - Service round-trip: `create_worker(..., cost_center_code=...)` persists and reads back; `update_worker(..., cost_center_code=...)` updates it.
  - **Fixture fallout:** the `server_default` means the ~17 test files that build `Worker(...)` directly need **no change** (DB supplies the default). The only required-field fallout is `backend/tests/unit/test_schemas.py::test_worker_create_valid` (line ~178), which must add `cost_center_code` to its `worker_data` dict.
- **Frontend:**
  - `WorkersListPage`: renders the Cost Center column and a worker's code; table is `size="small"`.
  - `WorkerDetailPage`: shows the cost center in view mode; shows it as an editable field in edit mode; the create form includes a required cost-center input; the **Edit** button appears for a `manage_workers` user and is absent for a viewer; a viewer hitting `/workers/new` is redirected.
- **Type budget:** `cd frontend && npx tsc --noEmit | wc -l` stays at its current baseline (record the exact number at plan time; no net new errors).

## 11. Risks / notes

1. **Required column on existing data** — the migration must backfill before applying `NOT NULL`; the fixed-seed backfill keeps it deterministic. Existing worker rows all receive a sample code.
2. **Client-only gating** — hiding Edit/Create on the client does not stop a crafted API call (the server keeps its open posture). This matches the app's existing worker-write model; server hardening is a separate follow-up.
3. **Sample cost centers are not meaningful** — backfilled/seeded values (`CC-1xxx`) are placeholders; real values would be set by editing each worker. Acceptable for dev data.
