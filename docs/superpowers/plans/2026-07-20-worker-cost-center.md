# Worker Cost Center + Detail-Page Edit Gating + Workers List Tidy-up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Worker a required (non-unique) cost center, surface it on the Workers list and the worker detail/create page, gate worker edit + create behind `manage_workers`, and compress the Workers list rows.

**Architecture:** Full-stack. Backend adds `workers.cost_center_code` (`String(50)`, `NOT NULL`, `server_default='CC-0000'`) — the server default backfills existing rows in one migration and lets the ~17 test fixtures that build `Worker(...)` directly keep working; real requiredness is enforced by the `WorkerCreate` schema. Frontend adds the field to the list (new column + `size="small"` rows) and the detail/create page, and gates edit/create with the Redux-backed `usePermissions()` hook.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + Pydantic v2; React 18 + TypeScript + MUI + Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-20-worker-cost-center-design.md`.
- `cost_center_code`: `String(50)`, **required**, **non-unique**, `server_default="CC-0000"`. Same text format as Project's (1–50 chars).
- **Cost center gating is client-only** via `usePermissions().hasPermission('manage_workers')`; worker write endpoints keep their existing `get_current_user` auth (unchanged).
- **Backend tests:** `docker exec planner-app python -m pytest <paths> -q` (container cwd `/app` == host `backend/`, live-mounted). If a test result looks stale after an edit, compare `md5sum <file>` host vs `docker exec planner-app md5sum /app/<file>`; if they differ, `mv` the file to `/tmp` and back on the host to bust the virtiofs cache (never `docker cp`).
- **Migrations:** `docker exec planner-app alembic upgrade head`.
- **Frontend tests:** `cd frontend && npx vitest run <path>` — this vitest **rejects `-q`**; never pass it.
- **Type budget:** `cd frontend && npx tsc --noEmit | wc -l` stays at **234**.
- Never modify or stage `.kiro/specs/ideas.txt` or `docs/database-erd.html`.
- Branch off `main`.

---

## Task 1: Backend data layer — Worker model, migration, seed

**Files:**
- Modify: `backend/app/models/resource.py` (class `Worker`, ~line 94)
- Create: `backend/alembic/versions/c0570e17c0de_add_worker_cost_center.py`
- Modify: `backend/scripts/seed_data.py` (`create_workers`, ~line 371)
- Test: `backend/tests/integration/test_migration_worker_cost_center.py`

**Interfaces:**
- Produces: `Worker.cost_center_code` column (String(50), NOT NULL, server_default `CC-0000`, indexed `ix_workers_cost_center_code`). Task 2 reads/writes it through schema + service.

**Context:** `Worker` is in `backend/app/models/resource.py`. Alembic head is `27f01e1d45e6`. The `server_default` is what keeps the ~17 `Worker(...)` fixtures green — do not remove it.

- [ ] **Step 1: Write the migration string-presence test**

Create `backend/tests/integration/test_migration_worker_cost_center.py`:

```python
"""Smoke test: the cost-center migration adds/drops the column as expected."""
from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic" / "versions" / "c0570e17c0de_add_worker_cost_center.py"
)


def test_migration_adds_cost_center_column():
    src = MIGRATION.read_text()
    assert "down_revision = '27f01e1d45e6'" in src
    assert "add_column" in src and "cost_center_code" in src and "workers" in src
    assert "server_default" in src


def test_migration_downgrade_drops_column():
    src = MIGRATION.read_text()
    assert "drop_column" in src and "cost_center_code" in src
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_migration_worker_cost_center.py -q`
Expected: FAIL — migration file does not exist yet.

- [ ] **Step 3: Add the model column**

In `backend/app/models/resource.py`:

First ensure `text` is imported — change the SQLAlchemy import line to include it:
```python
from sqlalchemy import Column, String, ForeignKey, Enum as SQLEnum, CheckConstraint, text
```

Then in class `Worker`, add the column immediately after the `name = Column(...)` line. Use `text("'CC-0000'")` (a quoted SQL literal) — a bare `"CC-0000"` string is not reliably quoted by SQLAlchemy and would emit invalid DDL:
```python
    name = Column(String(255), nullable=False, index=True)
    cost_center_code = Column(String(50), nullable=False, server_default=text("'CC-0000'"), index=True)
```

- [ ] **Step 4: Create the migration**

Create `backend/alembic/versions/c0570e17c0de_add_worker_cost_center.py`:

```python
"""add worker cost_center_code

Adds a required (non-unique) cost center to workers. The server_default
backfills existing rows in this single ALTER and lets direct-ORM
constructions (tests/scripts) omit the field; real requiredness is enforced
by the WorkerCreate schema.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c0570e17c0de'
down_revision = '27f01e1d45e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workers",
        sa.Column("cost_center_code", sa.String(50), nullable=False, server_default=sa.text("'CC-0000'")),
    )
    op.create_index("ix_workers_cost_center_code", "workers", ["cost_center_code"])


def downgrade() -> None:
    op.drop_index("ix_workers_cost_center_code", table_name="workers")
    op.drop_column("workers", "cost_center_code")
```

- [ ] **Step 5: Run the migration test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_migration_worker_cost_center.py -q`
Expected: PASS (2 tests).

- [ ] **Step 6: Update the seed script**

In `backend/scripts/seed_data.py`, `create_workers`, give each of the seven `Worker(...)` a distinct sample code. Add `cost_center_code="CC-100N",` (N = 1..7 in worker order) to each constructor. For example the first two become:

```python
        "john_smith": Worker(
            id=uuid4(),
            external_id="EMP001",
            name="John Smith",
            worker_type_id=pick_worker_type_id(),
            cost_center_code="CC-1001",
        ),
        "jane_doe": Worker(
            id=uuid4(),
            external_id="EMP002",
            name="Jane Doe",
            worker_type_id=pick_worker_type_id(),
            cost_center_code="CC-1002",
        ),
```

Continue `CC-1003`…`CC-1007` for `bob_johnson`, `alice_williams`, `charlie_brown`, `diana_prince`, `evan_peters`.

- [ ] **Step 7: Apply the migration and verify the live DB**

Run: `docker exec planner-app alembic upgrade head`
Then verify existing rows were backfilled:

Run:
```bash
docker exec planner-app python -c "from app.db.base import SessionLocal; from app.models.resource import Worker; db=SessionLocal(); print([(w.name, w.cost_center_code) for w in db.query(Worker).limit(5)]); db.close()"
```
Expected: prints 5 workers, each with `cost_center_code == 'CC-0000'`.

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/resource.py backend/alembic/versions/c0570e17c0de_add_worker_cost_center.py backend/scripts/seed_data.py backend/tests/integration/test_migration_worker_cost_center.py
git commit -m "feat(worker): add required cost_center_code column (server_default backfill)"
```

---

## Task 2: Backend API layer — schema, service, endpoints

**Files:**
- Modify: `backend/app/schemas/resource.py` (`WorkerBase` ~line 90, `WorkerUpdate` ~line 103)
- Modify: `backend/app/services/resource.py` (`create_worker` ~line 521, `update_worker` ~line 601)
- Modify: `backend/app/api/v1/endpoints/workers.py` (`create_worker` ~line 320, `update_worker` ~line 97 of the region)
- Modify: `backend/tests/unit/test_schemas.py` (`test_worker_create_valid` ~line 178)
- Test: `backend/tests/integration/test_worker_cost_center.py`

**Interfaces:**
- Consumes: `Worker.cost_center_code` (Task 1).
- Produces: `WorkerCreate`/`WorkerResponse` carry a required `cost_center_code`; `WorkerUpdate` an optional one; `create_worker`/`update_worker` accept and persist it. Task 3/4 rely on `WorkerResponse.cost_center_code`.

**Context:** `create_worker`/`update_worker` take explicit params (not a dict); thread the new field the same way. Endpoints pass `worker_in.cost_center_code`. The only required-field fallout is the one schema test.

- [ ] **Step 1: Write the service round-trip test**

Create `backend/tests/integration/test_worker_cost_center.py`:

```python
"""Worker cost center carried through create/update, with server-default fallback."""
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.resource import Worker, WorkerType
from app.services.resource import worker_service, worker_type_service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_create_worker_persists_cost_center(db):
    wt = worker_type_service.create_worker_type(db, type="Engineer", description="d")
    w = worker_service.create_worker(
        db, external_id="EMP100", name="Cost Worker",
        worker_type_id=wt.id, cost_center_code="CC-777",
    )
    assert w.cost_center_code == "CC-777"


def test_update_worker_changes_cost_center(db):
    wt = worker_type_service.create_worker_type(db, type="Engineer", description="d")
    w = worker_service.create_worker(
        db, external_id="EMP101", name="Cost Worker 2",
        worker_type_id=wt.id, cost_center_code="CC-777",
    )
    updated = worker_service.update_worker(db, worker_id=w.id, cost_center_code="CC-888")
    assert updated.cost_center_code == "CC-888"


def test_server_default_when_omitted(db):
    wt = WorkerType(id=uuid4(), type="T", description="d")
    db.add(wt)
    db.flush()
    w = Worker(id=uuid4(), external_id="EMP102", name="No CC", worker_type_id=wt.id)
    db.add(w)
    db.commit()
    db.refresh(w)
    assert w.cost_center_code == "CC-0000"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_worker_cost_center.py -q`
Expected: FAIL — `create_worker()`/`update_worker()` reject the unexpected `cost_center_code` kwarg.

- [ ] **Step 3: Add the schema fields**

In `backend/app/schemas/resource.py`:

`WorkerBase` — add after the `name` field:
```python
class WorkerBase(BaseSchema):
    """Base worker schema with common fields."""

    worker_type_id: UUID = Field(description="Worker type ID")
    external_id: str = Field(min_length=1, max_length=100, description="External worker ID")
    name: str = Field(min_length=1, max_length=255, description="Worker name")
    cost_center_code: str = Field(min_length=1, max_length=50, description="Cost center code")
```

`WorkerUpdate` — add the optional variant:
```python
class WorkerUpdate(VersionedSchema):
    """Schema for updating an existing worker."""

    worker_type_id: Optional[UUID] = Field(default=None, description="Worker type ID")
    external_id: Optional[str] = Field(default=None, min_length=1, max_length=100, description="External worker ID")
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Worker name")
    cost_center_code: Optional[str] = Field(default=None, min_length=1, max_length=50, description="Cost center code")
```

(`WorkerCreate` and `WorkerResponse` inherit `WorkerBase`, so they pick up the required field automatically.)

- [ ] **Step 4: Thread the field through the service**

In `backend/app/services/resource.py`:

`create_worker` — add the parameter and include it in `worker_data`:
```python
    def create_worker(
        self,
        db: Session,
        external_id: str,
        name: str,
        worker_type_id: UUID,
        cost_center_code: str,
    ) -> Worker:
```
and:
```python
        worker_data = {
            "external_id": external_id,
            "name": name,
            "worker_type_id": worker_type_id,
            "cost_center_code": cost_center_code,
        }
```

`update_worker` — add the optional parameter and the conditional update:
```python
    def update_worker(
        self,
        db: Session,
        worker_id: UUID,
        external_id: Optional[str] = None,
        name: Optional[str] = None,
        worker_type_id: Optional[UUID] = None,
        cost_center_code: Optional[str] = None,
    ) -> Worker:
```
and, alongside the other `if ... is not None:` blocks (after the `worker_type_id` block):
```python
        if cost_center_code is not None:
            update_data["cost_center_code"] = cost_center_code
```

- [ ] **Step 5: Thread the field through the endpoints**

In `backend/app/api/v1/endpoints/workers.py`:

In `create_worker`, add to the service call:
```python
        worker = worker_service.create_worker(
            db=db,
            external_id=worker_in.external_id,
            name=worker_in.name,
            worker_type_id=worker_in.worker_type_id,
            cost_center_code=worker_in.cost_center_code,
        )
```

In `update_worker`, add to the service call:
```python
        worker = worker_service.update_worker(
            db=db,
            worker_id=worker_id,
            external_id=worker_in.external_id,
            name=worker_in.name,
            worker_type_id=worker_in.worker_type_id,
            cost_center_code=worker_in.cost_center_code,
        )
```

- [ ] **Step 6: Fix the one required-field fallout**

In `backend/tests/unit/test_schemas.py`, `test_worker_create_valid`, add the field to `worker_data`:
```python
        worker_data = {
            "worker_type_id": uuid4(),
            "external_id": "EMP001",
            "name": "John Developer",
            "cost_center_code": "CC-001",
        }
```

- [ ] **Step 7: Run the new + fallout tests**

Run: `docker exec planner-app python -m pytest tests/integration/test_worker_cost_center.py tests/unit/test_schemas.py -q`
Expected: PASS (3 new + the schema suite).

- [ ] **Step 8: Regression sweep of worker-touching suites**

Run: `docker exec planner-app python -m pytest tests/unit/test_worker_resource_link.py tests/unit/test_models.py tests/integration/test_forecast_four_way.py tests/unit/test_forecast_worker_join.py -q`
Expected: same pass/fail profile as before this branch (the `server_default` keeps the `Worker(...)` fixtures valid). Note any pre-existing failures but do not fix out-of-scope debt.

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/resource.py backend/app/services/resource.py backend/app/api/v1/endpoints/workers.py backend/tests/unit/test_schemas.py backend/tests/integration/test_worker_cost_center.py
git commit -m "feat(worker): carry cost_center_code through schema, service, and endpoints"
```

---

## Task 3: Frontend — types, API client, Workers list

**Files:**
- Modify: `frontend/src/types/index.ts` (`Worker`, ~line 89)
- Modify: `frontend/src/api/workers.ts` (`WorkerCreateInput` ~line 4, `WorkerUpdateInput` ~line 10)
- Modify: `frontend/src/pages/workers/WorkersListPage.tsx`
- Test: `frontend/src/pages/workers/WorkersListPage.test.tsx`

**Interfaces:**
- Consumes: `WorkerResponse.cost_center_code` (Task 2).
- Produces: `Worker.cost_center_code: string`; `WorkerCreateInput.cost_center_code: string`; `WorkerUpdateInput.cost_center_code?: string`. Task 4 uses these.

**Context:** The list uses raw fetch + a plain MUI `Table`. `usePermissions()` reads Redux `state.auth.user`; the test store provides an ADMIN user, so gating works in tests without extra mocks.

- [ ] **Step 1: Add failing tests**

In `frontend/src/pages/workers/WorkersListPage.test.tsx`:

Give the `worker` fixture a cost center (add the line):
```tsx
const worker = {
  id: 'w1',
  external_id: 'EMP001',
  name: 'Jane Doe',
  worker_type_id: 'wt1',
  cost_center_code: 'CC-1002',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
```

Add a viewer-store helper next to `adminStore`:
```tsx
const viewerStore = () =>
  createTestStore({
    auth: {
      user: { id: '2', username: 'v', email: 'v@e.c', roles: ['VIEWER'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })
```

Add two tests inside the `describe`:
```tsx
  it('shows the Cost Center column and value', async () => {
    render(<WorkersListPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('Cost Center')).toBeInTheDocument()
    expect(screen.getByText('CC-1002')).toBeInTheDocument()
  })

  it('hides Create Worker for a user without manage_workers', async () => {
    render(<WorkersListPage />, { store: viewerStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /create worker/i })).toBeNull()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && npx vitest run src/pages/workers/WorkersListPage.test.tsx`
Expected: FAIL — no Cost Center column; Create button not gated.

- [ ] **Step 3: Add the type + API fields**

`frontend/src/types/index.ts`, `Worker`:
```tsx
export interface Worker {
  id: string
  external_id: string
  name: string
  worker_type_id: string
  worker_type_name?: string
  cost_center_code: string
  current_rate?: string
  version: number
  created_at: string
  updated_at: string
}
```

`frontend/src/api/workers.ts`:
```tsx
export interface WorkerCreateInput {
  external_id: string
  name: string
  worker_type_id: string
  cost_center_code: string
}

export interface WorkerUpdateInput {
  external_id?: string
  name?: string
  worker_type_id?: string
  cost_center_code?: string
  version: number
}
```

- [ ] **Step 4: Update the list (column, compression, Create gating)**

In `frontend/src/pages/workers/WorkersListPage.tsx`:

Add the permissions hook import and usage:
```tsx
import { usePermissions } from '../../hooks/usePermissions'
```
Inside the component, near the top:
```tsx
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('manage_workers').hasPermission
```

Gate the Create button — wrap it:
```tsx
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/workers/new')}
          >
            Create Worker
          </Button>
        )}
```

Compress the table — change `<Table>` to `<Table size="small">`.

Add the Cost Center header after the Worker Type header:
```tsx
                  <TableCell sx={{ fontWeight: 'bold' }}>Worker Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Cost Center</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Rate</TableCell>
```

Update the empty-state colSpan from 6 to 7:
```tsx
                    <TableCell colSpan={7} align="center">
```

Add the Cost Center cell after the worker-type cell, and change the name cell to `body2` and drop the row transition:
```tsx
                    <TableRow
                      key={worker.id}
                      hover
                      onClick={() => navigate(`/workers/${worker.id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {worker.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{worker.external_id}</TableCell>
                      <TableCell>{workerTypeMap.get(worker.worker_type_id) || worker.worker_type_id}</TableCell>
                      <TableCell>{worker.cost_center_code || '—'}</TableCell>
                      <TableCell>
                        {worker.current_rate ? `$${Number(worker.current_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </TableCell>
```

(Leave the Created cell, the delete IconButton, and the row-click navigation as they are.)

- [ ] **Step 5: Run to verify they pass**

Run: `cd frontend && npx vitest run src/pages/workers/WorkersListPage.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Type check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/workers.ts frontend/src/pages/workers/WorkersListPage.tsx frontend/src/pages/workers/WorkersListPage.test.tsx
git commit -m "feat(workers): show Cost Center column, compress rows, gate Create by permission"
```

---

## Task 4: Frontend — Worker detail/create page (cost center + edit/create gating)

**Files:**
- Modify: `frontend/src/pages/workers/WorkerDetailPage.tsx`
- Test: `frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx`

**Interfaces:**
- Consumes: `Worker.cost_center_code`, `WorkerCreateInput`/`WorkerUpdateInput` (Task 3); `usePermissions()`.
- Produces: the sole worker edit surface (gated).

**Context:** The page handles both an existing worker (view/edit grid) and create (`id === 'new'`). `usePermissions()` reads Redux auth; the existing rate test renders with no store (auth undefined) and clicks Edit — it must be updated to render with an ADMIN store so the (now-gated) Edit button appears.

- [ ] **Step 1: Update the rate test for gating + cost center, add gating tests**

In `frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx`:

Import the store helper and add stores:
```tsx
import { render, createTestStore } from '../../test/test-utils'
```
Add near the fixtures:
```tsx
const adminStore = () =>
  createTestStore({
    auth: { user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] }, token: 't', isAuthenticated: true },
  })
const viewerStore = () =>
  createTestStore({
    auth: { user: { id: '2', username: 'v', email: 'v@e.c', roles: ['VIEWER'], permissions: [] }, token: 't', isAuthenticated: true },
  })
```
Give the `worker` fixture a cost center:
```tsx
  cost_center_code: 'CC-1002',
```
Change both existing `render(<WorkerDetailPage />)` calls to `render(<WorkerDetailPage />, { store: adminStore() })`.

Add three tests to the `describe`:
```tsx
  it('shows the cost center in read mode', async () => {
    render(<WorkerDetailPage />, { store: adminStore() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('CC-1002')).toBeInTheDocument()
  })

  it('hides the Edit button for a viewer', async () => {
    render(<WorkerDetailPage />, { store: viewerStore() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
  })

  it('makes cost center editable in edit mode', async () => {
    const user = userEvent.setup()
    render(<WorkerDetailPage />, { store: adminStore() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByDisplayValue('CC-1002')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && npx vitest run src/pages/workers/WorkerDetailPage.rate.test.tsx`
Expected: FAIL — cost center not rendered; Edit not gated.

- [ ] **Step 3: Add cost center to form state + gating hook**

In `frontend/src/pages/workers/WorkerDetailPage.tsx`:

Add imports:
```tsx
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
```

Add to `formData` initial state:
```tsx
  const [formData, setFormData] = useState({
    external_id: '',
    name: '',
    worker_type_id: '',
    cost_center_code: '',
    version: 0,
  })
```

Add the permission check after `isNewWorker` is defined:
```tsx
  const isNewWorker = id === 'new'
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('manage_workers').hasPermission
```

In `fetchWorker`, include the field in `setFormData`:
```tsx
      setFormData({
        external_id: data.external_id,
        name: data.name,
        worker_type_id: data.worker_type_id,
        cost_center_code: data.cost_center_code,
        version: data.version,
      })
```

In `handleCancelEdit`, include it:
```tsx
      setFormData({
        external_id: worker.external_id,
        name: worker.name,
        worker_type_id: worker.worker_type_id,
        cost_center_code: worker.cost_center_code,
        version: worker.version,
      })
```

In `handleSave`, guard the required field for create (before the `isNewWorker` branch):
```tsx
      if (isNewWorker && !formData.cost_center_code.trim()) {
        setError('Cost center is required')
        setSaving(false)
        return
      }
```

- [ ] **Step 4: Redirect viewers away from create; gate the Edit button; add the field**

Add the create-mode redirect right after the `if (loading) { ... }` block:
```tsx
  if (isNewWorker && !canEdit) {
    return <Navigate to="/workers" replace />
  }
```

Gate the Edit button — change the view/edit controls `Grid item` so the Edit button only renders when `canEdit`:
```tsx
              <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                {!isEditing ? (
                  canEdit && (
                    <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  )
                ) : lockState === 'blocked' ? (
                  <Button variant="outlined" size="small" onClick={handleCancelEdit}>Close</Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" size="small" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
                    <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </Box>
                )}
              </Grid>
```

Add a Cost Center grid item to the view/edit grid, immediately after the Rate `Grid item` (so row 2 reads Worker Type · Rate · Cost Center):
```tsx
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Cost Center</Typography>
                {effectiveEditing ? (
                  <TextField fullWidth size="small" value={formData.cost_center_code}
                    onChange={(e) => setFormData({ ...formData, cost_center_code: e.target.value })} sx={{ mt: 0.5 }} />
                ) : (
                  <Typography variant="body1">{formData.cost_center_code || '—'}</Typography>
                )}
              </Grid>
```

Add a required Cost Center field to the **create** grid, immediately after the Worker Type `Grid item` and before the buttons row:
```tsx
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Cost Center"
                  size="small"
                  value={formData.cost_center_code}
                  onChange={(e) => setFormData({ ...formData, cost_center_code: e.target.value })}
                  required
                />
              </Grid>
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd frontend && npx vitest run src/pages/workers/WorkerDetailPage.rate.test.tsx`
Expected: PASS (all tests — the original two rate tests plus the three new ones).

- [ ] **Step 6: Type check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/workers/WorkerDetailPage.tsx frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx
git commit -m "feat(workers): cost center on the worker detail/create page; gate edit + create by permission"
```

---

## Final Verification (after all tasks)

- [ ] Backend: `docker exec planner-app python -m pytest tests/integration/test_migration_worker_cost_center.py tests/integration/test_worker_cost_center.py tests/unit/test_schemas.py tests/unit/test_worker_resource_link.py -q` → green (no new failures vs. the documented pre-existing debt).
- [ ] Frontend: `cd frontend && npx vitest run src/pages/workers/` → green.
- [ ] `cd frontend && npx tsc --noEmit | wc -l` → `234`.
- [ ] Migration applied: `docker exec planner-app alembic upgrade head` clean; existing workers show `CC-0000`, a fresh seed would show `CC-1001…`.
- [ ] Manual smoke (optional): as an admin, the Workers list shows a Cost Center column with compressed rows and a Create Worker button; the detail page shows cost center and an Edit button that edits it; as a viewer, Create/Edit are hidden and `/workers/new` redirects to `/workers`.
