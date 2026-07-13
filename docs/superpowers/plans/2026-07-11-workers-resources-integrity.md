# Workers & Resources Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the ResourceType enum mismatch end-to-end, enforce a strict worker↔labor-resource FK (with backfill, purge of unlinked test rows, and transactional rename cascade), switch forecasting to the FK join, and bring the workers/resources screens in line with the app's row-click + compact-detail patterns.

**Architecture:** Enum values become their names (`LABOR`/`NON_LABOR`) so DB, API, and frontend agree. `resources.worker_id` (FK, conditionally NOT NULL via CHECK, UNIQUE) is added with a backfill-and-purge migration; the resource service derives labor names from workers and the worker service cascades renames in the same transaction/commit. Forecasting resolves workers only via the FK. Frontend: row-click workers list, compact detail panels with Edit top-right, worker Autocomplete for labor resources.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + Pydantic v2 (Postgres dev via docker-compose, SQLite unit tests), React 18 + TS + MUI v5 + react-query, vitest + RTL, pytest.

**Spec:** `docs/superpowers/specs/2026-07-11-workers-resources-integrity-design.md`

## Global Constraints

- Branch: `workers-resources` (already created, off `nav-redesign`).
- Backend commands run in the container from repo root: `docker-compose exec -T app <cmd>`; frontend from `frontend/`.
- Frontend gates: `npx tsc --noEmit` adds NO NEW errors in touched files (pre-existing baseline exists); `npx vitest run <file>`.
- Backend gate: new tests pass; do not worsen the pre-existing broken suites (parked backlog).
- The missing-rate default ($1000/day labor, $500/day non-labor) in forecasting is **retained unchanged**. Only the name-matching worker lookup is deleted.
- Forecast values will change after Task 1 — expected and approved; Task 8 records before/after for one project.
- **Task 2 bundles the model change and its migration in one task** (the dev API runs `--reload` against live Postgres; the column must land in code and DB together).
- Dev servers for E2E: vite :3000, API :8000, login admin/admin123 (`login.tokens.access_token` → `localStorage.token`).

---

### Task 1: ResourceType enum fix end-to-end

**Files:**
- Modify: `backend/app/models/resource.py:16-19`
- Create: `backend/tests/unit/test_resource_enum.py`
- Sweep: any backend string-literal comparisons to `'labor'`/`'non_labor'` (grep-driven)

**Interfaces:**
- Produces: `ResourceType.LABOR.value == "LABOR"`, `ResourceType.NON_LABOR.value == "NON_LABOR"`. API requests and responses use `LABOR`/`NON_LABOR`, matching the frontend's existing `'LABOR' | 'NON_LABOR'` types and the DB's stored strings.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_resource_enum.py`:

```python
"""ResourceType must serialize identically in DB, API, and frontend ('LABOR')."""
from app.models.resource import ResourceType
from app.schemas.resource import ResourceResponse


def test_enum_values_equal_names():
    assert ResourceType.LABOR.value == "LABOR"
    assert ResourceType.NON_LABOR.value == "NON_LABOR"


def test_response_serializes_uppercase():
    payload = {
        "id": "0e0e0e0e-0e0e-0e0e-0e0e-0e0e0e0e0e0e",
        "name": "Jane Doe",
        "resource_type": ResourceType.LABOR,
        "description": None,
        "version": 1,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    resp = ResourceResponse.model_validate(payload)
    assert resp.model_dump()["resource_type"] == "LABOR"


def test_request_accepts_uppercase():
    assert ResourceType("LABOR") is ResourceType.LABOR
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker-compose exec -T app pytest tests/unit/test_resource_enum.py -q --tb=short`
Expected: FAIL — values are `labor`/`non_labor`.

- [ ] **Step 3: Change the enum**

In `backend/app/models/resource.py`:

```python
class ResourceType(str, Enum):
    """Resource types. Values equal names so DB storage (SQLEnum stores
    names), API serialization (Pydantic emits values), and the frontend's
    'LABOR' | 'NON_LABOR' literals all agree."""
    LABOR = "LABOR"
    NON_LABOR = "NON_LABOR"
```

- [ ] **Step 4: Sweep for lowercase literal dependencies**

Run: `docker-compose exec -T app grep -rn "'labor'\|\"labor\"\|'non_labor'\|\"non_labor\"" app --include="*.py"`

For each hit that compares against the enum VALUE (e.g., `resource.resource_type.value == 'labor'` or report code), update to the uppercase literal or, better, compare to `ResourceType.LABOR` directly. Do NOT touch hits that are docstrings/comments. `app/services/forecasting.py`'s `resource.resource_type.value == 'LABOR'` is already uppercase — it starts working by itself.

- [ ] **Step 5: Run tests + live checks**

Run: `docker-compose exec -T app pytest tests/unit/test_resource_enum.py -q --tb=short` → 3 passed.

Live (dev API reloads automatically):

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens']['access_token'])")
curl -s "http://localhost:8000/api/v1/resources/?limit=2" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; [print(i['name'],'->',i['resource_type']) for i in json.load(sys.stdin)['items']]"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/api/v1/resources/?resource_type=LABOR&limit=1" -H "Authorization: Bearer $TOKEN"
```

Expected: types print `LABOR`/`NON_LABOR`; the filtered request returns **200** (it could not validate before this fix).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/resource.py backend/tests/unit/test_resource_enum.py
git commit -m "fix: ResourceType values equal names — display, filters, and rate lookups align"
```

(Include any Step-4 sweep files in the same commit.)

---

### Task 2: worker_id column + backfill/purge migration (atomic pair)

**Files:**
- Modify: `backend/app/models/resource.py` (Resource model)
- Create: `backend/alembic/versions/<generated>_link_labor_resources_to_workers.py`

**Interfaces:**
- Consumes: current alembic head `7eda5195e204` (verify with `docker-compose exec -T app alembic heads`; use what it prints).
- Produces: `Resource.worker_id: Optional[UUID]` + `Resource.worker` relationship; DB with backfilled links, purged orphans, CHECK constraint `ck_resources_labor_worker`, unique index `ix_resources_worker_id`.

- [ ] **Step 1: Add the model column + relationship**

In `backend/app/models/resource.py`, inside `class Resource`, after `description`:

```python
    # Strict linkage: LABOR resources must reference a worker; NON_LABOR must not.
    # Column-nullable only because non-labor rows share this table — the CHECK
    # constraint makes NULL impossible for labor rows at the database level.
    worker_id = Column(GUID(), ForeignKey("workers.id"), nullable=True, unique=True, index=True)
```

Add to the Resource relationships:

```python
    worker = relationship("Worker")
```

Add the CHECK to `Resource.__table_args__` (create the tuple if it doesn't exist):

```python
    __table_args__ = (
        CheckConstraint(
            "(resource_type = 'LABOR' AND worker_id IS NOT NULL) OR "
            "(resource_type = 'NON_LABOR' AND worker_id IS NULL)",
            name="ck_resources_labor_worker",
        ),
    )
```

Imports: `GUID` is already imported in this file (used by Worker); add `CheckConstraint` to the sqlalchemy import line if missing.

**⚠️ The dev API may 500 on resources until Step 2 applies — proceed immediately.**

- [ ] **Step 2: Write and apply the migration**

Generate: `docker-compose exec -T app alembic revision -m "link labor resources to workers"`, then replace the body:

```python
"""link labor resources to workers

Revision ID: <keep generated>
Revises: 7eda5195e204
"""
import sqlalchemy as sa
from alembic import op

revision = "<keep generated>"
down_revision = "7eda5195e204"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Nullable column first
    op.add_column("resources", sa.Column("worker_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_resources_worker_id", "resources", "workers", ["worker_id"], ["id"])

    conn = op.get_bind()

    # 2. Backfill LABOR resources by exact name match
    conn.execute(sa.text(
        "UPDATE resources r SET worker_id = w.id "
        "FROM workers w WHERE r.resource_type = 'LABOR' AND r.name = w.name"
    ))

    # 3. Purge LABOR resources with no matching worker, dependency-first,
    #    printing what was removed (user-approved strict consistency)
    orphans = conn.execute(sa.text(
        "SELECT id, name FROM resources WHERE resource_type = 'LABOR' AND worker_id IS NULL"
    )).fetchall()
    for rid, name in orphans:
        n_act = conn.execute(sa.text(
            "DELETE FROM actuals WHERE resource_assignment_id IN "
            "(SELECT id FROM resource_assignments WHERE resource_id = :rid)"
        ), {"rid": str(rid)}).rowcount
        n_asg = conn.execute(sa.text(
            "DELETE FROM resource_assignments WHERE resource_id = :rid"
        ), {"rid": str(rid)}).rowcount
        conn.execute(sa.text("DELETE FROM resources WHERE id = :rid"), {"rid": str(rid)})
        print(f"purged unlinked labor resource '{name}' ({rid}): {n_asg} assignment(s), {n_act} actual(s)")

    # 4. Tighten: conditional NOT NULL via CHECK + one-resource-per-worker
    op.create_check_constraint(
        "ck_resources_labor_worker",
        "resources",
        "(resource_type = 'LABOR' AND worker_id IS NOT NULL) OR "
        "(resource_type = 'NON_LABOR' AND worker_id IS NULL)",
    )
    op.create_index("ix_resources_worker_id", "resources", ["worker_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_resources_worker_id", table_name="resources")
    op.drop_constraint("ck_resources_labor_worker", "resources", type_="check")
    op.drop_constraint("fk_resources_worker_id", "resources", type_="foreignkey")
    op.drop_column("resources", "worker_id")
```

Apply: `docker-compose exec -T app alembic upgrade head` — capture the purge printout for the report.

- [ ] **Step 3: Verify**

```bash
docker-compose exec -T db psql -U postgres -d planner -c \
  "SELECT r.name, r.resource_type, w.name AS worker FROM resources r LEFT JOIN workers w ON w.id = r.worker_id ORDER BY r.resource_type, r.name;"
docker-compose exec -T db psql -U postgres -d planner -c \
  "INSERT INTO resources (id, name, resource_type, description, created_at, updated_at, version) VALUES (gen_random_uuid(), 'bad labor', 'LABOR', NULL, now(), now(), 1);" ; echo "expected: CHECK violation above"
curl -s http://localhost:8000/health
```

Expected: every LABOR row shows a worker; NON_LABOR rows show NULL worker; the raw INSERT fails on `ck_resources_labor_worker`; API healthy.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/resource.py backend/alembic/versions/
git commit -m "feat: strict worker FK on labor resources with backfill and orphan purge"
```

---

### Task 3: Service + schema + endpoint wiring (create/update/rename-cascade)

**Files:**
- Modify: `backend/app/services/resource.py` (`create_resource` ~line 33, `update_resource` ~line 136, `update_worker` ~line 523)
- Modify: `backend/app/schemas/resource.py` (Create/Update/Response)
- Modify: `backend/app/api/v1/endpoints/resources.py` (pass `worker_id` through create ~line 51 and update ~line 197)
- Create: `backend/tests/unit/test_worker_resource_link.py`

**Interfaces:**
- Produces: `create_resource(db, name, resource_type, description=None, worker_id=None)`; `update_resource(db, resource_id, name=None, description=None, worker_id=None)`; worker rename cascades to the linked resource in one commit. `ResourceResponse.worker_id: Optional[UUID]`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_worker_resource_link.py` (self-contained SQLite fixture; workers need a WorkerType):

```python
"""Strict worker↔labor-resource linkage rules."""
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.services.resource import resource_service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    wt = WorkerType(id=uuid4(), type="Engineer", description="d")
    session.add(wt)
    session.flush()
    session.add(Worker(id=uuid4(), worker_type_id=wt.id, external_id="EMP001", name="Jane Doe"))
    session.commit()
    yield session
    session.close()


def _worker(db):
    return db.query(Worker).first()


def test_labor_requires_worker(db):
    with pytest.raises(ValueError):
        resource_service.create_resource(db, name="x", resource_type=ResourceType.LABOR)


def test_labor_name_derived_from_worker(db):
    w = _worker(db)
    r = resource_service.create_resource(
        db, name="ignored", resource_type=ResourceType.LABOR, worker_id=w.id
    )
    assert r.worker_id == w.id
    assert r.name == "Jane Doe"


def test_non_labor_rejects_worker(db):
    w = _worker(db)
    with pytest.raises(ValueError):
        resource_service.create_resource(
            db, name="AWS", resource_type=ResourceType.NON_LABOR, worker_id=w.id
        )


def test_duplicate_worker_link_rejected(db):
    w = _worker(db)
    resource_service.create_resource(db, name="i", resource_type=ResourceType.LABOR, worker_id=w.id)
    with pytest.raises(ValueError):
        resource_service.create_resource(db, name="i2", resource_type=ResourceType.LABOR, worker_id=w.id)


def test_worker_rename_cascades_to_resource(db):
    w = _worker(db)
    r = resource_service.create_resource(db, name="i", resource_type=ResourceType.LABOR, worker_id=w.id)
    resource_service.update_worker(db, worker_id=w.id, name="Jane Smith")
    db.refresh(r)
    assert r.name == "Jane Smith"
```

- [ ] **Step 2: Run to verify they fail**

Run: `docker-compose exec -T app pytest tests/unit/test_worker_resource_link.py -q --tb=short`
Expected: FAIL — `create_resource` has no `worker_id` parameter.

- [ ] **Step 3: Implement service rules**

`create_resource` gains `worker_id: Optional[UUID] = None` and, before building `resource_data`:

```python
        if resource_type == ResourceType.LABOR:
            if worker_id is None:
                raise ValueError("Labor resources must be linked to a worker")
            worker = worker_repository.get(db, worker_id)
            if not worker:
                raise ValueError(f"Worker with ID {worker_id} not found")
            existing_link = (
                db.query(Resource).filter(Resource.worker_id == worker_id).first()
            )
            if existing_link:
                raise ValueError(f"Worker '{worker.name}' is already linked to a resource")
            name = worker.name  # labor resource names are system-derived
        else:
            if worker_id is not None:
                raise ValueError("Non-labor resources cannot be linked to a worker")

        resource_data = {
            "name": name,
            "resource_type": resource_type,
            "description": description,
            "worker_id": worker_id,
        }
```

(`worker_repository` is defined in this same module; `Resource` is already imported.)

`update_resource` gains `worker_id: Optional[UUID] = None`, and its body enforces:

```python
        if resource.resource_type == ResourceType.LABOR:
            if worker_id is not None and worker_id != resource.worker_id:
                worker = worker_repository.get(db, worker_id)
                if not worker:
                    raise ValueError(f"Worker with ID {worker_id} not found")
                existing_link = (
                    db.query(Resource)
                    .filter(Resource.worker_id == worker_id, Resource.id != resource_id)
                    .first()
                )
                if existing_link:
                    raise ValueError(f"Worker '{worker.name}' is already linked to a resource")
                update_data["worker_id"] = worker_id
                update_data["name"] = worker.name
            # labor names are system-derived: a client-sent name is ignored
        elif name is not None:
            update_data["name"] = name
```

(Replace the existing unconditional `if name is not None:` block with the above; keep the description handling.)

`update_worker` — the rename cascade, kept in ONE commit by dirtying the linked resource in the same session before the repository's committing update:

```python
        if name is not None:
            update_data["name"] = name
            # Cascade: labor resource names are copies of the worker's name.
            # Mutating the resource in the same session means the repository's
            # single commit below persists both changes atomically.
            linked = db.query(Resource).filter(Resource.worker_id == worker_id).first()
            if linked:
                linked.name = name
```

(Add this inside the existing `if name is not None:` branch; `Resource` import already present.)

- [ ] **Step 4: Schemas + endpoints**

`app/schemas/resource.py`:
- `ResourceCreate` gains `worker_id: Optional[UUID] = Field(default=None, description="Required for LABOR; forbidden for NON_LABOR")` (add `from uuid import UUID` if missing — check the file's imports).
- `ResourceUpdate` gains the same field.
- `ResourceResponse` gains `worker_id: Optional[UUID] = Field(default=None)`.

`app/api/v1/endpoints/resources.py`: pass `worker_id=resource_in.worker_id` in both the `create_resource` (~line 51) and `update_resource` (~line 197) service calls.

- [ ] **Step 5: Run tests + live check**

Run: `docker-compose exec -T app pytest tests/unit/test_worker_resource_link.py tests/unit/test_resource_enum.py -q --tb=short` → all pass.

Live: `GET /api/v1/resources/?resource_type=LABOR&limit=1` → item has non-null `worker_id`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/resource.py backend/app/schemas/resource.py backend/app/api/v1/endpoints/resources.py backend/tests/unit/test_worker_resource_link.py
git commit -m "feat: enforce worker linkage rules and transactional rename cascade"
```

---

### Task 4: Forecasting joins strictly via worker_id

**Files:**
- Modify: `backend/app/services/forecasting.py` (`_calculate_assignment_cost`, and any sibling name-match blocks — grep `Worker.name == resource.name`)
- Create: `backend/tests/unit/test_forecast_worker_join.py`

**Interfaces:**
- Consumes: `Resource.worker_id` (Task 2).
- Produces: no name-based worker resolution anywhere in the backend.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_forecast_worker_join.py` (SQLite fixture like Task 3's, plus a Rate):

```python
"""Forecast assignment costing resolves workers via worker_id, never by name."""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.rate import Rate
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.services.forecasting import ForecastingService


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    wt = WorkerType(id=uuid4(), type="Engineer", description="d")
    session.add(wt); session.flush()
    w = Worker(id=uuid4(), worker_type_id=wt.id, external_id="EMP001", name="Jane Doe")
    session.add(w); session.flush()
    session.add(Rate(id=uuid4(), worker_type_id=wt.id, rate_amount=Decimal("1600.00"),
                     effective_date=date(2020, 1, 1), end_date=None))
    # NOTE: check app/models/rate.py for exact Rate column names (effective/end
    # dates) and adjust this fixture to match before running.
    session.add(Resource(id=uuid4(), name="Jane Doe", resource_type=ResourceType.LABOR,
                         worker_id=w.id))
    # A decoy resource with the same NAME but no link — must NOT price at 1600
    session.add(Resource(id=uuid4(), name="Jane Doe (decoy)", resource_type=ResourceType.NON_LABOR))
    session.commit()
    yield session
    session.close()


class _Asg:
    def __init__(self, resource_id):
        self.resource_id = resource_id
        self.assignment_date = date(2026, 6, 1)
        self.capital_percentage = Decimal("60.00")
        self.expense_percentage = Decimal("40.00")


def test_linked_labor_resource_uses_worker_rate(db):
    svc = ForecastingService()
    linked = db.query(Resource).filter(Resource.worker_id.isnot(None)).one()
    cost = svc._calculate_assignment_cost(db, _Asg(linked.id))
    assert cost == Decimal("1600.00")  # 1600 * (60+40)/100


def test_non_labor_uses_default(db):
    svc = ForecastingService()
    decoy = db.query(Resource).filter(Resource.worker_id.is_(None)).one()
    cost = svc._calculate_assignment_cost(db, _Asg(decoy.id))
    assert cost == Decimal("500.00")  # non-labor default retained
```

- [ ] **Step 2: Run to verify current behavior**

Run: `docker-compose exec -T app pytest tests/unit/test_forecast_worker_join.py -q --tb=short`
Expected: the linked-resource test may already pass post-Task-1 (the name still matches); it exists to LOCK the FK behavior. Fix any fixture/column mismatches (see the Rate note) until failures are only about implementation.

- [ ] **Step 3: Replace the name lookup**

In `_calculate_assignment_cost`, replace the block that does `select(Worker).where(Worker.name == resource.name)` with:

```python
            if resource.resource_type == ResourceType.LABOR and resource.worker_id:
                from app.repositories.resource import worker_repository
                worker = worker_repository.get(db, resource.worker_id)
```

(Adjust to the file's existing import style — a top-level import is fine if no cycle.) Delete the `Worker.name == resource.name` query entirely. Run `grep -rn "Worker.name == resource.name\|name == resource.name" app --include="*.py"` and remove every remaining name-join (the projections path in forecasting has a sibling copy). The default-rate fallback lines stay untouched.

- [ ] **Step 4: Run tests**

Run: `docker-compose exec -T app pytest tests/unit/test_forecast_worker_join.py tests/unit/test_worker_resource_link.py -q --tb=short` → all pass.
Grep check: `docker-compose exec -T app grep -rn "Worker.name ==" app --include="*.py"` → no output.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/forecasting.py backend/tests/unit/test_forecast_worker_join.py
git commit -m "feat: forecasting resolves workers via FK only; name-matching removed"
```

---

### Task 5: Frontend types + API inputs

**Files:**
- Modify: `frontend/src/types/index.ts` (Resource interface, ~line 66)
- Modify: `frontend/src/api/resources.ts` (Create/Update inputs)

- [ ] **Step 1: Add worker_id to the type and inputs**

`types/index.ts`, in `interface Resource`:

```ts
  worker_id?: string | null
```

`api/resources.ts`:

```ts
export interface ResourceCreateInput {
  name: string
  resource_type: 'LABOR' | 'NON_LABOR'
  description?: string
  worker_id?: string
}

export interface ResourceUpdateInput {
  name?: string
  description?: string
  worker_id?: string
  version: number
}
```

- [ ] **Step 2: Verify + commit**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "types/index|api/resources"` → no output.

```bash
git add frontend/src/types/index.ts frontend/src/api/resources.ts
git commit -m "feat: worker_id on frontend resource types"
```

---

### Task 6: Workers list — row-click navigation

**Files:**
- Modify: `frontend/src/pages/workers/WorkersListPage.tsx` (workers rows ~line 213; worker-types rows ~line 280)
- Create: `frontend/src/pages/workers/WorkersListPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/workers/WorkersListPage.test.tsx` (mock `workersApi` the way `PortfoliosListPage.test.tsx` mocks its api — copy that file's mock/navigate/store scaffolding; the workers api module is `src/api/workers.ts`, check its export names first):

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import WorkersListPage from './WorkersListPage'
import { workersApi } from '../../api/workers'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
}))
vi.mock('../../api/workers', () => ({
  workersApi: {
    list: vi.fn(),
    listTypes: vi.fn(),
    delete: vi.fn(),
  },
}))
// NOTE: open src/api/workers.ts and src/pages/workers/WorkersListPage.tsx first;
// mock EXACTLY the functions the page calls (names may differ, e.g. listWorkerTypes).

const worker = {
  id: 'w1', external_id: 'EMP001', name: 'Jane Doe', worker_type_id: 'wt1',
  version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

describe('WorkersListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(workersApi.list).mockResolvedValue({ items: [worker], total: 1, page: 1, size: 10, pages: 1 } as any)
    vi.mocked(workersApi.listTypes).mockResolvedValue({ items: [], total: 0, page: 1, size: 10, pages: 1 } as any)
  })

  it('row click navigates to the worker detail', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, {
      store: createTestStore({ auth: { user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] }, token: 't', isAuthenticated: true } }),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    await user.click(screen.getByText('Jane Doe'))
    expect(mockNavigate).toHaveBeenCalledWith('/workers/w1')
  })

  it('delete icon does not navigate', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, {
      store: createTestStore({ auth: { user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] }, token: 't', isAuthenticated: true } }),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    const del = screen.getAllByRole('button').find((b) => b.querySelector('[data-testid="DeleteIcon"]'))!
    await user.click(del)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
```

(If the page fetches with raw axios or a different api module shape, adapt the mocks — read the page first. If a confirm dialog guards delete, mock `window.confirm = () => false` so the test only asserts non-navigation.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/workers/WorkersListPage.test.tsx`
Expected: row-click test FAILS (row has no onClick).

- [ ] **Step 3: Implement**

Workers rows (~line 213):

```tsx
<TableRow
  key={worker.id}
  hover
  onClick={() => navigate(`/workers/${worker.id}`)}
  sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { backgroundColor: 'action.hover' } }}
>
```

Actions cell: delete the pencil `IconButton` entirely; the delete button gains `stopPropagation`:

```tsx
<IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteWorker(worker.id) }}>
  <DeleteIcon />
</IconButton>
```

Worker-types rows (~line 280): identical treatment — row onClick → `/workers/types/${type.id}`, pencil removed, delete stopPropagation. Remove the now-unused `Edit as EditIcon` import.

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/pages/workers/WorkersListPage.test.tsx` → all pass; `npx tsc --noEmit 2>&1 | grep WorkersListPage` → no output.

```bash
git add frontend/src/pages/workers/WorkersListPage.tsx frontend/src/pages/workers/WorkersListPage.test.tsx
git commit -m "feat: workers and worker-types lists navigate by row click"
```

---

### Task 7: Worker detail — compact panel with Edit top-right

**Files:**
- Modify: `frontend/src/pages/workers/WorkerDetailPage.tsx`

The page currently renders always-editable full-width fields with Save at the bottom. Rework the EXISTING-worker view to the app's standard pattern (the new-worker form keeps its editable layout, minus width excess):

- [ ] **Step 1: Implement the compact layout**

Existing worker (`!isNewWorker`), replace the Card content:

```tsx
<Card>
  <CardContent>
    <Grid container rowSpacing={1} columnSpacing={1}>
      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">Name</Typography>
        {isEditing ? (
          <TextField fullWidth size="small" value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={{ mt: 0.5 }} />
        ) : (
          <Typography variant="body1">{formData.name}</Typography>
        )}
      </Grid>
      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">External ID</Typography>
        {isEditing ? (
          <TextField fullWidth size="small" value={formData.external_id}
            onChange={(e) => setFormData({ ...formData, external_id: e.target.value })} sx={{ mt: 0.5 }} />
        ) : (
          <Typography variant="body1">{formData.external_id}</Typography>
        )}
      </Grid>
      <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
        {!isEditing ? (
          <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
            <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        )}
      </Grid>
      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">Worker Type</Typography>
        {isEditing ? (
          <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
            <Select value={formData.worker_type_id}
              onChange={(e) => setFormData({ ...formData, worker_type_id: e.target.value })}>
              {workerTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>{type.type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Typography variant="body1">
            {workerTypes.find((t) => t.id === formData.worker_type_id)?.type || '—'}
          </Typography>
        )}
      </Grid>
    </Grid>
  </CardContent>
</Card>
```

Supporting state/handlers to add: `const [isEditing, setIsEditing] = useState(false)`; `handleCancelEdit` restores formData from the fetched worker and clears `isEditing`; `handleSave` (existing) additionally does `setIsEditing(false)` on success and stays on the page (remove any navigate-away-on-save if present — read the current handler). Keep the Back button + title header row as-is. Keep the new-worker branch's editable form but shrink its fields to `size="small"` and `sm={4}` columns for name/external-id/type.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep WorkerDetailPage` → no output. Manual/live check in Task 9 covers rendering.

```bash
git add frontend/src/pages/workers/WorkerDetailPage.tsx
git commit -m "feat: compact worker detail with view mode and Edit top-right"
```

---

### Task 8: Resource detail — compact panel + worker Autocomplete

**Files:**
- Modify: `frontend/src/pages/resources/ResourceDetailPage.tsx`

**Interfaces:**
- Consumes: `resourcesApi` inputs with `worker_id` (Task 5); `workersApi.list` for the Autocomplete options (verify export name in `src/api/workers.ts` — fetch with a large page size, e.g. `{ size: 1000 }`).

- [ ] **Step 1: Implement**

State additions near the existing `formData`:

```tsx
const [workers, setWorkers] = useState<Worker[]>([])
const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
```

(`Worker` type from `../../types` — check it exists there; otherwise use the shape from `api/workers.ts`.) Load workers when editing a LABOR resource or creating one (simple `useEffect` calling the workers list api when `isEditing || isNew`). Initialize `selectedWorkerId` from `resource.worker_id` when the resource loads.

Existing-resource details panel — replace the current full-width fields + bottom-right buttons with the compact pattern:

```tsx
<Card sx={{ mb: 3 }}>
  <CardContent>
    <Grid container rowSpacing={1} columnSpacing={1}>
      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">
          {formData.resource_type === 'LABOR' ? 'Worker' : 'Name'}
        </Typography>
        {isEditing && formData.resource_type === 'LABOR' ? (
          <Autocomplete
            size="small"
            options={workers}
            getOptionLabel={(w) => w.name}
            value={workers.find((w) => w.id === selectedWorkerId) || null}
            onChange={(_, w) => setSelectedWorkerId(w?.id || null)}
            renderInput={(params) => <TextField {...params} placeholder="Select worker" sx={{ mt: 0.5 }} />}
          />
        ) : isEditing ? (
          <TextField fullWidth size="small" value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={{ mt: 0.5 }} />
        ) : (
          <Typography variant="body1">{formData.name}</Typography>
        )}
      </Grid>
      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">Type</Typography>
        <Typography variant="body1">
          {formData.resource_type === 'LABOR' ? 'Labor' : 'Non-Labor'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
        {/* Edit top-right / Cancel+Save in edit mode — same block as Task 7 */}
      </Grid>
      <Grid item xs={12}>
        <Typography variant="caption" color="text.secondary">Description</Typography>
        {isEditing ? (
          <TextField fullWidth size="small" multiline rows={2} value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })} sx={{ mt: 0.5 }} />
        ) : (
          <Typography variant="body1">{formData.description || '—'}</Typography>
        )}
      </Grid>
    </Grid>
  </CardContent>
</Card>
```

Save handler: for LABOR send `{ worker_id: selectedWorkerId ?? undefined, description, version }` (omit `name`; require a selection: if `selectedWorkerId` is null, set an inline error and bail); for NON_LABOR send `{ name, description, version }` as today.

New-resource form: keep the Type select; when `resource_type === 'LABOR'` render the same Autocomplete (required) instead of the Name TextField; create call sends `worker_id: selectedWorkerId!` and any placeholder name (backend derives the real one).

Imports: `Autocomplete` from `@mui/material`; the workers api.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep "resources/ResourceDetailPage"` → no new errors vs baseline for this file.

```bash
git add frontend/src/pages/resources/ResourceDetailPage.tsx
git commit -m "feat: compact resource detail; labor resources pick a worker"
```

---

### Task 9: Seed script + full verification + live E2E

**Files:**
- Modify: `backend/scripts/seed_data.py` (`create_labor_resources_for_workers`, ~line 428)
- Throwaway: `/tmp/wr_e2e.py`

- [ ] **Step 1: Seed script**

In `create_labor_resources_for_workers`, each `Resource(... resource_type=ResourceType.LABOR ...)` constructor gains `worker_id=<the worker's id>` (the function iterates workers — use each worker's `.id`). Also grep the other demo scripts: `grep -rn "ResourceType.LABOR" backend/scripts/*.py` — any labor-resource construction gets a `worker_id`. Do NOT run the seed (it wipes the dev DB); note that in the report.

- [ ] **Step 2: Test suites + tsc delta**

```bash
docker-compose exec -T app pytest tests/unit/test_resource_enum.py tests/unit/test_worker_resource_link.py tests/unit/test_forecast_worker_join.py tests/unit/test_business_id.py tests/unit/test_business_id_creation.py -q --tb=short
cd frontend && npx vitest run src/pages/workers/WorkersListPage.test.tsx src/pages/portfolios/PortfoliosListPage.test.tsx src/components/portfolio/HierarchyTree.test.tsx src/components/layout/PortfolioShell.test.tsx
npx tsc --noEmit   # every error must be in the known pre-existing baseline families
```

- [ ] **Step 3: Live E2E (headless Chrome CDP — session's established pattern; write results to a file, exit 144 is benign)**

Assert, with `/tmp/wr_e2e.py`:

1. `GET /resources?resource_type=LABOR` → 200; every item has `worker_id`; pick Jane Doe's resource id.
2. Open `/resources/<janes-id>` → Type field shows **"Labor"** (the original bug, fixed); the Worker caption shows her name.
3. Workers list: click the "Jane Doe" row → lands on `/workers/<id>` (URL check); back; click a delete icon on a decoy-free row is NOT tested live (destructive) — covered by unit test.
4. Rename flow (API-level for determinism): `PUT /workers/<janes-id>` name → "Jane Doe R"; `GET /resources/<janes-resource>` → name "Jane Doe R" (cascade); rename back.
5. Forecast before/after: capture `GET /reports/forecast/project/<mobile-project-id>` totals and compare with the values recorded in this plan's execution notes at Task 1 time — numbers should now reflect real rates (document both in the report).
6. Screenshots: compact worker detail and compact resource detail (view mode, Edit top-right) — eyeball both.

- [ ] **Step 4: Fix anything surfaced, re-run, commit**

```bash
git add -A && git commit -m "test: verify workers/resources integrity end to end"
```

---

## Self-Review Notes

- **Spec coverage:** enum fix + blast-radius sweep (T1), FK/CHECK/UNIQUE + backfill + purge with logged counts (T2), service validation + derived names + rename cascade in one commit (T3), FK-only forecasting with fallback retained (T4), frontend types (T5), row-click lists (T6), compact worker detail (T7), compact resource detail + Autocomplete + new-resource flow (T8), seed + E2E incl. the Labor-display regression and forecast before/after (T9).
- **Type consistency:** `create_resource/update_resource` `worker_id: Optional[UUID]` (T3) matches endpoint pass-through (T3) and frontend inputs (T5); `ck_resources_labor_worker` name shared between model and migration (T2).
- **Judgment calls encoded:** model+migration bundled to avoid an API-outage window; rename cascade dirties the resource in the same session so the repository's single commit covers both rows; labor `name` silently ignored on update rather than erroring (client sends it harmlessly); E2E rename via API for determinism, with UI compaction verified by screenshot.
