# Labor / Non-Labor Budget Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split every phase budget, actual, and forecast into four categories — labor-capital, labor-expense, non-labor-capital, non-labor-expense — on top of the existing capital/expense split, while keeping all existing totals and capital/expense views numerically unchanged.

**Architecture:** New `Numeric(15,2)` columns replace the two phase budget columns; `capital_budget`/`expense_budget` survive as read-only hybrid sums so downstream readers don't change. `Actual` gains a required `resource_id` (the single labor/non-labor classifier), makes labor-only columns nullable, and drops the write-only `resource_assignment_id`. Actuals import splits into a labor (percentage) importer and a non-labor (dollar) importer. `ForecastData.to_dict()` adds four sub-keys per series while keeping the old three. The frontend extends `CategoryBreakdown`, threads a Labor/Non-Labor toggle into `transformForecastData`, and adds four budget inputs to the phase editor.

**Tech Stack:** FastAPI + SQLAlchemy 2.x + Alembic + Pydantic v2 (backend, `backend/`), pytest. React 18 + TypeScript + MUI + Recharts + React Query (frontend, `frontend/`), Vitest.

## Global Constraints

- Build on a **new branch off `main` (`fb761cb`)**; no code exists yet.
- **Totals must not move:** the migration backfills existing `capital_budget → labor_capital_budget`, `expense_budget → labor_expense_budget`, non-labor columns = 0. Every phase's capital/expense/total stays identical.
- Money columns are `Numeric(15, 2)`, `nullable=False`, `default=0`, each `>= 0`.
- The four phase budget columns MUST sum to `total_budget` (DB CheckConstraint + Pydantic validator + service validation, all three).
- `resource_type` (`LABOR` | `NON_LABOR`) is the ONLY labor/non-labor classifier, on both actuals and forecast.
- API stays backward compatible: every financial series emits `{total, capital, expense}` AND `{labor_capital, labor_expense, nonlabor_capital, nonlabor_expense}`.
- Chart toggle default: both Labor and Non-Labor on; never allow both off.
- Backend tests run inside the app container: `docker exec planner-app python -m pytest <path> -q` (cwd `/app` = host `backend/`, live-mounted). Frontend: `cd frontend && npx vitest run <file>`.
- Column/key names are fixed (used verbatim across tasks): `labor_capital_budget`, `labor_expense_budget`, `nonlabor_capital_budget`, `nonlabor_expense_budget`; series keys `labor_capital`, `labor_expense`, `nonlabor_capital`, `nonlabor_expense`.

---

## File Structure

**Backend**
- `backend/app/models/project.py` — `ProjectPhase`: 4 budget columns + hybrids (Phase A)
- `backend/app/models/actual.py` — `Actual`: `resource_id`, nullable labor cols, drop `resource_assignment_id` (Phase B)
- `backend/app/models/resource_assignment.py` — remove `actuals` relationship (Phase B)
- `backend/alembic/versions/<rev>_phase_labor_nonlabor_budget.py` — phases migration (Phase A)
- `backend/alembic/versions/<rev>_actual_resource_id.py` — actuals migration (Phase B)
- `backend/app/schemas/phase.py` — 4 budget fields (Phase A)
- `backend/app/services/phase_service.py` — batch handles 4 fields (Phase A)
- `backend/app/api/v1/endpoints/phases.py` — batch maps 4 fields (Phase A)
- `backend/app/services/actuals.py` — labor/non-labor create paths, drop assignment id (Phase B/C)
- `backend/app/services/actuals_import.py` — split into labor + non-labor importers (Phase C)
- `backend/app/schemas/actual.py` — labor/non-labor import schemas (Phase C)
- `backend/app/api/v1/endpoints/actuals.py` — two import endpoints (Phase C)
- `backend/app/services/forecasting.py` — 4-way `ForecastData` + `to_dict` (Phase D)
- `backend/app/services/reporting.py` — 4-way aggregation (Phase D)
- `backend/app/services/variance_analysis.py` — labor-only guard (Phase D)

**Frontend**
- `frontend/src/api/forecast.ts` — `CategoryBreakdown` 4-way (Phase E)
- `frontend/src/utils/forecastTransform.ts` — toggle-aware transform (Phase E)
- `frontend/src/types/index.ts` — `ProjectPhase` 4 fields (Phase E)
- `frontend/src/api/phases.ts` — 4 budget fields on request/response types (Phase E)
- `frontend/src/components/phases/PhaseList.tsx` — 4 inputs, two-row header, read-only total (Phase E)
- `frontend/src/components/phases/PhaseEditor.tsx` — save 4 fields (Phase E)
- `frontend/src/components/portfolio/ChartSection.tsx` + `FinancialSummaryTable.tsx` — consume toggled data (unchanged shape) (Phase E)
- `frontend/src/pages/projects/ProjectDetailPage.tsx`, `frontend/src/pages/programs/ProgramDetailPage.tsx` — toggle state + wiring (Phase E)

---

## PHASE A — Phase budget model (4 columns + derived hybrids)

### Task 1: `ProjectPhase` model — four budget columns + derived hybrids

**Files:**
- Modify: `backend/app/models/project.py:62-92`
- Test: `backend/tests/unit/test_project_phase_budget_split.py` (create)

**Interfaces:**
- Produces: `ProjectPhase.labor_capital_budget`, `.labor_expense_budget`, `.nonlabor_capital_budget`, `.nonlabor_expense_budget` (`Numeric(15,2)` columns); read-only hybrids `.capital_budget`, `.expense_budget`; constraint `check_budget_sum` over the four columns.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_project_phase_budget_split.py
from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from app.models.project import Project, ProjectPhase


def _make_project(db):
    from datetime import date
    p = Project(
        program_id=None, name="P", business_sponsor="s", project_manager="m",
        technical_lead="t", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        cost_center_code="CC-PHASE-SPLIT",
    )
    db.add(p); db.flush()
    return p


def test_phase_four_budget_columns_and_derived_hybrids(db_session):
    project = _make_project(db_session)
    from datetime import date
    phase = ProjectPhase(
        project_id=project.id, name="Ph", start_date=date(2026, 1, 1), end_date=date(2026, 6, 30),
        labor_capital_budget=Decimal("100.00"), labor_expense_budget=Decimal("50.00"),
        nonlabor_capital_budget=Decimal("30.00"), nonlabor_expense_budget=Decimal("20.00"),
        total_budget=Decimal("200.00"),
    )
    db_session.add(phase); db_session.flush()
    assert phase.capital_budget == Decimal("130.00")   # 100 + 30
    assert phase.expense_budget == Decimal("70.00")     # 50 + 20


def test_phase_budget_sum_constraint_rejects_mismatch(db_session):
    project = _make_project(db_session)
    from datetime import date
    phase = ProjectPhase(
        project_id=project.id, name="Ph", start_date=date(2026, 1, 1), end_date=date(2026, 6, 30),
        labor_capital_budget=Decimal("100.00"), labor_expense_budget=Decimal("50.00"),
        nonlabor_capital_budget=Decimal("30.00"), nonlabor_expense_budget=Decimal("20.00"),
        total_budget=Decimal("999.00"),  # != 200
    )
    db_session.add(phase)
    with pytest.raises(IntegrityError):
        db_session.flush()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/unit/test_project_phase_budget_split.py -q`
Expected: FAIL — `TypeError`/`AttributeError` (no `labor_capital_budget`).

- [ ] **Step 3: Write minimal implementation**

In `backend/app/models/project.py`, add the hybrid import and rewrite the `ProjectPhase` budget columns/constraints:

```python
from sqlalchemy.ext.hybrid import hybrid_property
```

Replace the two budget columns (`capital_budget`, `expense_budget`) with:

```python
    labor_capital_budget = Column(Numeric(15, 2), nullable=False, default=0)
    labor_expense_budget = Column(Numeric(15, 2), nullable=False, default=0)
    nonlabor_capital_budget = Column(Numeric(15, 2), nullable=False, default=0)
    nonlabor_expense_budget = Column(Numeric(15, 2), nullable=False, default=0)
    total_budget = Column(Numeric(15, 2), nullable=False, default=0)
```

Add hybrids after the relationships:

```python
    @hybrid_property
    def capital_budget(self):
        return (self.labor_capital_budget or 0) + (self.nonlabor_capital_budget or 0)

    @hybrid_property
    def expense_budget(self):
        return (self.labor_expense_budget or 0) + (self.nonlabor_expense_budget or 0)
```

Replace `__table_args__` with:

```python
    __table_args__ = (
        CheckConstraint('start_date <= end_date', name='check_phase_dates'),
        CheckConstraint('labor_capital_budget >= 0', name='check_labor_capital_budget_positive'),
        CheckConstraint('labor_expense_budget >= 0', name='check_labor_expense_budget_positive'),
        CheckConstraint('nonlabor_capital_budget >= 0', name='check_nonlabor_capital_budget_positive'),
        CheckConstraint('nonlabor_expense_budget >= 0', name='check_nonlabor_expense_budget_positive'),
        CheckConstraint('total_budget >= 0', name='check_total_budget_positive'),
        CheckConstraint(
            'labor_capital_budget + labor_expense_budget + '
            'nonlabor_capital_budget + nonlabor_expense_budget = total_budget',
            name='check_budget_sum'),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/unit/test_project_phase_budget_split.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/project.py backend/tests/unit/test_project_phase_budget_split.py
git commit -m "feat(model): split ProjectPhase budget into labor/non-labor columns with derived hybrids"
```

### Task 2: Alembic migration — phase budget columns

**Files:**
- Create: `backend/alembic/versions/<rev>_phase_labor_nonlabor_budget.py`
- Test: `backend/tests/integration/test_migration_phase_budget.py` (create)

**Interfaces:**
- Consumes: Task 1 columns/constraints.
- Produces: migration revision whose `upgrade()` preserves each phase's capital/expense/total.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_migration_phase_budget.py
import importlib.util, glob, os

def test_phase_budget_migration_module_exists_and_backfills_into_labor():
    matches = glob.glob(os.path.join(
        os.path.dirname(__file__), "..", "..", "alembic", "versions",
        "*phase_labor_nonlabor_budget*.py"))
    assert matches, "phase budget migration file not found"
    spec = importlib.util.spec_from_file_location("mig", matches[0])
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    assert hasattr(mod, "upgrade") and hasattr(mod, "downgrade")
    src = open(matches[0]).read()
    # backfill maps old capital/expense into the LABOR columns, non-labor = 0
    assert "labor_capital_budget = capital_budget" in src
    assert "labor_expense_budget = expense_budget" in src
    assert "check_budget_sum" in src
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_migration_phase_budget.py -q`
Expected: FAIL — `AssertionError: phase budget migration file not found`.

- [ ] **Step 3: Write minimal implementation**

Find the current head: `docker exec planner-app alembic heads`. Create the file (replace `<DOWN>` with that head revision, `<REV>` with a fresh 12-hex id):

```python
# backend/alembic/versions/<REV>_phase_labor_nonlabor_budget.py
"""phase_labor_nonlabor_budget

Split ProjectPhase.capital_budget/expense_budget into four labor/non-labor
columns. Backfill preserves every phase's capital/expense/total exactly by
loading existing values into the LABOR columns (non-labor = 0).
"""
from alembic import op
import sqlalchemy as sa

revision = '<REV>'
down_revision = '<DOWN>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # 1. add nullable-first for backfill
    for col in ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget'):
        op.add_column('project_phases', sa.Column(col, sa.Numeric(15, 2), nullable=True))
    # 2. backfill: old capital/expense -> labor; non-labor -> 0
    conn.execute(sa.text("""
        UPDATE project_phases SET
            labor_capital_budget = capital_budget,
            labor_expense_budget = expense_budget,
            nonlabor_capital_budget = 0,
            nonlabor_expense_budget = 0
    """))
    # 3. lock down not-null
    for col in ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget'):
        op.alter_column('project_phases', col, nullable=False)
    # 4. drop old constraints + columns
    op.drop_constraint('check_budget_sum', 'project_phases', type_='check')
    op.drop_constraint('check_capital_budget_positive', 'project_phases', type_='check')
    op.drop_constraint('check_expense_budget_positive', 'project_phases', type_='check')
    op.drop_column('project_phases', 'capital_budget')
    op.drop_column('project_phases', 'expense_budget')
    # 5. new constraints
    op.create_check_constraint('check_labor_capital_budget_positive', 'project_phases', 'labor_capital_budget >= 0')
    op.create_check_constraint('check_labor_expense_budget_positive', 'project_phases', 'labor_expense_budget >= 0')
    op.create_check_constraint('check_nonlabor_capital_budget_positive', 'project_phases', 'nonlabor_capital_budget >= 0')
    op.create_check_constraint('check_nonlabor_expense_budget_positive', 'project_phases', 'nonlabor_expense_budget >= 0')
    op.create_check_constraint(
        'check_budget_sum', 'project_phases',
        'labor_capital_budget + labor_expense_budget + '
        'nonlabor_capital_budget + nonlabor_expense_budget = total_budget')
    count = conn.execute(sa.text("SELECT COUNT(*) FROM project_phases")).scalar()
    print(f"phase budget split migration complete. {count} phases migrated.")


def downgrade() -> None:
    conn = op.get_bind()
    op.add_column('project_phases', sa.Column('capital_budget', sa.Numeric(15, 2), nullable=True))
    op.add_column('project_phases', sa.Column('expense_budget', sa.Numeric(15, 2), nullable=True))
    conn.execute(sa.text("""
        UPDATE project_phases SET
            capital_budget = labor_capital_budget + nonlabor_capital_budget,
            expense_budget = labor_expense_budget + nonlabor_expense_budget
    """))
    op.alter_column('project_phases', 'capital_budget', nullable=False)
    op.alter_column('project_phases', 'expense_budget', nullable=False)
    op.drop_constraint('check_budget_sum', 'project_phases', type_='check')
    for name in ('check_labor_capital_budget_positive', 'check_labor_expense_budget_positive',
                 'check_nonlabor_capital_budget_positive', 'check_nonlabor_expense_budget_positive'):
        op.drop_constraint(name, 'project_phases', type_='check')
    for col in ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget'):
        op.drop_column('project_phases', col)
    op.create_check_constraint('check_capital_budget_positive', 'project_phases', 'capital_budget >= 0')
    op.create_check_constraint('check_expense_budget_positive', 'project_phases', 'expense_budget >= 0')
    op.create_check_constraint('check_budget_sum', 'project_phases', 'capital_budget + expense_budget = total_budget')
```

- [ ] **Step 4: Run test + apply migration to verify it passes**

```bash
docker exec planner-app python -m pytest tests/integration/test_migration_phase_budget.py -q
docker exec planner-app alembic upgrade head
docker exec planner-app python -c "from app.db.session import SessionLocal; from app.models.project import ProjectPhase; s=SessionLocal(); [print(p.total_budget, p.capital_budget, p.expense_budget) for p in s.query(ProjectPhase).limit(3)]"
```
Expected: test PASS; `alembic upgrade head` runs without error and prints the migration line; per-phase capital+expense == total.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/*phase_labor_nonlabor_budget*.py backend/tests/integration/test_migration_phase_budget.py
git commit -m "feat(migration): backfill phase budgets into labor columns, add non-labor columns"
```

### Task 3: Phase schemas — four budget fields

**Files:**
- Modify: `backend/app/schemas/phase.py` (`PhaseBase`, `PhaseBatchItem`, `PhaseResponse`)
- Test: `backend/tests/unit/test_phase_schema_budget_split.py` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `PhaseBase`/`PhaseBatchItem` fields `labor_capital_budget`, `labor_expense_budget`, `nonlabor_capital_budget`, `nonlabor_expense_budget` (`Decimal`, `ge=0`, default 0) with a validator enforcing their sum == `total_budget`; `PhaseResponse` additionally exposes derived `capital_budget`, `expense_budget`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_phase_schema_budget_split.py
from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.schemas.phase import PhaseBatchItem


def test_batch_item_accepts_four_way_split():
    item = PhaseBatchItem(
        id=None, name="Ph", start_date="2026-01-01", end_date="2026-06-30",
        labor_capital_budget=Decimal("100"), labor_expense_budget=Decimal("50"),
        nonlabor_capital_budget=Decimal("30"), nonlabor_expense_budget=Decimal("20"),
        total_budget=Decimal("200"),
    )
    assert item.total_budget == Decimal("200")


def test_batch_item_rejects_bad_sum():
    with pytest.raises(ValidationError):
        PhaseBatchItem(
            id=None, name="Ph", start_date="2026-01-01", end_date="2026-06-30",
            labor_capital_budget=Decimal("100"), labor_expense_budget=Decimal("50"),
            nonlabor_capital_budget=Decimal("30"), nonlabor_expense_budget=Decimal("20"),
            total_budget=Decimal("999"),
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/unit/test_phase_schema_budget_split.py -q`
Expected: FAIL — unexpected keyword / validation not enforced.

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/phase.py`, in `PhaseBase` replace `capital_budget`/`expense_budget` fields with the four fields and rewrite the total validator:

```python
    labor_capital_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Labor capital budget")
    labor_expense_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Labor expense budget")
    nonlabor_capital_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Non-labor capital budget")
    nonlabor_expense_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Non-labor expense budget")
    total_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Total budget")

    @field_validator('total_budget')
    @classmethod
    def validate_total_budget(cls, v, info):
        keys = ('labor_capital_budget', 'labor_expense_budget',
                'nonlabor_capital_budget', 'nonlabor_expense_budget')
        if all(k in info.data for k in keys):
            expected = sum(info.data[k] for k in keys)
            if v != expected:
                raise ValueError(f'Total budget must equal the four category budgets ({expected})')
        return v
```

Apply the **same** four fields + validator to `PhaseBatchItem` (it duplicates the shape today). In `PhaseResponse`, add derived read-only fields:

```python
    capital_budget: Decimal = Field(default=Decimal("0"), description="Derived: labor+nonlabor capital")
    expense_budget: Decimal = Field(default=Decimal("0"), description="Derived: labor+nonlabor expense")
```

(These populate from the model hybrids via `model_validate`.) Update the `PhaseBase.model_config` example and `PhaseBatchUpdate` examples to use the four keys.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/unit/test_phase_schema_budget_split.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/phase.py backend/tests/unit/test_phase_schema_budget_split.py
git commit -m "feat(schema): four-way budget fields on phase schemas"
```

### Task 4: Phase service + batch endpoint — persist four budget fields

**Files:**
- Modify: `backend/app/services/phase_service.py` (`update_project_phases`, `create_phase`, `update_phase`, `create_default_phase`)
- Modify: `backend/app/api/v1/endpoints/phases.py:145-157` (batch dict mapping)
- Test: `backend/tests/integration/test_phase_batch_budget_split.py` (create)

**Interfaces:**
- Consumes: Task 1 model, Task 3 schemas.
- Produces: batch update that reads/writes the four budget fields; budget-sum validation over the four; `create_default_phase` sets all four to 0.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_phase_batch_budget_split.py
from decimal import Decimal
from datetime import date
from app.services.phase_service import phase_service
from app.models.project import Project


def _project(db):
    p = Project(program_id=None, name="P", business_sponsor="s", project_manager="m",
                technical_lead="t", start_date=date(2026,1,1), end_date=date(2026,12,31),
                cost_center_code="CC-BATCH-SPLIT")
    db.add(p); db.flush(); return p


def test_batch_update_persists_four_budget_fields(db_session):
    project = _project(db_session)
    phases = [{
        "id": None, "name": "Only", "start_date": date(2026,1,1), "end_date": date(2026,12,31),
        "description": None,
        "labor_capital_budget": Decimal("100"), "labor_expense_budget": Decimal("50"),
        "nonlabor_capital_budget": Decimal("30"), "nonlabor_expense_budget": Decimal("20"),
        "total_budget": Decimal("200"),
    }]
    result = phase_service.update_project_phases(db_session, project.id, phases)
    assert len(result) == 1
    p = result[0]
    assert p.labor_capital_budget == Decimal("100")
    assert p.nonlabor_expense_budget == Decimal("20")
    assert p.capital_budget == Decimal("130")   # derived hybrid
    assert p.total_budget == Decimal("200")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_phase_batch_budget_split.py -q`
Expected: FAIL — `TypeError` on unknown budget kwargs / build uses `capital_budget`.

- [ ] **Step 3: Write minimal implementation**

In `phase_service.update_project_phases`, replace the budget extraction/validation and both create/update dicts:

```python
            lc = phase_data.get('labor_capital_budget', Decimal("0"))
            le = phase_data.get('labor_expense_budget', Decimal("0"))
            nc = phase_data.get('nonlabor_capital_budget', Decimal("0"))
            ne = phase_data.get('nonlabor_expense_budget', Decimal("0"))
            total = phase_data.get('total_budget', lc + le + nc + ne)
            if lc + le + nc + ne != total:
                raise ValidationError(
                    code="INVALID_BUDGET",
                    message=f"Total budget must equal the four category budgets for phase '{phase_data.get('name')}'",
                    details={"labor_capital": lc, "labor_expense": le,
                             "nonlabor_capital": nc, "nonlabor_expense": ne, "total": total})
```

Use these keys in both the create and update dicts:

```python
                    "labor_capital_budget": lc, "labor_expense_budget": le,
                    "nonlabor_capital_budget": nc, "nonlabor_expense_budget": ne,
                    "total_budget": total,
```

Update `create_phase`, `update_phase`, and `create_default_phase` analogously (replace `capital`/`expense` params + dict keys with the four; `create_default_phase` sets all four to `Decimal("0")`). In `phases.py:145-157`, map the four fields:

```python
        phases_data = [
            {
                "id": phase.id, "name": phase.name,
                "start_date": phase.start_date, "end_date": phase.end_date,
                "description": phase.description,
                "labor_capital_budget": phase.labor_capital_budget,
                "labor_expense_budget": phase.labor_expense_budget,
                "nonlabor_capital_budget": phase.nonlabor_capital_budget,
                "nonlabor_expense_budget": phase.nonlabor_expense_budget,
                "total_budget": phase.total_budget,
            }
            for phase in batch_data.phases
        ]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker exec planner-app python -m pytest tests/integration/test_phase_batch_budget_split.py backend/tests/unit/test_project_phase_budget_split.py -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/phase_service.py backend/app/api/v1/endpoints/phases.py backend/tests/integration/test_phase_batch_budget_split.py
git commit -m "feat(phases): persist four-way budgets through service and batch endpoint"
```

---

## PHASE B — Actual model (resource_id classifier)

### Task 5: `Actual` model — add `resource_id`, nullable labor cols, drop `resource_assignment_id`

**Files:**
- Modify: `backend/app/models/actual.py`
- Modify: `backend/app/models/resource_assignment.py:48` (remove `actuals` relationship)
- Test: `backend/tests/unit/test_actual_resource_id.py` (create)

**Interfaces:**
- Produces: `Actual.resource_id` (non-null FK → `resources.id`), `Actual.resource` relationship; `external_worker_id`/`worker_name`/`allocation_percentage` nullable; `resource_assignment_id` removed.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_actual_resource_id.py
from app.models.actual import Actual

def test_actual_has_resource_id_and_no_assignment_id():
    cols = Actual.__table__.columns.keys()
    assert "resource_id" in cols
    assert "resource_assignment_id" not in cols

def test_labor_columns_are_nullable():
    assert Actual.__table__.columns["external_worker_id"].nullable is True
    assert Actual.__table__.columns["worker_name"].nullable is True
    assert Actual.__table__.columns["allocation_percentage"].nullable is True
    assert Actual.__table__.columns["resource_id"].nullable is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/unit/test_actual_resource_id.py -q`
Expected: FAIL — `resource_id` missing, `resource_assignment_id` present.

- [ ] **Step 3: Write minimal implementation**

In `backend/app/models/actual.py`: add `resource_id`, drop `resource_assignment_id`, make three columns nullable, swap the relationship:

```python
    resource_id = Column(GUID(), ForeignKey("resources.id"), nullable=False, index=True)
    # (resource_assignment_id removed)
    external_worker_id = Column(String(100), nullable=True, index=True)
    worker_name = Column(String(255), nullable=True)
    actual_date = Column(Date, nullable=False, index=True)
    allocation_percentage = Column(Numeric(5, 2), nullable=True)
    actual_cost = Column(Numeric(15, 2), nullable=False)
    capital_amount = Column(Numeric(15, 2), nullable=False)
    expense_amount = Column(Numeric(15, 2), nullable=False)

    project = relationship("Project", back_populates="actuals")
    resource = relationship("Resource")
```

Update the allocation CheckConstraint to tolerate NULL (SQL `CHECK` passes on NULL, but keep the range guard):

```python
        CheckConstraint('allocation_percentage IS NULL OR (allocation_percentage >= 0 AND allocation_percentage <= 100)', name='check_actual_allocation_percentage'),
```

In `backend/app/models/resource_assignment.py`, remove the line:

```python
    actuals = relationship("Actual", back_populates="resource_assignment", cascade="all, delete-orphan")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/unit/test_actual_resource_id.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/actual.py backend/app/models/resource_assignment.py backend/tests/unit/test_actual_resource_id.py
git commit -m "feat(model): add Actual.resource_id classifier, drop resource_assignment_id, allow non-labor nulls"
```

### Task 6: Alembic migration — `Actual.resource_id` backfill

**Files:**
- Create: `backend/alembic/versions/<rev>_actual_resource_id.py`
- Test: `backend/tests/integration/test_migration_actual_resource_id.py` (create)

**Interfaces:**
- Consumes: Task 5 model.
- Produces: migration that adds+backfills `resource_id`, nullable-izes labor columns, drops `resource_assignment_id`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_migration_actual_resource_id.py
import glob, os

def test_actual_resource_id_migration_backfills_via_worker():
    matches = glob.glob(os.path.join(os.path.dirname(__file__), "..", "..",
        "alembic", "versions", "*actual_resource_id*.py"))
    assert matches, "actual resource_id migration not found"
    src = open(matches[0]).read()
    assert "resource_id" in src
    assert "workers" in src and "external_id" in src   # backfill path
    assert "resource_assignment_id" in src             # drop it
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_migration_actual_resource_id.py -q`
Expected: FAIL — file not found.

- [ ] **Step 3: Write minimal implementation**

Create `backend/alembic/versions/<REV>_actual_resource_id.py` with `down_revision` = the phase migration from Task 2:

```python
"""actual_resource_id

Add Actual.resource_id (labor/non-labor classifier), backfill from
external_worker_id -> workers -> resources (all existing actuals are labor),
make labor-only columns nullable, drop write-only resource_assignment_id.
"""
from alembic import op
import sqlalchemy as sa

revision = '<REV>'
down_revision = '<PHASE_MIGRATION_REV>'
branch_labels = None
depends_on = None


from app.models.base import GUID  # project's GUID column type (see existing GUID FK migrations)


def upgrade() -> None:
    conn = op.get_bind()
    op.add_column('actuals', sa.Column('resource_id', GUID(), nullable=True))
    conn.execute(sa.text("""
        UPDATE actuals SET resource_id = (
            SELECT r.id FROM resources r
            JOIN workers w ON r.worker_id = w.id
            WHERE w.external_id = actuals.external_worker_id
        )
    """))
    op.alter_column('actuals', 'resource_id', nullable=False)
    op.create_index('ix_actuals_resource_id', 'actuals', ['resource_id'])
    op.create_foreign_key('fk_actuals_resource_id', 'actuals', 'resources', ['resource_id'], ['id'])
    op.alter_column('actuals', 'external_worker_id', nullable=True)
    op.alter_column('actuals', 'worker_name', nullable=True)
    op.alter_column('actuals', 'allocation_percentage', nullable=True)
    op.drop_constraint('check_actual_allocation_percentage', 'actuals', type_='check')
    op.create_check_constraint('check_actual_allocation_percentage', 'actuals',
        'allocation_percentage IS NULL OR (allocation_percentage >= 0 AND allocation_percentage <= 100)')
    # drop write-only assignment link (FK name may vary; inspect if needed)
    try:
        op.drop_constraint('actuals_resource_assignment_id_fkey', 'actuals', type_='foreignkey')
    except Exception:
        pass
    op.drop_index('ix_actuals_resource_assignment_id', table_name='actuals')
    op.drop_column('actuals', 'resource_assignment_id')
    count = conn.execute(sa.text("SELECT COUNT(*) FROM actuals WHERE resource_id IS NULL")).scalar()
    if count:
        raise Exception(f"resource_id backfill failed: {count} actuals unresolved")
    print("actual resource_id migration complete.")


def downgrade() -> None:
    from app.models.base import GUID
    op.add_column('actuals', sa.Column('resource_assignment_id', GUID(), nullable=True))
    op.create_index('ix_actuals_resource_assignment_id', 'actuals', ['resource_assignment_id'])
    op.create_foreign_key('actuals_resource_assignment_id_fkey', 'actuals', 'resource_assignments', ['resource_assignment_id'], ['id'])
    op.alter_column('actuals', 'external_worker_id', nullable=False)
    op.alter_column('actuals', 'worker_name', nullable=False)
    op.alter_column('actuals', 'allocation_percentage', nullable=False)
    op.drop_constraint('fk_actuals_resource_id', 'actuals', type_='foreignkey')
    op.drop_index('ix_actuals_resource_id', table_name='actuals')
    op.drop_column('actuals', 'resource_id')
```

For the `resource_id` column type, use the project's `GUID` type: `from app.models.base import GUID` and `sa.Column('resource_id', GUID(), nullable=True)` (mirror how other GUID FKs appear in existing migrations — check `2654044250d3_link_labor_resources_to_workers.py` for the exact import/usage and copy it).

- [ ] **Step 4: Run test + apply migration to verify it passes**

```bash
docker exec planner-app python -m pytest tests/integration/test_migration_actual_resource_id.py -q
docker exec planner-app alembic upgrade head
docker exec planner-app python -c "from app.db.session import SessionLocal; from app.models.actual import Actual; s=SessionLocal(); print('null resource_id:', s.query(Actual).filter(Actual.resource_id==None).count())"
```
Expected: test PASS; upgrade succeeds; null resource_id count == 0.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/*actual_resource_id*.py backend/tests/integration/test_migration_actual_resource_id.py
git commit -m "feat(migration): backfill Actual.resource_id, drop resource_assignment_id"
```

### Task 7: `ActualsService` — labor & non-labor create paths

**Files:**
- Modify: `backend/app/services/actuals.py` (`create_actual`, `_calculate_cost`, add `create_nonlabor_actual`, `import_actuals_batch`)
- Test: `backend/tests/integration/test_actuals_service_split.py` (create)

**Interfaces:**
- Consumes: Task 5 model.
- Produces: `create_actual(...)` (labor) sets `resource_id` from worker→resource and splits by the worker's planned assignment for that date, raising `BusinessRuleViolationError` if none; new `create_nonlabor_actual(db, project_id, resource_id, actual_date, capital_amount, expense_amount) -> Actual`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_actuals_service_split.py
from decimal import Decimal
from datetime import date
import pytest
from app.services.actuals import actuals_service
from app.core.exceptions import BusinessRuleViolationError
# Assumes fixtures build: a project, a LABOR resource+worker with a rate, and a
# NON_LABOR resource. See conftest builders `make_labor_resource`, `make_nonlabor_resource`.


def test_labor_actual_splits_by_planned_assignment(db_session, labor_setup):
    ctx = labor_setup  # {project, worker, resource, assignment(date, cap%, exp%), rate}
    actual = actuals_service.create_actual(
        db=db_session, project_id=ctx.project.id,
        external_worker_id=ctx.worker.external_id, worker_name=ctx.worker.name,
        actual_date=ctx.assignment.assignment_date,
        allocation_percentage=Decimal("100.00"), validate_allocation=False)
    assert actual.resource_id == ctx.resource.id
    assert actual.capital_amount + actual.expense_amount == actual.actual_cost


def test_labor_actual_without_assignment_rejects(db_session, labor_setup_no_assignment):
    ctx = labor_setup_no_assignment
    with pytest.raises(BusinessRuleViolationError):
        actuals_service.create_actual(
            db=db_session, project_id=ctx.project.id,
            external_worker_id=ctx.worker.external_id, worker_name=ctx.worker.name,
            actual_date=date(2026, 3, 3), allocation_percentage=Decimal("50.00"),
            validate_allocation=False)


def test_nonlabor_actual_stores_dollars(db_session, nonlabor_setup):
    ctx = nonlabor_setup  # {project, resource(NON_LABOR)}
    actual = actuals_service.create_nonlabor_actual(
        db=db_session, project_id=ctx.project.id, resource_id=ctx.resource.id,
        actual_date=date(2026, 3, 3), capital_amount=Decimal("400"), expense_amount=Decimal("100"))
    assert actual.resource_id == ctx.resource.id
    assert actual.external_worker_id is None
    assert actual.allocation_percentage is None
    assert actual.actual_cost == Decimal("500")
```

(If the referenced fixtures don't exist yet, add `labor_setup`, `labor_setup_no_assignment`, `nonlabor_setup` to `backend/tests/conftest.py` as small builders that create the described rows — a Project, a Worker+LABOR Resource with a Rate and optionally a ResourceAssignment on a date with `capital_percentage`/`expense_percentage`, and a NON_LABOR Resource.)

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_actuals_service_split.py -q`
Expected: FAIL — `create_nonlabor_actual` missing; labor path still sets `resource_assignment_id`.

- [ ] **Step 3: Write minimal implementation**

In `actuals.py`, rewrite `_calculate_cost` to resolve the worker's resource + planned assignment and reject when absent, and drop `resource_assignment_id`:

```python
    def _calculate_cost(self, db, worker, project_id, actual_date, allocation_percentage):
        from app.repositories.resource import resource_repository
        rate = rate_repository.get_active_rate(db=db, worker_type_id=worker.worker_type_id, as_of_date=actual_date)
        if not rate:
            raise RateNotFoundError(worker.worker_type_id, str(actual_date))
        resource = resource_repository.get_by_worker_id(db, worker.id)
        if not resource:
            raise BusinessRuleViolationError(
                f"No resource linked to worker '{worker.external_id}'",
                rule_code="NO_RESOURCE_FOR_WORKER", details={"worker_id": str(worker.id)})
        # planned assignment for this resource on this date supplies the cap/exp split
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        planned = next((a for a in assignments
                        if a.resource_id == resource.id and a.assignment_date == actual_date), None)
        if planned is None:
            raise BusinessRuleViolationError(
                f"No planned assignment for worker '{worker.external_id}' on {actual_date}; cannot split cost",
                rule_code="NO_PLANNED_ASSIGNMENT",
                details={"resource_id": str(resource.id), "date": str(actual_date)})
        actual_cost = ((rate.rate_amount * allocation_percentage) / Decimal('100.00')).quantize(Decimal('0.01'))
        total_pct = planned.capital_percentage + planned.expense_percentage
        if total_pct == 0:
            cap_ratio = Decimal('0'); exp_ratio = Decimal('0')
        else:
            cap_ratio = planned.capital_percentage / total_pct
            exp_ratio = planned.expense_percentage / total_pct
        capital_amount = (actual_cost * cap_ratio).quantize(Decimal('0.01'))
        expense_amount = actual_cost - capital_amount
        return {"actual_cost": actual_cost, "capital_amount": capital_amount,
                "expense_amount": expense_amount, "resource_id": resource.id}
```

In `create_actual`, set `resource_id` from `cost_data["resource_id"]` and remove the `resource_assignment_id` key from `actual_data`. Add:

```python
    def create_nonlabor_actual(self, db, project_id, resource_id, actual_date, capital_amount, expense_amount):
        project = project_repository.get(db, project_id)
        if not project:
            raise ProjectNotFoundError(project_id)
        from app.repositories.resource import resource_repository
        resource = resource_repository.get(db, resource_id)
        if not resource:
            raise ResourceNotFoundError("Resource", resource_id=resource_id)
        actual_data = {
            "project_id": project_id, "resource_id": resource_id,
            "external_worker_id": None, "worker_name": None,
            "actual_date": actual_date, "allocation_percentage": None,
            "actual_cost": capital_amount + expense_amount,
            "capital_amount": capital_amount, "expense_amount": expense_amount,
        }
        return actual_repository.create(db, obj_in=actual_data)
```

Add `get_by_worker_id` to `resource_repository` if absent (query `Resource.worker_id == worker_id`). Remove the `update_actual` recalculation's reliance on `resource_assignment_id` (it already only touches cost fields).

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_actuals_service_split.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/actuals.py backend/app/repositories/resource.py backend/tests/integration/test_actuals_service_split.py backend/tests/conftest.py
git commit -m "feat(actuals): labor split via planned assignment (reject if none) + non-labor dollar create"
```

---

## PHASE C — Split actuals import

### Task 8: Labor importer (percentage-based, optional cap%/exp% columns)

**Files:**
- Modify: `backend/app/services/actuals_import.py` (add `LaborActualsImportService` / labor-specific parse+validate)
- Test: `backend/tests/unit/test_labor_actuals_import.py` (create)

**Interfaces:**
- Produces: `labor_actuals_import_service.parse_csv(content) -> List[LaborImportRecord]` and `.validate_records(db, records)`; records carry either `percentage` or (`capital_percentage`,`expense_percentage`); a row with a non-labor resource id or missing worker id is invalid.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_labor_actuals_import.py
from app.services.actuals_import import labor_actuals_import_service as svc

CSV_SINGLE = "project_id,external_worker_id,worker_name,date,percentage\n" \
             "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,80\n"
CSV_SPLIT = "project_id,external_worker_id,worker_name,date,capital_percentage,expense_percentage\n" \
            "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,50,30\n"

def test_parse_single_percentage():
    recs = svc.parse_csv(CSV_SINGLE)
    assert len(recs) == 1
    assert recs[0].percentage_str == "80"

def test_parse_capital_expense_split():
    recs = svc.parse_csv(CSV_SPLIT)
    assert recs[0].capital_percentage_str == "50"
    assert recs[0].expense_percentage_str == "30"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/unit/test_labor_actuals_import.py -q`
Expected: FAIL — `labor_actuals_import_service` not defined.

- [ ] **Step 3: Write minimal implementation**

Add to `actuals_import.py` a `LaborImportRecord` (fields: row_number, project_id, external_worker_id, worker_name, date, optional percentage, optional capital_percentage, optional expense_percentage) and a `LaborActualsImportService` whose `parse_csv` accepts headers containing either `percentage` OR both `capital_percentage` and `expense_percentage` (reject if neither and not both-of-the-pair). Reuse the existing `_validate_record` project/worker/date checks; add: reject if a `resource_id` column is present/populated (that belongs to the non-labor importer). Export `labor_actuals_import_service = LaborActualsImportService()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/unit/test_labor_actuals_import.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/actuals_import.py backend/tests/unit/test_labor_actuals_import.py
git commit -m "feat(import): labor actuals importer with optional capital/expense percentage columns"
```

### Task 9: Non-labor importer (dollar-based)

**Files:**
- Modify: `backend/app/services/actuals_import.py` (add `NonLaborActualsImportService`)
- Test: `backend/tests/unit/test_nonlabor_actuals_import.py` (create)

**Interfaces:**
- Produces: `nonlabor_actuals_import_service.parse_csv(content) -> List[NonLaborImportRecord]` (columns `project_id,resource_id,date,capital,expense`) and `.validate_records(db, records)` verifying project + NON_LABOR resource exist and both dollar amounts parse (`>= 0`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_nonlabor_actuals_import.py
from app.services.actuals_import import nonlabor_actuals_import_service as svc

CSV = "project_id,resource_id,date,capital,expense\n" \
      "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,2026-03-03,400,100\n"

def test_parse_nonlabor_dollars():
    recs = svc.parse_csv(CSV)
    assert len(recs) == 1
    assert recs[0].capital_str == "400"
    assert recs[0].expense_str == "100"
    assert recs[0].resource_id_str == "22222222-2222-2222-2222-222222222222"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/unit/test_nonlabor_actuals_import.py -q`
Expected: FAIL — service not defined.

- [ ] **Step 3: Write minimal implementation**

Add `NonLaborImportRecord` (row_number, project_id, resource_id, date, capital, expense) and `NonLaborActualsImportService` with `REQUIRED_COLUMNS = ["project_id","resource_id","date","capital","expense"]`. `_validate_record`: project exists; resource exists and `resource_type == NON_LABOR` (else error "resource is not non-labor"); date parses; `capital`/`expense` parse as `Decimal >= 0`. Export `nonlabor_actuals_import_service = NonLaborActualsImportService()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/unit/test_nonlabor_actuals_import.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/actuals_import.py backend/tests/unit/test_nonlabor_actuals_import.py
git commit -m "feat(import): non-labor actuals importer (dollar-based)"
```

### Task 10: Two import endpoints + schemas

**Files:**
- Modify: `backend/app/schemas/actual.py` (add labor/non-labor import request rows if needed)
- Modify: `backend/app/api/v1/endpoints/actuals.py` (replace `/import` with `/import/labor` + `/import/non-labor`)
- Modify: `backend/app/services/actuals.py` (`import_labor_batch`, `import_nonlabor_batch`)
- Test: `backend/tests/integration/test_actuals_import_endpoints.py` (create)

**Interfaces:**
- Consumes: Tasks 7–9.
- Produces: `POST /api/v1/actuals/import/labor` and `POST /api/v1/actuals/import/non-labor`, both `multipart/form-data` CSV upload → `ActualImportResponse`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_actuals_import_endpoints.py
import io

def test_labor_import_endpoint(client, auth_headers, labor_setup):
    ctx = labor_setup
    csv = f"project_id,external_worker_id,worker_name,date,percentage\n" \
          f"{ctx.project.id},{ctx.worker.external_id},{ctx.worker.name},{ctx.assignment.assignment_date},100\n"
    r = client.post("/api/v1/actuals/import/labor", headers=auth_headers,
                    files={"file": ("a.csv", io.BytesIO(csv.encode()), "text/csv")})
    assert r.status_code == 200
    assert r.json()["successful_imports"] == 1

def test_nonlabor_import_endpoint(client, auth_headers, nonlabor_setup):
    ctx = nonlabor_setup
    csv = f"project_id,resource_id,date,capital,expense\n" \
          f"{ctx.project.id},{ctx.resource.id},2026-03-03,400,100\n"
    r = client.post("/api/v1/actuals/import/non-labor", headers=auth_headers,
                    files={"file": ("a.csv", io.BytesIO(csv.encode()), "text/csv")})
    assert r.status_code == 200
    assert r.json()["successful_imports"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_actuals_import_endpoints.py -q`
Expected: FAIL — 404 (routes don't exist).

- [ ] **Step 3: Write minimal implementation**

In `actuals.py` service add `import_labor_batch(db, records)` (calls `create_actual` per row, using cap%/exp% when present by calling a small helper that sets `capital_amount = rate×cap%`, `expense_amount = rate×exp%`, else the single-% assignment split from Task 7) and `import_nonlabor_batch(db, records)` (calls `create_nonlabor_actual`). Both mirror the existing `import_actuals_batch` transaction/rollback/result shape. In the endpoints file, replace the single `/import` route with `/import/labor` (uses `labor_actuals_import_service` + `import_labor_batch`) and `/import/non-labor` (uses `nonlabor_actuals_import_service` + `import_nonlabor_batch`), each returning `ActualImportResponse` exactly as the old route built it.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_actuals_import_endpoints.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/actuals.py backend/app/services/actuals.py backend/app/schemas/actual.py backend/tests/integration/test_actuals_import_endpoints.py
git commit -m "feat(import): split actuals import into labor and non-labor endpoints"
```

---

## PHASE D — Forecast, financial API, and aggregation

### Task 11: `ForecastData` 4-way + `to_dict` + assignment-cost typing

**Files:**
- Modify: `backend/app/services/forecasting.py` (`ForecastData.__init__`/`to_dict`, `_calculate_assignment_cost`, `calculate_project_forecast`, `calculate_program_forecast`)
- Test: `backend/tests/integration/test_forecast_four_way.py` (create)

**Interfaces:**
- Consumes: Tasks 1, 5.
- Produces: `ForecastData` holding, for each of budget/actual/forecast, `labor_capital`, `labor_expense`, `nonlabor_capital`, `nonlabor_expense`; `to_dict()` emits 7 keys per series (existing 3 + new 4); `_calculate_assignment_cost` returns `(cost, resource_type)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_forecast_four_way.py
from app.services.forecasting import forecasting_service

def test_to_dict_has_seven_keys_per_series(db_session, project_with_phase_budget):
    fd = forecasting_service.calculate_project_forecast(db_session, project_with_phase_budget.id)
    d = fd.to_dict()
    for series in ("budget", "actual", "forecast"):
        for key in ("total","capital","expense","labor_capital","labor_expense","nonlabor_capital","nonlabor_expense"):
            assert key in d[series], f"{series}.{key} missing"
        # labor+nonlabor sub-fields reconcile to capital/expense
        assert d[series]["capital"] == d[series]["labor_capital"] + d[series]["nonlabor_capital"]
        assert d[series]["expense"] == d[series]["labor_expense"] + d[series]["nonlabor_expense"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_forecast_four_way.py -q`
Expected: FAIL — `KeyError: 'labor_capital'`.

- [ ] **Step 3: Write minimal implementation**

Extend `ForecastData.__init__` with 12 new params (`*_labor_capital`, `*_labor_expense`, `*_nonlabor_capital`, `*_nonlabor_expense` for budget/actual/forecast), store them, and add them to each series dict in `to_dict()` (keeping `total/capital/expense`). Change `_calculate_assignment_cost` to `return (cost, resource.resource_type)` (both success paths and the default-rate path). In `calculate_project_forecast`:
- Budget 4-way = sums of the four phase columns (single-phase: from the phase; all-phases: `sum(p.labor_capital_budget ...)`).
- Actual 4-way: iterate `actuals`, route `a.capital_amount`/`a.expense_amount` by `a.resource.resource_type` (`LABOR` → labor buckets, else non-labor).
- Forecast 4-way: for each future assignment, unpack `(cost, rtype)`; route `capital_portion`/`expense_portion` by `rtype`.
Pass all 12 into `ForecastData`. Update `calculate_program_forecast` to also accumulate the four new keys per series. Update `calculate_phase_forecast`/`calculate_phase_cost` similarly only if they build `ForecastData` (they return plain dicts — leave capital/expense there, but if desired add labor/nonlabor; not required by this task's test).

**Portfolio-extensibility requirement:** keep the four-way accumulation on `ForecastData` and inside the generic per-series summation loop of `calculate_program_forecast` — do NOT hardcode a two-level assumption. This is what lets a future `calculate_portfolio_forecast` reuse the exact same summation (looping `portfolio.programs`) with zero rework. The hierarchy is uniform (`Portfolio → programs → projects`).

- [ ] **Step 4: Run test to verify it passes**

```bash
docker exec planner-app python -m pytest tests/integration/test_forecast_four_way.py -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/forecasting.py backend/tests/integration/test_forecast_four_way.py
git commit -m "feat(forecast): four-way labor/non-labor breakdown per series in ForecastData.to_dict"
```

### Task 12: Reporting aggregation + variance labor-only guard

**Files:**
- Modify: `backend/app/services/reporting.py` (`get_multi_project_report` 4-way accumulation)
- Modify: `backend/app/services/variance_analysis.py` (`analyze_project_variance`, `compare_actual_vs_forecast`: filter labor actuals)
- Test: `backend/tests/integration/test_reporting_and_variance_split.py` (create)

**Interfaces:**
- Consumes: Task 11.
- Produces: multi-project report emitting the four keys per series; variance analysis ignores non-labor actuals (those with `external_worker_id IS NULL`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_reporting_and_variance_split.py
from datetime import date
from app.services.reporting import reporting_service
from app.services.variance_analysis import variance_analysis_service

def test_multi_project_report_has_four_way(db_session, program_with_projects):
    rep = reporting_service.get_multi_project_report(
        db=db_session, project_ids=[p.id for p in program_with_projects.projects])
    for series in ("budget","actual","forecast"):
        for key in ("labor_capital","labor_expense","nonlabor_capital","nonlabor_expense"):
            assert key in rep["aggregated_summary"][series]

def test_variance_ignores_nonlabor_actuals(db_session, project_with_nonlabor_actual):
    # a non-labor actual has NULL external_worker_id and must not crash allocation math
    result = variance_analysis_service.get_variance_summary(
        db=db_session, project_id=project_with_nonlabor_actual.id,
        start_date=date(2026,1,1), end_date=date(2026,12,31))
    assert "summary" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_reporting_and_variance_split.py -q`
Expected: FAIL — missing keys / `TypeError` summing `None` allocation.

- [ ] **Step 3: Write minimal implementation**

In `reporting.get_multi_project_report`, add four running totals per series (`total_labor_capital_*` etc.), accumulate from each project's `financial[series]["labor_capital"]` ... , and include them in the returned `financial[series]` dicts. In `variance_analysis.analyze_project_variance` and `compare_actual_vs_forecast`, right after fetching actuals add:

```python
        actuals = [a for a in actuals if a.external_worker_id]  # labor only; non-labor has no allocation %
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker exec planner-app python -m pytest tests/integration/test_reporting_and_variance_split.py -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/reporting.py backend/app/services/variance_analysis.py backend/tests/integration/test_reporting_and_variance_split.py
git commit -m "feat(reporting): four-way aggregation; variance analysis skips non-labor actuals"
```

---

## PHASE E — Frontend

### Task 13: `CategoryBreakdown` 4-way + toggle-aware `transformForecastData`

**Files:**
- Modify: `frontend/src/api/forecast.ts` (`CategoryBreakdown`)
- Modify: `frontend/src/utils/forecastTransform.ts`
- Test: `frontend/src/utils/forecastTransform.test.ts` (extend)

**Interfaces:**
- Produces: `CategoryBreakdown` gains `labor_capital`, `labor_expense`, `nonlabor_capital`, `nonlabor_expense` (numbers); `transformForecastData(apiResponse, options?: { laborOn: boolean; nonlaborOn: boolean }) -> FinancialTableData` where default is both true; capital/expense/total per series computed from toggles.

- [ ] **Step 1: Write the failing test**

```typescript
// append to frontend/src/utils/forecastTransform.test.ts
import { transformForecastData } from './forecastTransform'

const resp = {
  entity_id: 'x', entity_name: 'x', entity_type: 'project' as const,
  budget:   { total: 200, capital: 130, expense: 70, labor_capital: 100, labor_expense: 50, nonlabor_capital: 30, nonlabor_expense: 20 },
  actual:   { total: 0, capital: 0, expense: 0, labor_capital: 0, labor_expense: 0, nonlabor_capital: 0, nonlabor_expense: 0 },
  forecast: { total: 0, capital: 0, expense: 0, labor_capital: 0, labor_expense: 0, nonlabor_capital: 0, nonlabor_expense: 0 },
  analysis: { budget_remaining: 0, forecast_variance: 0, budget_utilization_percentage: 0, forecast_to_budget_percentage: 0 },
}

test('both toggles on = full totals', () => {
  const d = transformForecastData(resp, { laborOn: true, nonlaborOn: true })
  expect(d.budget.capital).toBe(130); expect(d.budget.expense).toBe(70); expect(d.budget.total).toBe(200)
})

test('labor only', () => {
  const d = transformForecastData(resp, { laborOn: true, nonlaborOn: false })
  expect(d.budget.capital).toBe(100); expect(d.budget.expense).toBe(50); expect(d.budget.total).toBe(150)
})

test('non-labor only', () => {
  const d = transformForecastData(resp, { laborOn: false, nonlaborOn: true })
  expect(d.budget.capital).toBe(30); expect(d.budget.expense).toBe(20); expect(d.budget.total).toBe(50)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/forecastTransform.test.ts`
Expected: FAIL — options arg ignored / type error on new fields.

- [ ] **Step 3: Write minimal implementation**

In `forecast.ts`, extend `CategoryBreakdown`:

```typescript
export interface CategoryBreakdown {
  total: number
  capital: number
  expense: number
  labor_capital: number
  labor_expense: number
  nonlabor_capital: number
  nonlabor_expense: number
}
```

In `forecastTransform.ts`:

```typescript
export interface LaborToggle { laborOn: boolean; nonlaborOn: boolean }

function applyToggle(b: CategoryBreakdown, t: LaborToggle): CategoryBreakdown {
  const capital = (t.laborOn ? b.labor_capital : 0) + (t.nonlaborOn ? b.nonlabor_capital : 0)
  const expense = (t.laborOn ? b.labor_expense : 0) + (t.nonlaborOn ? b.nonlabor_expense : 0)
  return { ...b, capital, expense, total: capital + expense }
}

export function transformForecastData(
  apiResponse: ForecastApiResponse,
  options: LaborToggle = { laborOn: true, nonlaborOn: true },
): FinancialTableData {
  const budget = applyToggle(apiResponse.budget, options)
  const actual = applyToggle(apiResponse.actual, options)
  const forecast = applyToggle(apiResponse.forecast, options)
  const currentForecast: CategoryBreakdown = {
    ...actual,
    total: actual.total + forecast.total,
    capital: actual.capital + forecast.capital,
    expense: actual.expense + forecast.expense,
  }
  const variance: CategoryBreakdown = {
    ...budget,
    total: budget.total - currentForecast.total,
    capital: budget.capital - currentForecast.capital,
    expense: budget.expense - currentForecast.expense,
  }
  return { budget, actuals: actual, forecast, currentForecast, variance }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/forecastTransform.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/forecast.ts frontend/src/utils/forecastTransform.ts frontend/src/utils/forecastTransform.test.ts
git commit -m "feat(fe): four-way CategoryBreakdown and labor/non-labor toggle in transformForecastData"
```

### Task 14: Phase editor UI — four budget inputs, two-row header, read-only total

**Files:**
- Modify: `frontend/src/types/index.ts` (`ProjectPhase`)
- Modify: `frontend/src/api/phases.ts` (request/response budget fields)
- Modify: `frontend/src/components/phases/PhaseList.tsx`
- Modify: `frontend/src/components/phases/PhaseEditor.tsx` (`handleAddPhase`, `handleSave`)
- Test: `frontend/src/components/phases/PhaseList.budget-split.test.tsx` (create)

**Interfaces:**
- Consumes: Task 3/4 API shape.
- Produces: `ProjectPhase` gains `labor_capital_budget`, `labor_expense_budget`, `nonlabor_capital_budget`, `nonlabor_expense_budget`; PhaseList renders 4 editable inputs under a two-row `Labor Budget | Non-Labor Budget` header with a read-only Total; PhaseEditor sends the four fields in the batch payload.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/phases/PhaseList.budget-split.test.tsx
import { render, screen } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1', project_id: 'x', name: 'Ph', start_date: '2026-01-01', end_date: '2026-06-30',
  description: '', labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}

test('renders labor and non-labor budget headers', () => {
  render(<PhaseList phases={[phase as any]} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('Labor Budget')).toBeInTheDocument()
  expect(screen.getByText('Non-Labor Budget')).toBeInTheDocument()
})

test('total column shows sum of four category budgets', () => {
  render(<PhaseList phases={[phase as any]} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('$200.00')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/phases/PhaseList.budget-split.test.tsx`
Expected: FAIL — "Labor Budget" not found.

- [ ] **Step 3: Write minimal implementation**

- `types/index.ts`: on `ProjectPhase`, replace `capital_budget`/`expense_budget` with the four `*_budget: number` fields (keep `total_budget`; optionally keep `capital_budget?`/`expense_budget?` as optional derived reads).
- `phases.ts`: replace `capital_budget`/`expense_budget` with the four fields in `PhaseCreateRequest`, `PhaseUpdateRequest`, `PhaseBatchItem`.
- `PhaseList.tsx`: change the section title to **"Project Phases and Budget"**; replace the single header row's `Capital Budget`/`Expense Budget` cells with a **two-row `TableHead`**: top row has `Name/Description/Start/End` (rowSpan 2), a `Labor Budget` cell (colSpan 2), a `Non-Labor Budget` cell (colSpan 2), `Total` (rowSpan 2), `Actions` (rowSpan 2); second row has four `Capital | Expense | Capital | Expense` cells. Render four numeric inputs per phase bound to the four fields (mirror the existing capital/expense input cells). The Total cell is read-only = `toNumber(labor_capital)+toNumber(labor_expense)+toNumber(nonlabor_capital)+toNumber(nonlabor_expense)`. Update `totals` reducer to sum all four + grand total, and the totals row to show them.
- `PhaseEditor.tsx`: in `handleAddPhase`, initialize new phases with the four `*_budget: 0` fields (drop `capital_budget`/`expense_budget`). In `handleSave`, map the four fields into `phasesData` and compute `total_budget` as their sum.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/phases/PhaseList.budget-split.test.tsx`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/phases.ts frontend/src/components/phases/PhaseList.tsx frontend/src/components/phases/PhaseEditor.tsx frontend/src/components/phases/PhaseList.budget-split.test.tsx
git commit -m "feat(fe): four budget inputs with labor/non-labor two-row header in phase editor"
```

### Task 15: Labor/Non-Labor chart+table toggle on project & program detail

**Files:**
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx`
- Modify: `frontend/src/pages/programs/ProgramDetailPage.tsx`
- Test: `frontend/src/pages/projects/ProjectDetailPage.toggle.test.tsx` (create)

**Interfaces:**
- Consumes: Task 13 transform.
- Produces: two `Switch`es (Labor / Non-Labor) above the financial panel; toggle state feeds `transformForecastData(data, { laborOn, nonlaborOn })`; turning off the last-on switch flips the other on (never both off); default both on.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/projects/ProjectDetailPage.toggle.test.tsx
// Focused unit test of the guard helper extracted from the page.
import { nextToggleState } from './laborToggle'

test('turning off the last-on toggle flips the other on', () => {
  // start both on, turn labor off -> nonlabor stays on
  expect(nextToggleState({ laborOn: true, nonlaborOn: true }, 'labor')).toEqual({ laborOn: false, nonlaborOn: true })
  // only nonlabor on, turn nonlabor off -> labor forced on
  expect(nextToggleState({ laborOn: false, nonlaborOn: true }, 'nonlabor')).toEqual({ laborOn: true, nonlaborOn: false })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/projects/ProjectDetailPage.toggle.test.tsx`
Expected: FAIL — `./laborToggle` not found.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/pages/projects/laborToggle.ts`:

```typescript
import { LaborToggle } from '../../utils/forecastTransform'

export function nextToggleState(cur: LaborToggle, which: 'labor' | 'nonlabor'): LaborToggle {
  const next = which === 'labor' ? { ...cur, laborOn: !cur.laborOn } : { ...cur, nonlaborOn: !cur.nonlaborOn }
  if (!next.laborOn && !next.nonlaborOn) {
    // never both off: force the other one on
    return which === 'labor' ? { laborOn: false, nonlaborOn: true } : { laborOn: true, nonlaborOn: false }
  }
  return next
}
```

In `ProjectDetailPage.tsx`: add `const [toggle, setToggle] = useState({ laborOn: true, nonlaborOn: true })`; include `toggle` in the forecast `queryKey`; call `transformForecastData(data, toggle)` in the `queryFn`; render two MUI `Switch`es (labels "Labor"/"Non-Labor") above `FinancialSummaryTable`, wired to `setToggle(nextToggleState(toggle, 'labor'|'nonlabor'))`. Do the same in `ProgramDetailPage.tsx` (import `nextToggleState` from the projects module or duplicate a tiny local copy — prefer a shared import).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/projects/ProjectDetailPage.toggle.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/projects/laborToggle.ts frontend/src/pages/projects/ProjectDetailPage.tsx frontend/src/pages/programs/ProgramDetailPage.tsx frontend/src/pages/projects/ProjectDetailPage.toggle.test.tsx
git commit -m "feat(fe): labor/non-labor toggle on project and program financial panels"
```

---

## Final verification (after all tasks)

- [ ] Backend suites: `docker exec planner-app python -m pytest tests/unit/test_project_phase_budget_split.py tests/unit/test_actual_resource_id.py tests/unit/test_labor_actuals_import.py tests/unit/test_nonlabor_actuals_import.py tests/integration/test_phase_batch_budget_split.py tests/integration/test_actuals_service_split.py tests/integration/test_actuals_import_endpoints.py tests/integration/test_forecast_four_way.py tests/integration/test_reporting_and_variance_split.py -q` — all green.
- [ ] Migrations: `docker exec planner-app alembic upgrade head` clean; spot-check a phase's `capital_budget == labor_capital_budget + nonlabor_capital_budget` and `actuals` all have `resource_id`.
- [ ] Frontend: `cd frontend && npx vitest run src/utils/forecastTransform.test.ts src/components/phases/PhaseList.budget-split.test.tsx src/pages/projects/ProjectDetailPage.toggle.test.tsx` — green; `npx tsc --noEmit` delta clean.
- [ ] Drive the app once: edit a phase's four budgets and save; confirm the financial panel's Labor/Non-Labor toggles change the table + charts; import one labor CSV and one non-labor CSV.
- [ ] Regression: re-run the pre-existing suites named in the `test-repair-backlog` memory and confirm no NEW failures beyond that documented debt.

## Self-review notes (author)

- **Spec coverage:** §4 model → Tasks 1,5; §5 migrations → Tasks 2,6; §6 import split → Tasks 8,9,10; §7 forecast/API → Tasks 11,12; §8 phase UI → Task 14; §9 chart toggle → Tasks 13,15. Risk §11.1 (nullable allocation) → Task 12 guard. Risk §11.2 (drop assignment id) → Tasks 5,7.
- **Portfolio dashboard** (design §9 note) is intentionally excluded — no portfolio financial panel exists to host a toggle; flagged for the user, not silently dropped.
- **Type consistency:** column names `*_budget`, series keys `labor_capital`/`labor_expense`/`nonlabor_capital`/`nonlabor_expense`, and `LaborToggle { laborOn, nonlaborOn }` are used identically across backend, API, and all frontend tasks.
