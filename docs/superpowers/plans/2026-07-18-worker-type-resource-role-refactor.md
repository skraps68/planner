# Worker Type / Resource Role Refactor + Setup Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose `WorkerType` → employment class, move job-roles into a new `ResourceRole` table referenced by labor resources, keep `Rate` per employment class, add three admin-only Setup screens (Worker Types, Rates, Resource Roles), and surface denormalized reference data (type/role/rate) read-only on the worker & resource screens.

**Architecture:** New `ResourceRole` table; `Resource` gains a nullable `resource_role_id` FK with a labor/non-labor CHECK (labor⇒role required, non-labor⇒none). `Rate` is unchanged (still per worker_type). One Alembic migration transforms existing dev data. Admin-only enforced both client (new permissions) and server (existing `check_admin_permission` dependency on write endpoints). Worker denormalization already exists server-side; resource responses are extended with a shared enrichment helper. New Setup CRUD screens follow one shared pattern.

**Tech Stack:** FastAPI + SQLAlchemy 2.x + Alembic + Pydantic v2 (backend, `backend/`), pytest. React 18 + TS + MUI + React Query + Redux + Vitest (frontend, `frontend/`).

Design spec: [docs/superpowers/specs/2026-07-18-worker-type-resource-role-refactor-design.md](../specs/2026-07-18-worker-type-resource-role-refactor-design.md).

## Global Constraints

- Build on a **new branch off `main`**; no code exists yet.
- `WorkerType` stays a table (Rate keeps its `worker_type_id` FK); reseeded to exactly **Employee, Full-Time Contractor, Fixed Price Contractor**; admin-editable.
- `ResourceRole` is a **new table** (`name` unique, `description`); seeded with the 6 old job-roles + a protected **"Default"** role.
- `Resource.resource_role_id` is a **nullable** FK with CHECK: `LABOR ⇒ resource_role_id NOT NULL`, `NON_LABOR ⇒ resource_role_id NULL`. Labor create defaults to "Default" when omitted.
- **Admin-only, client + server:** worker-type / rate / resource-role **write** endpoints require `check_admin_permission`; **read** endpoints stay open. Worker/resource create/update stay non-admin. Frontend adds `manage_worker_types`, `manage_rates`, `manage_resource_roles` (ADMIN-only) gating the waffle Setup items + routes.
- **Edit-mode rule:** the admin-owned **rate** (and the resource's derived worker-type/rate block) never render on an edit form; only `worker_type_id` / `resource_role_id` dropdowns (the entity's own assignment) are editable. Denormalized values are read/detail-only.
- Rate shown = **current** rate (`rate_service.get_current_rate` / `ratesApi.getCurrentRate`).
- Backend tests run in the container: `docker exec planner-app python -m pytest <path> -q`. Frontend: `cd frontend && npx vitest run <file>`. tsc baseline is **237** (`cd frontend && npx tsc --noEmit | wc -l`) — delta ≤ 0.
- Env note: the dev bind-mount can serve stale files to the container — after editing a backend test/file, if a run looks wrong, `md5sum` host vs `docker exec planner-app md5sum /app/<path>`; if drifted, `mv` the file out to /tmp and back (never `docker cp`), then re-check.
- Do not stage/commit `.kiro/specs/ideas.txt` (user's file). Stage only files you change.

---

## File Structure

**Backend**
- `backend/app/models/resource.py` — add `ResourceRole`; add `Resource.resource_role_id` + CHECK + relationship (Task 1)
- `backend/alembic/versions/<rev>_worker_type_resource_role_refactor.py` — migration (Task 2)
- `backend/scripts/seed_data.py` — new-world seed (Task 2)
- `backend/app/schemas/resource_role.py` — NEW schemas (Task 3)
- `backend/app/services/resource_role.py` — NEW service (Task 3)
- `backend/app/api/v1/endpoints/resource_roles.py` — NEW router, admin-gated writes (Task 3)
- `backend/app/api/v1/api.py` — register the new router (Task 3)
- `backend/app/repositories/resource_role.py` — NEW repo (Task 3)
- `backend/app/schemas/resource.py` — resource_role_id + denorm fields (Task 4)
- `backend/app/services/resource.py` — role handling + default (Task 4)
- `backend/app/api/v1/endpoints/resources.py` — enrichment helper + wire role (Task 4)
- `backend/app/api/v1/endpoints/workers.py`, `backend/app/api/v1/endpoints/rates.py` — admin-gate writes (Task 5)

**Frontend**
- `frontend/src/types/index.ts` — `ResourceRole`; Resource/Worker denorm fields (Task 6)
- `frontend/src/api/resourceRoles.ts` — NEW; `frontend/src/api/resources.ts` — role field (Task 6)
- `frontend/src/utils/permissions.ts` — 3 new admin permissions (Task 6)
- `frontend/src/pages/setup/WorkerTypesPage.tsx`, `ResourceRolesPage.tsx`, `RatesPage.tsx` — NEW (Tasks 7–9)
- `frontend/src/components/common/AdminRoute.tsx` — NEW guard (Task 7)
- `frontend/src/App.tsx`, `frontend/src/components/layout/WaffleLauncher.tsx` — routes + menu (Tasks 7–9)
- `frontend/src/pages/workers/WorkerDetailPage.tsx`, `WorkersListPage.tsx` — rate display (Task 10)
- `frontend/src/pages/resources/ResourceDetailPage.tsx`, `ResourcesListPage.tsx` — role + denorm (Task 11)

---

## PHASE A — Backend data model, migration, seed

### Task 1: `ResourceRole` model + `Resource.resource_role_id`

**Files:**
- Modify: `backend/app/models/resource.py`
- Test: `backend/tests/unit/test_resource_role_model.py` (create)

**Interfaces:**
- Produces: `ResourceRole` (`name` unique/non-null, `description` nullable, BaseModel); `Resource.resource_role_id` (nullable GUID FK → `resource_roles.id`), relationship `Resource.resource_role`, CHECK `ck_resources_labor_role`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_resource_role_model.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from app.models.base import Base
from app.models.resource import Resource, ResourceRole, ResourceType


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine)()


def test_resource_role_unique_name(db):
    db.add(ResourceRole(name="Engineer")); db.flush()
    db.add(ResourceRole(name="Engineer"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_labor_requires_role_check(db):
    role = ResourceRole(name="Engineer"); db.add(role); db.flush()
    # non-labor with a role -> rejected
    db.add(Resource(name="NL", resource_type=ResourceType.NON_LABOR, resource_role_id=role.id))
    with pytest.raises(IntegrityError):
        db.flush()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/unit/test_resource_role_model.py -q`
Expected: FAIL — `ResourceRole`/`resource_role_id` don't exist.

- [ ] **Step 3: Write minimal implementation**

In `backend/app/models/resource.py`: add `ResourceRole` and extend `Resource`.

```python
class ResourceRole(BaseModel):
    """Job-role classification for a (labor) resource. Admin-managed reference data."""
    __tablename__ = "resource_roles"

    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(String(1000), nullable=True)

    resources = relationship("Resource", back_populates="resource_role")

    def __repr__(self) -> str:
        return f"<ResourceRole(id={self.id}, name='{self.name}')>"
```

Extend `Resource.__table_args__` with the role CHECK and add the column + relationship:

```python
    __table_args__ = (
        CheckConstraint(
            "(resource_type = 'LABOR' AND worker_id IS NOT NULL) OR "
            "(resource_type = 'NON_LABOR' AND worker_id IS NULL)",
            name="ck_resources_labor_worker",
        ),
        CheckConstraint(
            "(resource_type = 'LABOR' AND resource_role_id IS NOT NULL) OR "
            "(resource_type = 'NON_LABOR' AND resource_role_id IS NULL)",
            name="ck_resources_labor_role",
        ),
    )
    # ... existing name / resource_type / description / worker_id columns ...
    resource_role_id = Column(GUID(), ForeignKey("resource_roles.id"), nullable=True, index=True)
    resource_role = relationship("ResourceRole", back_populates="resources")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/unit/test_resource_role_model.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/resource.py backend/tests/unit/test_resource_role_model.py
git commit -m "feat(model): add ResourceRole and Resource.resource_role_id with labor CHECK"
```

### Task 2: Migration (data transform) + seed_data.py

**Files:**
- Create: `backend/alembic/versions/<rev>_worker_type_resource_role_refactor.py`
- Modify: `backend/scripts/seed_data.py`
- Test: `backend/tests/integration/test_migration_worker_type_role.py` (create)

**Interfaces:**
- Consumes: Task 1 model.
- Produces: migration whose `upgrade()` yields exactly 3 employment-class worker_types, 6 job-roles + "Default" as resource_roles, every worker on a new type (~80% Employee), every labor resource with a role, non-labor with none, one rate per employment type.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_migration_worker_type_role.py
import glob, os

def test_refactor_migration_exists_and_transforms():
    matches = glob.glob(os.path.join(os.path.dirname(__file__), "..", "..",
        "alembic", "versions", "*worker_type_resource_role*.py"))
    assert matches, "refactor migration not found"
    src = open(matches[0]).read()
    assert "resource_roles" in src
    assert "resource_role_id" in src
    assert "Employee" in src and "Fixed Price Contractor" in src
    assert "Default" in src
    assert "ck_resources_labor_role" in src
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_migration_worker_type_role.py -q`
Expected: FAIL — file not found.

- [ ] **Step 3: Write the migration**

`docker exec planner-app alembic heads` → use that as `down_revision`. Fresh 12-hex `revision`. Use `from app.models.base import GUID`. All row transforms in raw SQL via `op.get_bind()`, with a fixed RNG seed for the random reassignments.

```python
"""worker_type_resource_role_refactor

Repurpose worker_types to employment classes, move the old job-role worker_types
into a new resource_roles table, add resources.resource_role_id, reassign workers
(~80% Employee) and labor resources (random role), replace rates with one per
employment class. RNG seeded for reproducibility.
"""
import random, uuid
from datetime import date
from alembic import op
import sqlalchemy as sa
from app.models.base import GUID

revision = '<REV>'
down_revision = '<HEAD>'
branch_labels = None
depends_on = None

EMP_TYPES = [("Employee", "1000.00"), ("Full-Time Contractor", "1300.00"), ("Fixed Price Contractor", "1500.00")]


def upgrade() -> None:
    conn = op.get_bind()
    rng = random.Random(20260718)
    now = "now()"

    # 1. resource_roles table
    op.create_table(
        "resource_roles",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_unique_constraint("uq_resource_roles_name", "resource_roles", ["name"])
    op.create_index("ix_resource_roles_name", "resource_roles", ["name"])

    # 2. copy old job-role worker_types -> resource_roles, + Default
    old_types = conn.execute(sa.text("SELECT id, type, description FROM worker_types")).fetchall()
    role_ids = []
    for _oid, t, d in old_types:
        rid = str(uuid.uuid4())
        conn.execute(sa.text(
            "INSERT INTO resource_roles (id, name, description, created_at, updated_at, version) "
            "VALUES (:id, :n, :d, now(), now(), 1)"), {"id": rid, "n": t, "d": d})
        role_ids.append(rid)
    default_id = str(uuid.uuid4())
    conn.execute(sa.text(
        "INSERT INTO resource_roles (id, name, description, created_at, updated_at, version) "
        "VALUES (:id, 'Default', 'Default resource role', now(), now(), 1)"), {"id": default_id})
    role_ids.append(default_id)

    # 3. insert new employment-class worker_types
    emp_ids = {}
    for name, _rate in EMP_TYPES:
        wid = str(uuid.uuid4())
        conn.execute(sa.text(
            "INSERT INTO worker_types (id, type, description, created_at, updated_at, version) "
            "VALUES (:id, :t, :d, now(), now(), 1)"), {"id": wid, "t": name, "d": name})
        emp_ids[name] = wid

    # 4. reassign workers ~80% Employee
    worker_rows = conn.execute(sa.text("SELECT id FROM workers")).fetchall()
    contractor = [emp_ids["Full-Time Contractor"], emp_ids["Fixed Price Contractor"]]
    for (wkid,) in worker_rows:
        newt = emp_ids["Employee"] if rng.random() < 0.8 else rng.choice(contractor)
        conn.execute(sa.text("UPDATE workers SET worker_type_id = :t WHERE id = :id"),
                     {"t": newt, "id": str(wkid)})

    # 5. drop old rates, then old worker_types (now unreferenced)
    old_type_ids = [str(r[0]) for r in old_types]
    if old_type_ids:
        conn.execute(sa.text("DELETE FROM rates WHERE worker_type_id = ANY(:ids)"), {"ids": old_type_ids})
        conn.execute(sa.text("DELETE FROM worker_types WHERE id = ANY(:ids)"), {"ids": old_type_ids})

    # 6. one current rate per employment class
    for name, rate in EMP_TYPES:
        conn.execute(sa.text(
            "INSERT INTO rates (id, worker_type_id, rate_amount, start_date, end_date, created_at, updated_at, version) "
            "VALUES (:id, :wt, :amt, :sd, NULL, now(), now(), 1)"),
            {"id": str(uuid.uuid4()), "wt": emp_ids[name], "amt": rate, "sd": date.today().isoformat()})

    # 7. resources.resource_role_id + backfill + CHECK
    op.add_column("resources", sa.Column("resource_role_id", GUID(), nullable=True))
    op.create_index("ix_resources_resource_role_id", "resources", ["resource_role_id"])
    op.create_foreign_key("fk_resources_resource_role_id", "resources", "resource_roles",
                          ["resource_role_id"], ["id"])
    labor = conn.execute(sa.text("SELECT id FROM resources WHERE resource_type = 'LABOR'")).fetchall()
    for (rid,) in labor:
        conn.execute(sa.text("UPDATE resources SET resource_role_id = :role WHERE id = :id"),
                     {"role": rng.choice(role_ids), "id": str(rid)})
    op.create_check_constraint(
        "ck_resources_labor_role", "resources",
        "(resource_type = 'LABOR' AND resource_role_id IS NOT NULL) OR "
        "(resource_type = 'NON_LABOR' AND resource_role_id IS NULL)")
    bad = conn.execute(sa.text(
        "SELECT COUNT(*) FROM resources WHERE resource_type='LABOR' AND resource_role_id IS NULL")).scalar()
    if bad:
        raise Exception(f"{bad} labor resources left without a role")
    print("worker_type/resource_role refactor complete.")


def downgrade() -> None:
    # Structural rollback only (does not restore pre-refactor row values).
    op.drop_constraint("ck_resources_labor_role", "resources", type_="check")
    op.drop_constraint("fk_resources_resource_role_id", "resources", type_="foreignkey")
    op.drop_index("ix_resources_resource_role_id", table_name="resources")
    op.drop_column("resources", "resource_role_id")
    op.drop_index("ix_resource_roles_name", table_name="resource_roles")
    op.drop_table("resource_roles")
```

Then update `backend/scripts/seed_data.py`: replace the 6 `WorkerType(...)` job-role rows with the 3 employment classes; create a `ResourceRole` set (the 6 job-role names + "Default"); when creating workers, assign ~80% Employee; when creating labor resources, set `resource_role_id` (random role); seed one `Rate` per employment class. (Read the current worker/resource/rate seeding blocks and adapt in place.)

- [ ] **Step 4: Run test + apply migration**

```bash
docker exec planner-app python -m pytest tests/integration/test_migration_worker_type_role.py -q
docker exec planner-app alembic upgrade head
docker exec planner-app python - <<'PY'
import logging; logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
from sqlalchemy.orm import Session; from app.db.base import engine
from app.models.resource import WorkerType, ResourceRole, Worker, Resource
with Session(engine) as s:
    print("worker_types:", sorted(w.type for w in s.query(WorkerType).all()))
    print("roles:", sorted(r.name for r in s.query(ResourceRole).all()))
    print("labor w/o role:", s.query(Resource).filter(Resource.resource_type=='LABOR', Resource.resource_role_id==None).count())
    print("nonlabor w/ role:", s.query(Resource).filter(Resource.resource_type=='NON_LABOR', Resource.resource_role_id!=None).count())
PY
```
Expected: test PASS; worker_types == the 3 employment classes; roles == 6 job-roles + Default; 0 labor-without-role; 0 nonlabor-with-role.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/*worker_type_resource_role*.py backend/scripts/seed_data.py backend/tests/integration/test_migration_worker_type_role.py
git commit -m "feat(migration): repurpose worker_types to employment classes, add resource_roles"
```

---

## PHASE B — Backend API

### Task 3: `ResourceRole` schemas + repo + service + admin-gated endpoints

**Files:**
- Create: `backend/app/schemas/resource_role.py`, `backend/app/repositories/resource_role.py`, `backend/app/services/resource_role.py`, `backend/app/api/v1/endpoints/resource_roles.py`
- Modify: `backend/app/api/v1/api.py`
- Test: `backend/tests/integration/test_resource_roles_api.py` (create)

**Interfaces:**
- Produces: `GET /api/v1/resource-roles` (open) and `POST`/`PUT`/`DELETE` (admin-only via `check_admin_permission`); `resource_role_service` with `list/get/create/update/delete`; delete blocked when a resource references the role OR the role is "Default".

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_resource_roles_api.py
from tests.integration.conftest import *  # reuse client / auth fixtures if present
# NOTE: if no shared fixtures exist, define a local `client` + admin/non-admin token
# fixtures following backend/tests/integration/test_middleware_integration.py.

def test_list_roles_open_to_any_user(client, auth_headers):
    r = client.get("/api/v1/resource-roles", headers=auth_headers)
    assert r.status_code == 200

def test_create_role_requires_admin(client, auth_headers, admin_auth_headers):
    body = {"name": "QA Engineer", "description": "d"}
    assert client.post("/api/v1/resource-roles", json=body, headers=auth_headers).status_code == 403
    r = client.post("/api/v1/resource-roles", json=body, headers=admin_auth_headers)
    assert r.status_code == 201

def test_default_role_cannot_be_deleted(client, admin_auth_headers):
    roles = client.get("/api/v1/resource-roles", headers=admin_auth_headers).json()
    default = next(r for r in roles if r["name"] == "Default")
    assert client.delete(f"/api/v1/resource-roles/{default['id']}", headers=admin_auth_headers).status_code == 400
```

(If the integration suite lacks reusable `client`/`auth_headers`/`admin_auth_headers`, add them to `backend/tests/integration/conftest.py` following `test_middleware_integration.py`'s `auth_headers`/`admin_auth_headers` fixtures and `test_assignment_api.py`'s override pattern.)

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_resource_roles_api.py -q`
Expected: FAIL — 404 (route missing).

- [ ] **Step 3: Implement**

`schemas/resource_role.py`:
```python
from typing import Optional
from uuid import UUID
from pydantic import Field
from .base import BaseSchema, TimestampMixin, VersionedSchema

class ResourceRoleBase(BaseSchema):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)

class ResourceRoleCreate(ResourceRoleBase): pass

class ResourceRoleUpdate(VersionedSchema):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)

class ResourceRoleResponse(ResourceRoleBase, TimestampMixin, VersionedSchema):
    id: UUID
    resource_count: Optional[int] = Field(default=0)
```

`repositories/resource_role.py`: a `BaseRepository[ResourceRole]` subclass (mirror `repositories/resource.py`), plus `get_by_name`.

`services/resource_role.py`: `list/get/create/update/delete`. `delete` raises `ValueError` if `role.name == "Default"` or any resource references it (count via a query). `create`/`update` enforce unique name (catch/raise `ValueError` on duplicate).

`api/v1/endpoints/resource_roles.py` — reads open, writes admin-gated:
```python
from app.api.deps import get_db, get_current_user, check_admin_permission
# GET "/" and GET "/{id}" -> Depends(get_current_user)
# POST "/", PUT "/{id}", DELETE "/{id}" -> Depends(check_admin_permission)
# each write returns ResourceRoleResponse; populate resource_count via service.
```

`api/v1/api.py`: `api_router.include_router(resource_roles.router, prefix="/resource-roles", tags=["resource-roles"])`.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_resource_roles_api.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/resource_role.py backend/app/repositories/resource_role.py backend/app/services/resource_role.py backend/app/api/v1/endpoints/resource_roles.py backend/app/api/v1/api.py backend/tests/integration/test_resource_roles_api.py backend/tests/integration/conftest.py
git commit -m "feat(api): resource-roles CRUD (admin-gated writes, Default protected)"
```

### Task 4: Resource role assignment + denormalized response

**Files:**
- Modify: `backend/app/schemas/resource.py`, `backend/app/services/resource.py`, `backend/app/api/v1/endpoints/resources.py`
- Test: `backend/tests/integration/test_resource_role_assignment.py` (create)

**Interfaces:**
- Consumes: Tasks 1, 3.
- Produces: `ResourceCreate`/`ResourceUpdate` accept `resource_role_id`; labor create defaults to "Default" when omitted, non-labor rejects a role; `ResourceResponse` carries `resource_role_id`, `resource_role_name`, and for labor `worker_name`, `worker_type_name`, `current_rate`, populated by a shared `_enrich(resource)` helper.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_resource_role_assignment.py
def test_labor_resource_defaults_to_default_role(client, auth_headers, labor_worker_fixture):
    body = {"name": "_", "resource_type": "LABOR", "worker_id": str(labor_worker_fixture.id)}
    r = client.post("/api/v1/resources/", json=body, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["resource_role_name"] == "Default"
    assert data["worker_type_name"] is not None   # denormalized
    # current_rate present (worker's employment-class rate)
    assert "current_rate" in data

def test_nonlabor_resource_rejects_role(client, auth_headers, some_role_id):
    body = {"name": "License", "resource_type": "NON_LABOR", "resource_role_id": some_role_id}
    r = client.post("/api/v1/resources/", json=body, headers=auth_headers)
    assert r.status_code == 400
```

(Add fixtures `labor_worker_fixture` / `some_role_id` to the integration conftest — a Worker on an employment-class WorkerType with a rate, and a ResourceRole id.)

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_resource_role_assignment.py -q`
Expected: FAIL — `resource_role_name` absent / role not accepted.

- [ ] **Step 3: Implement**

`schemas/resource.py`:
```python
class ResourceCreate(ResourceBase):
    worker_id: Optional[UUID] = Field(default=None, description="Required for LABOR; forbidden for NON_LABOR")
    resource_role_id: Optional[UUID] = Field(default=None, description="LABOR only; defaults to 'Default'")

class ResourceUpdate(VersionedSchema):
    ...  # existing
    resource_role_id: Optional[UUID] = Field(default=None)

class ResourceResponse(ResourceBase, TimestampMixin, VersionedSchema):
    worker_id: Optional[UUID] = Field(default=None)
    resource_role_id: Optional[UUID] = Field(default=None)
    resource_role_name: Optional[str] = Field(default=None)
    worker_name: Optional[str] = Field(default=None)
    worker_type_name: Optional[str] = Field(default=None)
    current_rate: Optional[str] = Field(default=None)
    assignment_count: Optional[int] = Field(default=0)
```

`services/resource.py` — `create_resource`/`update_resource` gain `resource_role_id`:
- LABOR: if `resource_role_id` is None, resolve the "Default" role id (`resource_role_repository.get_by_name(db, "Default")`) and use it. Validate the role exists.
- NON_LABOR: if `resource_role_id` provided, raise `ValueError("Non-labor resources cannot have a resource role")`; force None.

`api/v1/endpoints/resources.py` — add a shared enrichment helper and use it wherever a `ResourceResponse` is built (create/get/list/update/labor-list/non-labor-list):
```python
def _enrich(db, resource) -> ResourceResponse:
    from app.services.resource import rate_service, worker_service
    resp = ResourceResponse.model_validate(resource)
    resp.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
    resp.resource_role_name = resource.resource_role.name if resource.resource_role else None
    if resource.resource_type == ResourceType.LABOR and resource.worker_id:
        w = resource.worker  # add `worker` relationship on Resource if not present
        if w:
            resp.worker_name = w.name
            resp.worker_type_name = w.worker_type.type if w.worker_type else None
            cur = rate_service.get_current_rate(db, w.worker_type_id)
            resp.current_rate = str(cur.rate_amount) if cur else None
    return resp
```
(If `Resource.worker` relationship doesn't exist, add `worker = relationship("Worker")` on `Resource` in Task 1's file — note it there; there is already `Resource.worker` via `worker_id`? verify; the model has `worker = relationship("Worker")` already — confirm and reuse.) Pass `resource_in.resource_role_id` through the endpoint→service calls.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_resource_role_assignment.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/resource.py backend/app/services/resource.py backend/app/api/v1/endpoints/resources.py backend/tests/integration/test_resource_role_assignment.py backend/tests/integration/conftest.py
git commit -m "feat(api): resource role assignment (default) + denormalized resource response"
```

### Task 5: Admin-gate worker-type & rate write endpoints

**Files:**
- Modify: `backend/app/api/v1/endpoints/workers.py` (worker-**type** writes only), `backend/app/api/v1/endpoints/rates.py`
- Test: `backend/tests/integration/test_setup_admin_gating.py` (create)

**Interfaces:**
- Consumes: `check_admin_permission`.
- Produces: `POST/PUT/DELETE /workers/types*` and rate **mutations** require admin; worker (non-type) and rate **reads** stay open; worker create/update stay non-admin.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_setup_admin_gating.py
def test_worker_type_create_requires_admin(client, auth_headers, admin_auth_headers):
    body = {"type": "Temp Type", "description": "d"}
    assert client.post("/api/v1/workers/types", json=body, headers=auth_headers).status_code == 403
    assert client.post("/api/v1/workers/types", json=body, headers=admin_auth_headers).status_code == 201

def test_worker_type_list_open(client, auth_headers):
    assert client.get("/api/v1/workers/types", headers=auth_headers).status_code == 200

def test_rate_create_requires_admin(client, auth_headers, admin_auth_headers, employment_type_id):
    body = {"worker_type_id": employment_type_id, "rate_amount": 999, "start_date": "2026-08-01"}
    assert client.post("/api/v1/rates/", json=body, headers=auth_headers).status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_setup_admin_gating.py -q`
Expected: FAIL — currently returns 201/200 (no gating).

- [ ] **Step 3: Implement**

In `workers.py`, change the dependency on `create_worker_type`, `update_worker_type`, `delete_worker_type` from `Depends(get_current_user)` to `Depends(check_admin_permission)` (import it). Leave all `GET /types*` and all worker (non-type) endpoints on `get_current_user`.

In `rates.py`, change every mutating route (`create`, `updateRate`/update, `close`, and any POST/PUT/DELETE) to `Depends(check_admin_permission)`; leave GET routes on `get_current_user`. (Read `rates.py` first to enumerate the exact routes.)

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_setup_admin_gating.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/workers.py backend/app/api/v1/endpoints/rates.py backend/tests/integration/test_setup_admin_gating.py
git commit -m "feat(api): admin-gate worker-type and rate write endpoints"
```

---

## PHASE C — Frontend plumbing

### Task 6: Types, APIs, permissions

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/api/resources.ts`, `frontend/src/utils/permissions.ts`
- Create: `frontend/src/api/resourceRoles.ts`
- Test: `frontend/src/utils/permissions.test.ts` (extend or create)

**Interfaces:**
- Produces: `ResourceRole` type; `Resource`/`Worker` types gain denorm fields; `resourceRolesApi` (list/get/create/update/delete); `resources.ts` create/update accept `resource_role_id`; permissions `manage_worker_types`/`manage_rates`/`manage_resource_roles` (ADMIN only).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/utils/permissions.test.ts  (add cases)
import { hasPermission } from './permissions'
const admin = { roles: ['ADMIN'] } as any
const viewer = { roles: ['VIEWER'] } as any
test('admin has setup permissions', () => {
  expect(hasPermission(admin, 'manage_rates').hasPermission).toBe(true)
  expect(hasPermission(admin, 'manage_resource_roles').hasPermission).toBe(true)
  expect(hasPermission(admin, 'manage_worker_types').hasPermission).toBe(true)
})
test('viewer lacks setup permissions', () => {
  expect(hasPermission(viewer, 'manage_rates').hasPermission).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/permissions.test.ts`
Expected: FAIL — permission not in union / not granted.

- [ ] **Step 3: Implement**

`permissions.ts`: add the three permissions to the `Permission` union and to `rolePermissions.ADMIN` only.

`types/index.ts`: add
```typescript
export interface ResourceRole { id: string; name: string; description?: string; resource_count?: number; version: number }
```
and extend `Resource` with `resource_role_id?`, `resource_role_name?`, `worker_name?`, `worker_type_name?`, `current_rate?`; confirm `Worker` has `worker_type_name?` and `current_rate?` (add if missing).

`api/resourceRoles.ts`: standard CRUD against `/resource-roles` (mirror `api/rates.ts` shape).

`api/resources.ts`: add `resource_role_id?: string` to the create/update request interfaces.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/utils/permissions.test.ts && npx tsc --noEmit | wc -l
```
Expected: PASS; tsc ≤ 237.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/resources.ts frontend/src/api/resourceRoles.ts frontend/src/utils/permissions.ts frontend/src/utils/permissions.test.ts
git commit -m "feat(fe): resource-role types/api + admin setup permissions"
```

---

## PHASE D — Setup screens (admin-only)

### Task 7: Resource Roles Setup screen + route guard + waffle

**Files:**
- Create: `frontend/src/pages/setup/ResourceRolesPage.tsx`, `frontend/src/components/common/AdminRoute.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/layout/WaffleLauncher.tsx`
- Test: `frontend/src/pages/setup/ResourceRolesPage.test.tsx` (create)

**Interfaces:**
- Produces: an admin-only CRUD page at `/setup/resource-roles`; `AdminRoute` guard (redirects non-admins to `/portfolios`); a "Resource Roles" waffle item under Setup gated by `manage_resource_roles`. This is the **reference pattern** reused by Tasks 8–9.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/setup/ResourceRolesPage.test.tsx
import { render, screen, waitFor } from '../../test/test-utils'
import { vi } from 'vitest'
const listMock = vi.fn()
vi.mock('../../api/resourceRoles', () => ({ resourceRolesApi: {
  list: (...a:any[]) => listMock(...a), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
}}))
import ResourceRolesPage from './ResourceRolesPage'

test('renders the roles table', async () => {
  listMock.mockResolvedValue([{ id: 'r1', name: 'Engineer', description: 'd', version: 1 }])
  render(<ResourceRolesPage />)
  await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /add role/i })).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/setup/ResourceRolesPage.test.tsx`
Expected: FAIL — page doesn't exist.

- [ ] **Step 3: Implement**

`components/common/AdminRoute.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { Permission } from '../../utils/permissions'

export const AdminRoute: React.FC<{ permission: Permission; children: React.ReactNode }> = ({ permission, children }) => {
  const { hasPermission } = usePermissions()
  return hasPermission(permission).hasPermission ? <>{children}</> : <Navigate to="/portfolios" replace />
}
```

`ResourceRolesPage.tsx`: a table (MUI) of roles with Add/Edit/Delete via a dialog. On mount `resourceRolesApi.list()`. Create/edit dialog has name + description; delete calls `resourceRolesApi.delete` and shows the server error (e.g. Default-protected / in-use) in a snackbar. Disable the delete button for the row where `name === 'Default'`.

`App.tsx`: add route
```tsx
<Route path="/setup/resource-roles" element={<AdminRoute permission="manage_resource_roles"><ResourceRolesPage /></AdminRoute>} />
```

`WaffleLauncher.tsx`: in the `Setup` group `items`, add `{ label: 'Resource Roles', path: '/setup/resource-roles', permission: 'manage_resource_roles' }`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/pages/setup/ResourceRolesPage.test.tsx && npx tsc --noEmit | wc -l
```
Expected: PASS; tsc ≤ 237.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/setup/ResourceRolesPage.tsx frontend/src/components/common/AdminRoute.tsx frontend/src/App.tsx frontend/src/components/layout/WaffleLauncher.tsx frontend/src/pages/setup/ResourceRolesPage.test.tsx
git commit -m "feat(fe): admin-only Resource Roles setup screen + AdminRoute guard"
```

### Task 8: Worker Types Setup screen

**Files:**
- Create: `frontend/src/pages/setup/WorkerTypesPage.tsx`, test `WorkerTypesPage.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/layout/WaffleLauncher.tsx`

**Interfaces:**
- Consumes: Task 7 pattern (`AdminRoute`), `workerTypesApi` (exists).
- Produces: admin-only CRUD at `/setup/worker-types`; waffle item gated by `manage_worker_types`.

- [ ] **Step 1: Write the failing test** — mirror Task 7's test against `workerTypesApi` (rows show `type`; column also shows `current_rate` read-only; "Add Worker Type" button).
- [ ] **Step 2: Run — FAIL** (`cd frontend && npx vitest run src/pages/setup/WorkerTypesPage.test.tsx`).
- [ ] **Step 3: Implement** — same table/dialog pattern as `ResourceRolesPage` but against `workerTypesApi` (fields `type` + `description`; show read-only `current_rate` column). Add route wrapped in `<AdminRoute permission="manage_worker_types">` and waffle item `{ label: 'Worker Types', path: '/setup/worker-types', permission: 'manage_worker_types' }`.
- [ ] **Step 4: Run — PASS** + tsc ≤ 237.
- [ ] **Step 5: Commit** — `feat(fe): admin-only Worker Types setup screen`.

### Task 9: Rates Setup screen

**Files:**
- Create: `frontend/src/pages/setup/RatesPage.tsx`, test `RatesPage.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/layout/WaffleLauncher.tsx`

**Interfaces:**
- Consumes: Task 7 pattern, `workerTypesApi.list()` + `ratesApi` (`getRateHistory`/`create`/`updateRate`).
- Produces: admin-only screen at `/setup/rates`; one row per employment-class worker type showing its **current rate**, with an action to set a new dated rate; waffle item gated by `manage_rates`.

- [ ] **Step 1: Write the failing test** — mock `workerTypesApi.list` → 3 types with `current_rate`; assert the three type names + their current rates render, and a "Set rate" action exists.
- [ ] **Step 2: Run — FAIL**.
- [ ] **Step 3: Implement** — list the worker types (each already carries `current_rate`); a "Set rate" dialog captures `rate_amount` + `start_date` and calls `ratesApi.updateRate(workerTypeId, amount, effectiveDate)` (closes the previous open rate), then refreshes. Optionally expand a row to show `ratesApi.getRateHistory`. Route under `<AdminRoute permission="manage_rates">`; waffle item `{ label: 'Rates', path: '/setup/rates', permission: 'manage_rates' }`.
- [ ] **Step 4: Run — PASS** + tsc ≤ 237.
- [ ] **Step 5: Commit** — `feat(fe): admin-only Rates setup screen`.

---

## PHASE E — Worker & resource detail/list enhancements

### Task 10: Worker rate display

**Files:**
- Modify: `frontend/src/pages/workers/WorkerDetailPage.tsx`, `frontend/src/pages/workers/WorkersListPage.tsx`
- Test: `frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx` (create)

**Interfaces:**
- Consumes: `WorkerResponse.current_rate` (exists).
- Produces: worker detail shows a **read-only Rate** in read mode only (hidden in edit); workers list shows a Rate column.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx
// mock workersApi.get -> worker with current_rate '1000.00', worker_type_name 'Employee'
// mock workerTypesApi.list -> [Employee...]
// assert read mode shows the rate; after clicking Edit, the rate value is NOT shown as an editable field.
```
(Mirror the mocking approach used elsewhere in `src/pages/workers`; if none, `vi.mock('../../api/workers', ...)`.)

- [ ] **Step 2: Run — FAIL**.
- [ ] **Step 3: Implement** — in `WorkerDetailPage`, add a "Rate" grid item that renders `worker?.current_rate` (formatted as currency) **only when `!effectiveEditing`** (read mode). Do not add it to the create form or edit form. In `WorkersListPage`, add a "Rate" column bound to `row.current_rate`.
- [ ] **Step 4: Run — PASS** + tsc ≤ 237.
- [ ] **Step 5: Commit** — `feat(fe): show worker rate (read-only) on detail + list`.

### Task 11: Resource role selection + denormalized display

**Files:**
- Modify: `frontend/src/pages/resources/ResourceDetailPage.tsx`, `frontend/src/pages/resources/ResourcesListPage.tsx`
- Test: `frontend/src/pages/resources/ResourceDetailPage.role.test.tsx` (create)

**Interfaces:**
- Consumes: `resourceRolesApi.list`, enriched `ResourceResponse`.
- Produces: labor create/edit shows a **Resource Role** dropdown pre-selected to "Default"; read mode (labor) shows a read-only denormalized block (worker type + rate); non-labor shows no role field; resources list gains Role / Type / Rate columns.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/resources/ResourceDetailPage.role.test.tsx
// mock resourceRolesApi.list -> [{id:'d', name:'Default'}, {id:'e', name:'Engineer'}]
// render create mode for LABOR: assert a "Resource Role" select exists, defaulting to Default.
// render read mode for a labor resource with worker_type_name + current_rate: assert both shown,
//   and that no role/rate <input> appears when NOT editing beyond the role select intent.
```

- [ ] **Step 2: Run — FAIL**.
- [ ] **Step 3: Implement** — in `ResourceDetailPage`:
  - Load roles via `resourceRolesApi.list()`; keep `resource_role_id` in `formData` (default to the "Default" role's id once roles load, for new labor resources).
  - Render the **Resource Role `Select`** only when `resource_type === 'LABOR'` (create + edit); include it in the create/update payload (`resource_role_id`).
  - In **read mode** for a labor resource, render a read-only block: worker link (exists) + **Worker Type** (`resource.worker_type_name`) + **Rate** (`resource.current_rate`, formatted). Do **not** render type/rate on the edit form.
  - In `ResourcesListPage`, add columns: **Role** (`row.resource_role_name`), and for labor rows **Type** (`row.worker_type_name`) + **Rate** (`row.current_rate`).
- [ ] **Step 4: Run — PASS** + tsc ≤ 237.
- [ ] **Step 5: Commit** — `feat(fe): resource role selection + denormalized type/rate display`.

---

## Final verification (after all tasks)

- [ ] Backend: `docker exec planner-app python -m pytest tests/unit/test_resource_role_model.py tests/integration/test_migration_worker_type_role.py tests/integration/test_resource_roles_api.py tests/integration/test_resource_role_assignment.py tests/integration/test_setup_admin_gating.py -q` — all green.
- [ ] `docker exec planner-app alembic upgrade head` clean; spot-check: 3 employment worker_types, 6 job-roles + Default, every labor resource has a role, non-labor none, one rate per type.
- [ ] Frontend: `cd frontend && npx vitest run src/pages/setup src/pages/workers src/pages/resources src/utils/permissions.test.ts` green; `npx tsc --noEmit | wc -l` ≤ 237.
- [ ] Drive the app: as **admin** — Setup shows Worker Types / Rates / Resource Roles; edit a rate; add a resource role; as **non-admin** those items are hidden and deep-linking `/setup/rates` redirects. Worker detail shows rate read-only (gone in edit). Create a labor resource — role dropdown defaults to Default; its detail shows worker type + rate; edit form shows the role dropdown but no rate.
- [ ] Regression: re-run the labor/non-labor and forecasting suites; confirm no NEW failures beyond the documented `test-repair-backlog` debt (rate values shift is expected; assert structure, not old amounts).

## Self-review (author)

- **Spec coverage:** §3 model → Tasks 1,4; §4 migration/seed → Task 2; §5 admin (server) → Tasks 3,5, (client) → Tasks 6,7; §6.1 Setup screens → Tasks 7–9; §6.2 worker rate → Task 10; §6.3 resource role + denorm → Task 11; §6.4 lists → Tasks 10,11; §7 denorm delivery → Task 4 (resources) + already-built (workers).
- **Parked (§8):** fixed-price accrual — not in any task; documented follow-up only.
- **Green-build ordering:** model → migration → backend API → FE plumbing → screens → detail/list; each task ends independently testable. Frontend Task 6 lands types/permissions before the screens consume them.
- **Reuse:** `check_admin_permission` (exists), worker denormalization (exists), `workerTypesApi`/`ratesApi` (exist) — flagged so implementers don't rebuild them. The three Setup screens share the Task-7 pattern.
- **Type consistency:** `resource_role_id` / `resource_role_name` / `worker_type_name` / `current_rate` names match across backend schema, response enrichment, and frontend types/columns; permission slugs `manage_worker_types|rates|resource_roles` match between `permissions.ts`, routes, and waffle items.
