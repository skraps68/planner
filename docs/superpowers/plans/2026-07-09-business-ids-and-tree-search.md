# Business IDs + Hierarchy Tree Search/Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9-digit typed business IDs (config-table-driven, auto-generated, backfilled) to portfolios/programs/projects across DB→API→UI, and give the hierarchy tree a search field with honest filtered rendering, a `#` ID-mode toggle, and a collapse-to-rail control.

**Architecture:** A `business_id_config` table (one row per entity type: base_id + next_sequence) feeds an allocator called inside the three entity create paths; an Alembic migration seeds config, backfills existing rows in `created_at` order, then tightens constraints. Frontend: `usePortfolioListState` gains a persisted `idMode`; HierarchyTree gains a header (search/`#`/collapse) and pruned-dimmed-highlighted filtering; PortfolioShell owns the collapsed-rail state; the rich list honors `idMode` for display and matching.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + Pydantic v2 (backend, Postgres in dev via docker-compose, SQLite in unit tests), React 18 + TS + MUI v5 + react-query (frontend), vitest + RTL, pytest.

**Spec:** `docs/superpowers/specs/2026-07-09-business-ids-and-tree-search-design.md`

## Global Constraints

- Branch: `business-ids` (already created, off `nav-redesign`).
- `business_id` is a **9-char string with leading zeros** end-to-end (DB `VARCHAR(9)`, Pydantic `str`, TS `string`). Never parse it to a number.
- Typed bases (stored as integers; leading zero comes from zero-padding): portfolio **10000000**, program **20000000**, project **30000000** → first IDs `010000001`, `020000001`, `030000001`.
- `business_id` is server-generated only: present in Response schemas, absent from Create/Update schemas.
- Backend commands: run inside the container — `docker-compose exec -T app <cmd>` from the repo root. Frontend commands from `frontend/`.
- Frontend gates: `npx tsc --noEmit` must add NO NEW errors in touched files (pre-existing baseline exists); `npx vitest run <file>` for tests.
- Backend gate: new tests must pass; do not try to fix the pre-existing broken backend suites (parked backlog), only avoid worsening them.
- Dev servers: vite :3000, API :8000 (login admin/admin123, token at `login.tokens.access_token`).
- **Sequencing hazard:** the dev API runs uvicorn `--reload` against the live Postgres. Once models gain the `business_id` column (Task 1), API queries on those tables 500 until the migration applies (Task 2). Do Tasks 1 and 2 back-to-back.

---

### Task 1: BusinessIdConfig model, business_id columns, allocator + unit tests

**Files:**
- Create: `backend/app/models/business_id.py`
- Create: `backend/app/services/business_id.py`
- Create: `backend/tests/unit/test_business_id.py`
- Modify: `backend/app/models/portfolio.py`, `backend/app/models/program.py`, `backend/app/models/project.py` (add one column each)
- Modify: `backend/app/models/__init__.py` (export BusinessIdConfig)

**Interfaces:**
- Produces (later tasks compile against these):
  - `BusinessIdConfig` model, table `business_id_config`, columns: `entity_type: str (PK)`, `base_id: int`, `next_sequence: int`.
  - `allocate_business_id(db: Session, entity_type: str) -> str` in `app.services.business_id` — returns the zero-padded 9-char ID and increments the sequence (flush, no commit; caller's transaction commits).
  - `Portfolio.business_id`, `Program.business_id`, `Project.business_id`: `Column(String(9), nullable=True, unique=True, index=True)` — **nullable in the model for now**; Task 2's migration backfills and the model stays nullable=True until then? No: models are also the source of truth for SQLite `create_all` in tests. Keep the column `nullable=True` in the model permanently (application code always populates it; the Postgres migration enforces NOT NULL at the DB level). This avoids breaking every existing SQLite-based test fixture that creates entities without business_id.

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests/unit/test_business_id.py` (self-contained SQLite fixture — do not depend on the shared conftest):

```python
"""Unit tests for the business-id allocator."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.business_id import BusinessIdConfig
from app.services.business_id import allocate_business_id


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    session.add_all([
        BusinessIdConfig(entity_type="portfolio", base_id=10000000, next_sequence=1),
        BusinessIdConfig(entity_type="program", base_id=20000000, next_sequence=1),
        BusinessIdConfig(entity_type="project", base_id=30000000, next_sequence=1),
    ])
    session.commit()
    yield session
    session.close()


def test_first_ids_are_typed_and_zero_padded(db):
    assert allocate_business_id(db, "portfolio") == "010000001"
    assert allocate_business_id(db, "program") == "020000001"
    assert allocate_business_id(db, "project") == "030000001"


def test_sequences_increment_independently(db):
    assert allocate_business_id(db, "portfolio") == "010000001"
    assert allocate_business_id(db, "portfolio") == "010000002"
    assert allocate_business_id(db, "program") == "020000001"
    assert allocate_business_id(db, "portfolio") == "010000003"


def test_result_is_string_of_length_nine(db):
    bid = allocate_business_id(db, "portfolio")
    assert isinstance(bid, str) and len(bid) == 9
    assert bid.startswith("0")  # leading zero preserved


def test_unknown_entity_type_raises(db):
    with pytest.raises(ValueError):
        allocate_business_id(db, "widget")


def test_base_change_affects_future_ids_only(db):
    first = allocate_business_id(db, "portfolio")
    cfg = db.query(BusinessIdConfig).filter_by(entity_type="portfolio").one()
    cfg.base_id = 90000000
    db.flush()
    second = allocate_business_id(db, "portfolio")
    assert first == "010000001"
    assert second == "090000002"  # new base + continuing sequence
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker-compose exec -T app pytest tests/unit/test_business_id.py -q --tb=short`
Expected: FAIL/ERROR — `ModuleNotFoundError: app.models.business_id`.

- [ ] **Step 3: Implement the model**

Create `backend/app/models/business_id.py`:

```python
"""Configurable base/sequence source for human-friendly business IDs."""
from sqlalchemy import Column, Integer, String

from app.models.base import Base


class BusinessIdConfig(Base):
    """One row per entity type; directly editable in the DB (no admin UI yet).

    business_id = zero_pad9(base_id + next_sequence). Changing base_id later
    affects only future IDs; per-table UNIQUE constraints are the safety net.
    """

    __tablename__ = "business_id_config"

    entity_type = Column(String(20), primary_key=True)  # portfolio|program|project
    base_id = Column(Integer, nullable=False)
    next_sequence = Column(Integer, nullable=False, default=1)
```

Note: check `app/models/base.py` — if the declarative base class is exported under a different name than `Base` (e.g. only `BaseModel` with id/timestamps), import the *bare declarative base* that `BaseModel` extends. `BusinessIdConfig` must NOT extend `BaseModel` (it needs no UUID id/version/timestamps). If the bare base isn't exported, export it from `app/models/base.py`.

Add to `backend/app/models/__init__.py` (follow the file's existing import style):

```python
from app.models.business_id import BusinessIdConfig
```

Add to each of `portfolio.py`, `program.py`, `project.py` models, alongside the other columns (import String already present in each):

```python
    # Human-friendly 9-digit typed ID (server-generated; leading zeros meaningful).
    # Nullable in the model so SQLite test fixtures that predate business IDs
    # still work; Postgres enforces NOT NULL via migration.
    business_id = Column(String(9), nullable=True, unique=True, index=True)
```

- [ ] **Step 4: Implement the allocator**

Create `backend/app/services/business_id.py`:

```python
"""Allocator for human-friendly 9-digit business IDs.

IDs are typed by range via business_id_config (portfolio 01…, program 02…,
project 03…). Allocation increments next_sequence inside the caller's
transaction; the per-table UNIQUE constraint on business_id is the collision
safety net.
"""
from sqlalchemy.orm import Session

from app.models.business_id import BusinessIdConfig

VALID_ENTITY_TYPES = ("portfolio", "program", "project")


def allocate_business_id(db: Session, entity_type: str) -> str:
    """Return the next zero-padded 9-char business id for entity_type.

    Flushes (does not commit) — the caller's transaction owns the commit, so
    the sequence increment and the entity INSERT succeed or fail together.
    """
    if entity_type not in VALID_ENTITY_TYPES:
        raise ValueError(f"Unknown business-id entity type: {entity_type}")

    config = (
        db.query(BusinessIdConfig)
        .filter(BusinessIdConfig.entity_type == entity_type)
        .with_for_update()  # row lock on Postgres; SQLite ignores it (single writer)
        .one()
    )
    business_id = str(config.base_id + config.next_sequence).zfill(9)
    config.next_sequence += 1
    db.flush()
    return business_id
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker-compose exec -T app pytest tests/unit/test_business_id.py -q --tb=short`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/business_id.py backend/app/services/business_id.py backend/tests/unit/test_business_id.py backend/app/models/portfolio.py backend/app/models/program.py backend/app/models/project.py backend/app/models/__init__.py
git commit -m "feat: business-id config model, entity columns, and allocator"
```

**⚠️ The dev API may now 500 on portfolio/program/project queries until Task 2's migration runs. Proceed to Task 2 immediately.**

---

### Task 2: Alembic migration — config seed, backfill, constraints — and apply

**Files:**
- Create: `backend/alembic/versions/<generated>_add_business_ids.py`

**Interfaces:**
- Consumes: bases 10000000/20000000/30000000; head revision is currently `35744cbabc7e` (verify with `docker-compose exec -T app alembic heads` and use whatever it prints as `down_revision`).
- Produces: dev DB where every portfolio/program/project row has a unique, typed, NOT NULL `business_id`, and `business_id_config` holds the three rows with advanced sequences.

- [ ] **Step 1: Write the migration**

Run `docker-compose exec -T app alembic revision -m "add business ids"` to generate the file (it lands in `backend/alembic/versions/` on the host via the volume mount), then replace its body:

```python
"""add business ids

Revision ID: <keep generated>
Revises: 35744cbabc7e
Create Date: <keep generated>
"""
import sqlalchemy as sa
from alembic import op

revision = "<keep generated>"
down_revision = "35744cbabc7e"
branch_labels = None
depends_on = None

BASES = {"portfolio": 10000000, "program": 20000000, "project": 30000000}
TABLES = {"portfolio": "portfolios", "program": "programs", "project": "projects"}


def upgrade() -> None:
    # 1. Config table + seed
    op.create_table(
        "business_id_config",
        sa.Column("entity_type", sa.String(20), primary_key=True),
        sa.Column("base_id", sa.Integer(), nullable=False),
        sa.Column("next_sequence", sa.Integer(), nullable=False, server_default="1"),
    )

    # 2. Nullable columns
    for table in TABLES.values():
        op.add_column(table, sa.Column("business_id", sa.String(9), nullable=True))

    # 3. Backfill in created_at order, per type, consuming the sequence
    conn = op.get_bind()
    for entity_type, table in TABLES.items():
        base = BASES[entity_type]
        rows = conn.execute(
            sa.text(f"SELECT id FROM {table} ORDER BY created_at, id")
        ).fetchall()
        seq = 1
        for (row_id,) in rows:
            conn.execute(
                sa.text(f"UPDATE {table} SET business_id = :bid WHERE id = :rid"),
                {"bid": str(base + seq).zfill(9), "rid": str(row_id)},
            )
            seq += 1
        conn.execute(
            sa.text(
                "INSERT INTO business_id_config (entity_type, base_id, next_sequence) "
                "VALUES (:t, :b, :s)"
            ),
            {"t": entity_type, "b": base, "s": seq},
        )

    # 4. Tighten: NOT NULL + unique index
    for table in TABLES.values():
        op.alter_column(table, "business_id", nullable=False)
        op.create_index(
            f"ix_{table}_business_id", table, ["business_id"], unique=True
        )


def downgrade() -> None:
    for table in TABLES.values():
        op.drop_index(f"ix_{table}_business_id", table_name=table)
        op.drop_column(table, "business_id")
    op.drop_table("business_id_config")
```

Note: the UPDATE binds `str(row_id)` because ids are UUIDs; Postgres casts the
string. If it errors with a uuid/text mismatch, change the WHERE to
`WHERE id = CAST(:rid AS uuid)`.

- [ ] **Step 2: Apply and verify**

```bash
docker-compose exec -T app alembic upgrade head
```

Verify against the dev DB:

```bash
docker-compose exec -T db psql -U postgres -d planner -c \
  "SELECT entity_type, base_id, next_sequence FROM business_id_config ORDER BY entity_type;"
docker-compose exec -T db psql -U postgres -d planner -c \
  "SELECT business_id, name FROM portfolios ORDER BY business_id LIMIT 3;"
docker-compose exec -T db psql -U postgres -d planner -c \
  "SELECT business_id, name FROM projects ORDER BY business_id LIMIT 3;"
```

Expected: three config rows with sequences advanced past the row counts; portfolios starting `010000001`; projects starting `030000001`.

- [ ] **Step 3: Confirm the API is healthy again**

```bash
curl -s http://localhost:8000/health
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens']['access_token'])")
curl -s "http://localhost:8000/api/v1/portfolios/?limit=1" -H "Authorization: Bearer $TOKEN" | head -c 300
```

Expected: healthy; portfolio list returns 200 (business_id not in the response yet — that's Task 3).

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: migration seeding business-id config and backfilling typed ids"
```

---

### Task 3: Wire allocator into create paths + expose in API responses

**Files:**
- Modify: `backend/app/services/portfolio.py` (create_portfolio, ~line 60 data dict)
- Modify: `backend/app/services/program.py` (create_program, ~line 68 data dict)
- Modify: `backend/app/services/project.py` (create_project, ~line 82 data dict)
- Modify: `backend/app/schemas/portfolio.py`, `backend/app/schemas/program.py`, `backend/app/schemas/project.py` (Response classes only)
- Create: `backend/tests/unit/test_business_id_creation.py`

**Interfaces:**
- Consumes: `allocate_business_id(db, entity_type)` from Task 1.
- Produces: API responses for the three entities include `business_id: str`; the frontend (Task 4+) relies on the exact field name `business_id`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_business_id_creation.py` (self-contained SQLite fixture like Task 1's):

```python
"""Create-path integration: new entities receive typed business ids."""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.business_id import BusinessIdConfig
from app.services.portfolio import portfolio_service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    session.add_all([
        BusinessIdConfig(entity_type="portfolio", base_id=10000000, next_sequence=1),
        BusinessIdConfig(entity_type="program", base_id=20000000, next_sequence=1),
        BusinessIdConfig(entity_type="project", base_id=30000000, next_sequence=1),
    ])
    session.commit()
    yield session
    session.close()


def test_created_portfolio_gets_business_id(db):
    p = portfolio_service.create_portfolio(
        db,
        name="P1",
        description="d",
        owner="o",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    assert p.business_id == "010000001"

    p2 = portfolio_service.create_portfolio(
        db,
        name="P2",
        description="d",
        owner="o",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    assert p2.business_id == "010000002"
```

Note: check how `portfolio_service` is exported at the bottom of
`app/services/portfolio.py` (module-level instance, same pattern as the
repositories) and import accordingly. If `create_portfolio`'s audit call
requires more session state, pass `user_id=None` (default).

- [ ] **Step 2: Run to verify it fails**

Run: `docker-compose exec -T app pytest tests/unit/test_business_id_creation.py -q --tb=short`
Expected: FAIL — `p.business_id` is None.

- [ ] **Step 3: Wire the allocator into the three services**

In each service file add the import:

```python
from app.services.business_id import allocate_business_id
```

`portfolio.py` — extend the data dict in `create_portfolio`:

```python
        portfolio_data = {
            "name": name,
            "description": description,
            "owner": owner,
            "reporting_start_date": reporting_start_date,
            "reporting_end_date": reporting_end_date,
            "business_id": allocate_business_id(db, "portfolio"),
        }
```

`program.py` — in `create_program`:

```python
        program_data = {
            "portfolio_id": portfolio_id,
            "name": name,
            "business_sponsor": business_sponsor,
            "program_manager": program_manager,
            "technical_lead": technical_lead,
            "start_date": start_date,
            "end_date": end_date,
            "description": description,
            "business_id": allocate_business_id(db, "program"),
        }
```

`project.py` — in `create_project`:

```python
        project_data = {
            "program_id": program_id,
            "name": name,
            "business_sponsor": business_sponsor,
            "project_manager": project_manager,
            "technical_lead": technical_lead,
            "start_date": start_date,
            "end_date": end_date,
            "cost_center_code": cost_center_code,
            "description": description,
            "business_id": allocate_business_id(db, "project"),
        }
```

- [ ] **Step 4: Expose in Response schemas (not Create/Update)**

In `app/schemas/portfolio.py`, inside `PortfolioResponse`:

```python
    business_id: Optional[str] = Field(default=None, description="Human-friendly 9-digit ID (server-generated)")
```

Same line in `ProgramResponse` (`app/schemas/program.py`) and `ProjectResponse` (`app/schemas/project.py`). `Optional` with `default=None` keeps the many pre-existing tests that build Response objects from fixtures compiling; real API rows always have a value post-migration. Confirm `Optional` is already imported in each schema file (it is used elsewhere in all three).

- [ ] **Step 5: Run tests + verify live API**

Run: `docker-compose exec -T app pytest tests/unit/test_business_id_creation.py tests/unit/test_business_id.py -q --tb=short`
Expected: all pass.

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens']['access_token'])")
curl -s "http://localhost:8000/api/v1/portfolios/?limit=1" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['business_id'])"
```

Expected: a 9-char ID like `010000001`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services backend/app/schemas backend/tests/unit/test_business_id_creation.py
git commit -m "feat: allocate business ids on create and expose in API responses"
```

---

### Task 4: Frontend types + detail-page ID fields

**Files:**
- Modify: `frontend/src/types/portfolio.ts` (Portfolio interface)
- Modify: `frontend/src/types/index.ts` (Program and Project interfaces)
- Modify: `frontend/src/pages/portfolios/PortfolioDetailPage.tsx`, `frontend/src/pages/programs/ProgramDetailPage.tsx`, `frontend/src/pages/projects/ProjectDetailPage.tsx`

**Interfaces:**
- Produces: `business_id: string` on the three TS types (Tasks 6 and 8 read it).

- [ ] **Step 1: Add the field to the types**

In `frontend/src/types/portfolio.ts`, inside `interface Portfolio`:

```ts
  business_id: string
```

Same line inside `interface Program` and `interface Project` in `frontend/src/types/index.ts`.

- [ ] **Step 2: Fix fixture fallout**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "business_id"`

Any test fixture that now fails to satisfy the types gets `business_id: '010000001'`-style values added (use `01…` for portfolios, `02…` programs, `03…` projects). Known candidates: `src/pages/portfolios/PortfoliosListPage.test.tsx` mockPortfolios, `src/components/portfolio/HierarchyTree.test.tsx` (pf/pg/pj fixtures). Fix only fixtures the grep reports — leave the pre-existing baseline errors alone.

- [ ] **Step 3: Show the ID on each detail page**

Each of the three detail pages has a details grid of caption/value pairs. Add a read-only ID field as the LAST grid item of the details grid (it must not disturb the existing field pairing):

PortfolioDetailPage (grid items are `xs={12} sm={6} md={3}` — match siblings):

```tsx
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    ID
                  </Typography>
                  <Typography variant="body1">{portfolio.business_id}</Typography>
                </Grid>
```

ProgramDetailPage and ProjectDetailPage (grid items are `xs={12} sm={6}` — match siblings):

```tsx
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    ID
                  </Typography>
                  <Typography variant="body1">{program.business_id}</Typography>
                </Grid>
```

(`project.business_id` on the project page.) Note the project page has a parity spacer before Start Date — add the ID item AFTER End Date so the date pairing is preserved, and remove the now-unneeded spacer `<Grid item xs={12} sm={6} sx={{ display: { xs: 'none', sm: 'block' } }} />` so Cost Center + ID pair up instead. Verify visually in Step 5.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | grep business_id` → no output.
Run: `npx vitest run src/pages/portfolios/PortfoliosListPage.test.tsx src/components/portfolio/HierarchyTree.test.tsx` → all pass.

- [ ] **Step 5: Visual check + commit**

Load a project detail page in a browser (or headless screenshot) and confirm the ID renders and the Start/End date pairing is intact.

```bash
git add -A && git commit -m "feat: business_id in frontend types and detail pages"
```

---

### Task 5: `idMode` in usePortfolioListState

**Files:**
- Modify: `frontend/src/hooks/usePortfolioListState.ts`
- Modify: `frontend/src/hooks/usePortfolioListState.test.ts`

**Interfaces:**
- Produces (Tasks 6 and 8 compile against): `idMode: boolean` and `toggleIdMode: () => void` added to `PortfolioListState`; persisted under the existing `portfoliosListState` sessionStorage key as `idMode: boolean`.

- [ ] **Step 1: Add failing tests**

Append to `frontend/src/hooks/usePortfolioListState.test.ts`:

```ts
  it('idMode defaults off, toggles, and persists', () => {
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.idMode).toBe(false)

    act(() => result.current.toggleIdMode())
    expect(result.current.idMode).toBe(true)
    expect(JSON.parse(sessionStorage.getItem('portfoliosListState')!).idMode).toBe(true)
  })

  it('idMode restores from saved state', () => {
    sessionStorage.setItem(
      'portfoliosListState',
      JSON.stringify({ search: '', portfolios: [], programs: [], idMode: true })
    )
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.idMode).toBe(true)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/hooks/usePortfolioListState.test.ts`
Expected: the two new tests FAIL (`idMode` undefined); the existing ones pass.

- [ ] **Step 3: Implement**

In `usePortfolioListState.ts`:
- `SavedListState` gains `idMode: boolean`; `loadSavedListState` returns `idMode: parsed.idMode === true` (default false; add `idMode: false` to the fallback object).
- `PortfolioListState` interface gains `idMode: boolean` and `toggleIdMode: () => void`.
- Component state: `const [idMode, setIdMode] = useState(saved.idMode)`.
- The persist effect's JSON gains `idMode` (and `idMode` joins its dependency array).
- Returned object gains `idMode` and `toggleIdMode: useCallback(() => setIdMode((v) => !v), [])`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/hooks/usePortfolioListState.test.ts`
Expected: all pass (6).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/usePortfolioListState.ts frontend/src/hooks/usePortfolioListState.test.ts
git commit -m "feat: persisted idMode flag in portfolio list state"
```

---

### Task 6: HierarchyTree — header row, filtering, highlight, idMode display

**Files:**
- Modify: `frontend/src/components/portfolio/HierarchyTree.tsx`
- Modify: `frontend/src/components/portfolio/HierarchyTree.test.tsx`

**Interfaces:**
- Consumes: `search/setSearch/idMode/toggleIdMode` from the hook (Tasks 3–5), `business_id` on the types (Task 4).
- Produces: new optional prop `onCollapse?: () => void` (Task 7 wires it). Existing props unchanged.

**Behavior contract (from the spec):**
- Header row above the rows: search TextField (small, placeholder "Filter…", clearable by select-all/typing), `#` toggle button (aria-label "Toggle ID mode", visually pressed when on), collapse IconButton (aria-label "Collapse tree", ChevronLeft) shown only when `onCollapse` is provided.
- While the (trimmed) search is non-empty: a node is VISIBLE if it matches or any descendant matches; matching parents show ALL their children; visible non-matching ancestors are DIMMED (`color: 'text.disabled'`); everything visible is force-expanded (arrows still render; manual toggling is moot while filtering). No matches → single dimmed "No matches" line under the header.
- Matching: case-insensitive substring against the display label — the name, plus the business_id when `idMode` is on.
- `idMode` on: labels render `(business_id) name`; tree width 280. Off: name only; width 240.
- Highlight: the matched substring within the label is wrapped in a `<Box component="span">` with `backgroundColor: 'rgba(255, 213, 79, 0.6)'` and `borderRadius: '2px'`; matching is against the lowercased label, highlighting the first occurrence.

- [ ] **Step 1: Add failing tests**

Append to `HierarchyTree.test.tsx` (fixtures already exist from earlier tasks; ensure pf/pg/pj fixtures carry `business_id: '010000001' | '020000001' | '030000001'` from Task 4). Add a second program fixture so pruning is observable:

```tsx
const pg2 = { ...pg, id: 'pg2', name: 'Legacy Systems', business_id: '020000002' }
```

and include it in the `programsApi.list` mock (`items: [pg, pg2]`).

```tsx
describe('HierarchyTree filtering', () => {
  it('filters to matches + ancestors, dims ancestors, hides the rest', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Filter…'), 'crm')

    await waitFor(() => {
      // match + ancestors visible, sibling program hidden
      expect(screen.getByText(/CRM/)).toBeInTheDocument()
      expect(screen.getByText('Customer Experience')).toBeInTheDocument()
      expect(screen.queryByText('Legacy Systems')).not.toBeInTheDocument()
    })
  })

  it('id mode: shows (business_id) prefix and matches ids', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /toggle id mode/i }))
    await waitFor(() =>
      expect(screen.getByText(/\(020000001\)/)).toBeInTheDocument()
    )

    await user.type(screen.getByPlaceholderText('Filter…'), '0300000')
    await waitFor(() => {
      expect(screen.getByText(/\(030000001\)/)).toBeInTheDocument()
      expect(screen.queryByText(/Legacy Systems/)).not.toBeInTheDocument()
    })
  })

  it('renders collapse button only when onCollapse given, and calls it', async () => {
    const user = userEvent.setup()
    const onCollapse = vi.fn()
    render(<HierarchyTree activeType="project" activeId="pj1" onCollapse={onCollapse} />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await user.click(await screen.findByRole('button', { name: /collapse tree/i }))
    expect(onCollapse).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/components/portfolio/HierarchyTree.test.tsx`
Expected: 3 new tests FAIL (no filter field); the original 3 pass.

- [ ] **Step 3: Implement**

In `HierarchyTree.tsx`:

1. Props: add `onCollapse?: () => void`.
2. Pull search/idMode from the hook (it already provides expansion): `const { search, setSearch, idMode, toggleIdMode, expandedPortfolios, ... } = usePortfolioListState()`.
3. Add helpers above the component:

```tsx
const labelFor = (idMode: boolean, businessId: string, name: string) =>
  idMode ? `(${businessId}) ${name}` : name

/** First-occurrence highlight of `term` inside `label` (case-insensitive). */
const HighlightedLabel: React.FC<{ label: string; term: string }> = ({ label, term }) => {
  const t = term.trim().toLowerCase()
  const idx = t ? label.toLowerCase().indexOf(t) : -1
  if (idx < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, idx)}
      <Box
        component="span"
        sx={{ backgroundColor: 'rgba(255, 213, 79, 0.6)', borderRadius: '2px' }}
      >
        {label.slice(idx, idx + t.length)}
      </Box>
      {label.slice(idx + t.length)}
    </>
  )
}
```

4. Filter model, computed with `useMemo` over the grouped data (after `programsByPortfolio`/`projectsByProgram`):

```tsx
  const term = search.trim().toLowerCase()
  const searching = term !== ''
  const matches = (businessId: string, name: string) =>
    labelFor(idMode, businessId, name).toLowerCase().includes(term)

  // visibility: self-match OR descendant-match; matching parents show all children
  const visible = useMemo(() => {
    if (!searching) return null // null = show everything, no dimming
    const dimmed = new Set<string>()
    const show = new Set<string>()
    for (const portfolio of portfolios) {
      const pfMatch = matches(portfolio.business_id, portfolio.name)
      let pfHasDescendant = false
      for (const program of programsByPortfolio.get(portfolio.id) || []) {
        const pgMatch = matches(program.business_id, program.name)
        let pgHasDescendant = false
        for (const project of projectsByProgram.get(program.id) || []) {
          if (pfMatch || pgMatch || matches(project.business_id, project.name)) {
            show.add(`pj-${project.id}`)
            if (!matches(project.business_id, project.name)) dimmed.add(`pj-${project.id}`)
            pgHasDescendant = true
          }
        }
        if (pfMatch || pgMatch || pgHasDescendant) {
          show.add(`pg-${program.id}`)
          if (!pgMatch) dimmed.add(`pg-${program.id}`)
          pfHasDescendant = true
        }
      }
      if (pfMatch || pfHasDescendant) {
        show.add(`pf-${portfolio.id}`)
        if (!pfMatch) dimmed.add(`pf-${portfolio.id}`)
      }
    }
    return { show, dimmed }
  }, [searching, term, idMode, portfolios, programsByPortfolio, projectsByProgram])
```

Note the row keys already follow the `pf-`/`pg-`/`pj-` convention in the render — reuse those exact keys. A dimmed entry that IS a match must not be dimmed: the code above only dims non-matching ancestors (a matching parent's force-shown children are dimmed only if they don't match — which is correct "context" rendering per spec... wait, spec says matching parents show ALL children as normal results). Correction: children force-shown under a matching parent should NOT be dimmed. Change the two `dimmed.add` lines for descendants: only add to `dimmed` when the node itself doesn't match AND it is shown because of a DESCENDANT (not an ancestor). Concretely: for projects shown under a matching parent, do not dim; for programs shown only because a project matched, dim if the program itself doesn't match. The final rule per node: `dim = shown && !selfMatch && shownBecauseOfDescendant`. Implement with that rule (track why each node is shown).

5. Rendering changes:
   - `const effectiveOpen = (kind: 'pf' | 'pg', id: string) => searching ? true : (kind === 'pf' ? expandedPortfolios.has(id) : expandedPrograms.has(id))` — use in place of direct set lookups.
   - Skip nodes not in `visible.show` when `searching`.
   - Row label: `<HighlightedLabel label={labelFor(idMode, entity.business_id, entity.name)} term={search} />`; pass `title={labelFor(...)}` for the tooltip.
   - Dimming: on the row Typography, `color: visible?.dimmed.has(key) ? 'text.disabled' : undefined` (active row keeps its contrast color).
   - "No matches": when `searching` and `visible.show.size === 0`, render `<Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>No matches</Typography>`.
6. Header row as first child of the Paper:

```tsx
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, pb: 0.5 }}>
        <TextField
          size="small"
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.78rem', py: 0.5 } }}
        />
        <IconButton
          aria-label="Toggle ID mode"
          size="small"
          onClick={toggleIdMode}
          sx={{
            border: '1px solid',
            borderColor: idMode ? 'primary.main' : 'divider',
            borderRadius: 1,
            color: idMode ? 'primary.main' : 'text.secondary',
            fontSize: '0.8rem',
            width: 26,
            height: 26,
          }}
        >
          #
        </IconButton>
        {onCollapse && (
          <IconButton aria-label="Collapse tree" size="small" onClick={onCollapse}>
            <ChevronLeft fontSize="small" />
          </IconButton>
        )}
      </Box>
```

(Import `TextField` from `@mui/material` and `ChevronLeft` from `@mui/icons-material`.)
7. Width: `width: idMode ? 280 : 240` on the Paper.

- [ ] **Step 4: Run all tree tests**

Run: `npx vitest run src/components/portfolio/HierarchyTree.test.tsx`
Expected: 6 pass. Also `npx tsc --noEmit 2>&1 | grep HierarchyTree` → no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/portfolio/HierarchyTree.tsx frontend/src/components/portfolio/HierarchyTree.test.tsx
git commit -m "feat: tree search with dimmed-ancestor filtering, highlight, and id mode"
```

---

### Task 7: PortfolioShell — collapse to rail

**Files:**
- Modify: `frontend/src/components/layout/PortfolioShell.tsx`
- Modify: `frontend/src/components/layout/PortfolioShell.test.tsx`

**Interfaces:**
- Consumes: `onCollapse` prop on HierarchyTree (Task 6).
- Produces: sessionStorage key `portfolioTreeCollapsed` = `'1' | '0'`.

- [ ] **Step 1: Add failing tests**

Append to `PortfolioShell.test.tsx` (desktop describe; `mockNarrow = false`):

```tsx
  it('collapses the tree to a rail and expands it back', async () => {
    const user = userEvent.setup()
    renderAt('/projects/pj1')
    expect(screen.getByTestId('hierarchy-tree')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /collapse tree/i }))
    expect(screen.queryByTestId('hierarchy-tree')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('portfolioTreeCollapsed')).toBe('1')

    await user.click(screen.getByRole('button', { name: /expand tree/i }))
    expect(screen.getByTestId('hierarchy-tree')).toBeInTheDocument()
  })
```

Note: the HierarchyTree mock in this file must surface the collapse control for the shell to be testable. Update the mock to:

```tsx
vi.mock('../portfolio/HierarchyTree', () => ({
  default: ({ activeType, activeId, onCollapse }: any) => (
    <div data-testid="hierarchy-tree">
      {activeType}:{activeId}
      {onCollapse && (
        <button aria-label="Collapse tree" onClick={onCollapse}>collapse</button>
      )}
    </div>
  ),
}))
```

Also add `sessionStorage.clear()` in a `beforeEach` for this file if not present.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/layout/PortfolioShell.test.tsx`
Expected: new test FAILS (no collapse handling); existing 6 pass.

- [ ] **Step 3: Implement**

In `PortfolioShell.tsx` (desktop branch only — the narrow swap already has its own toggle and ignores this):

```tsx
const TREE_COLLAPSED_KEY = 'portfolioTreeCollapsed'
```

Component state (near the narrow-swap state):

```tsx
  const [treeCollapsed, setTreeCollapsed] = useState(
    () => sessionStorage.getItem(TREE_COLLAPSED_KEY) === '1'
  )
  const setCollapsed = (collapsed: boolean) => {
    setTreeCollapsed(collapsed)
    sessionStorage.setItem(TREE_COLLAPSED_KEY, collapsed ? '1' : '0')
  }
```

Desktop return branch:

```tsx
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      {treeCollapsed ? (
        <Paper
          sx={{
            width: 24,
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            py: 0.5,
          }}
        >
          <IconButton aria-label="Expand tree" size="small" onClick={() => setCollapsed(false)}>
            <ChevronRight fontSize="small" />
          </IconButton>
        </Paper>
      ) : (
        <HierarchyTree
          activeType={detail.type}
          activeId={detail.id}
          onCollapse={() => setCollapsed(true)}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
```

Imports: add `Paper`, `IconButton` from `@mui/material`, `ChevronRight` from `@mui/icons-material`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/layout/PortfolioShell.test.tsx`
Expected: 7 pass. `npx tsc --noEmit 2>&1 | grep PortfolioShell` → no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/PortfolioShell.tsx frontend/src/components/layout/PortfolioShell.test.tsx
git commit -m "feat: collapsible tree rail in portfolio shell"
```

---

### Task 8: Rich list honors idMode (prefix display + ID matching)

**Files:**
- Modify: `frontend/src/pages/portfolios/PortfoliosListPage.tsx`
- Modify: `frontend/src/pages/portfolios/PortfoliosListPage.test.tsx`

**Interfaces:**
- Consumes: `idMode` from the hook (Task 5), `business_id` on types (Task 4).

- [ ] **Step 1: Add a failing test**

Append to `PortfoliosListPage.test.tsx` (mock fixtures got `business_id` in Task 4):

```tsx
  it('shows (business_id) prefixes when idMode is saved on', async () => {
    sessionStorage.setItem(
      'portfoliosListState',
      JSON.stringify({ search: '', portfolios: [], programs: [], idMode: true })
    )
    render(<PortfoliosListPage />, { store, queryClient })
    await waitFor(() => {
      expect(screen.getByText(/\(010000001\) Digital Transformation/)).toBeInTheDocument()
    })
  })
```

(Adjust the literal to the `business_id` value given to the first mock portfolio in Task 4 — keep fixture and assertion in sync.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/portfolios/PortfoliosListPage.test.tsx`
Expected: new test FAILS; others pass.

- [ ] **Step 3: Implement**

In `PortfoliosListPage.tsx`:

1. Destructure `idMode` from the existing `usePortfolioListState()` call.
2. Add a label helper near the top of the component:

```tsx
  const displayName = (businessId: string, name: string) =>
    idMode ? `(${businessId}) ${name}` : name
```

3. Apply it to the three name cells:
   - portfolio row: `{displayName(portfolio.business_id, portfolio.name)}`
   - program row: `{displayName(program.business_id, program.name)}`
   - project row: `{displayName(project.business_id, project.name)}`
4. Extend search matching: in the `tree` useMemo, the `has(...)` calls gain a business-id argument **only when idMode is on** — change the three call sites:
   - projects filter: `has(p.name, p.project_manager, p.cost_center_code, idMode ? p.business_id : null)`
   - programs: `has(program.name, program.business_sponsor, program.program_manager, idMode ? program.business_id : null)`
   - portfolios: `has(portfolio.name, portfolio.owner, portfolio.description, idMode ? portfolio.business_id : null)`
   and add `idMode` to the useMemo dependency array.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/portfolios/PortfoliosListPage.test.tsx`
Expected: 11 pass. `npx tsc --noEmit 2>&1 | grep PortfoliosListPage | grep -v test` → no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/portfolios/PortfoliosListPage.tsx frontend/src/pages/portfolios/PortfoliosListPage.test.tsx
git commit -m "feat: rich list shows id prefixes and matches ids in idMode"
```

---

### Task 9: Full verification + live E2E

**Files:** none (throwaway script `/tmp/bizid_e2e.py`).

- [ ] **Step 1: Frontend + backend suites for touched areas**

```bash
cd frontend && npx vitest run src/hooks/usePortfolioListState.test.ts src/components/portfolio/HierarchyTree.test.tsx src/components/layout/PortfolioShell.test.tsx src/pages/portfolios/PortfoliosListPage.test.tsx
docker-compose exec -T app pytest tests/unit/test_business_id.py tests/unit/test_business_id_creation.py -q --tb=short
```

Expected: all pass.

- [ ] **Step 2: tsc delta**

`npx tsc --noEmit` filtered to files touched by this branch: no new errors vs the `nav-redesign` baseline.

- [ ] **Step 3: Live E2E (headless Chrome CDP — reuse the session's established pattern)**

Write `/tmp/bizid_e2e.py` following the same CDP skeleton used for nav E2E (login via API, seed localStorage, drive pages; results written to a file, since chrome.terminate() can eat stdout). Assert:

1. `GET /api/v1/portfolios/?limit=1` → `items[0].business_id` matches `^01\d{7}$`; same for programs (`^02`), projects (`^03`).
2. Open `/projects/<id>` → tree header present (`input[placeholder="Filter…"]`).
3. Type a project-name fragment into the tree filter → non-matching portfolio subtree disappears; matching name visible; ancestor row style includes dimming (check computed color of a known ancestor row's Typography differs from the match row's).
4. Click `#` → active project row text matches `\(03\d{7}\)`; type its first 5 ID digits into the filter → row still visible, sibling subtrees gone.
5. Clear filter; click "Collapse tree" → tree gone, `sessionStorage.portfolioTreeCollapsed === '1'`, expand chevron present; click "Expand tree" → tree back.
6. Screenshot `/tmp/bizid_tree.png` (filtered + idMode state) and eyeball it.

- [ ] **Step 4: Fix anything E2E surfaces, re-run, then commit**

```bash
git add -A && git commit --allow-empty -m "test: verify business ids and tree search end to end"
```

---

## Self-Review Notes

- **Spec coverage:** config table + typed bases (T1/T2), backfill + constraints (T2), create-path allocation + response exposure (T3), string-not-integer rule (T1 column type, T3 schema `str`, T4 TS `string`), detail-page ID fields (T4), persisted idMode (T5), tree header + pruned/dimmed/highlighted filtering + shared search + width change (T6), collapse rail + persistence + narrow-mode exclusion (T7), rich-list prefix + ID matching (T8), tests + live E2E incl. migration verification (T2/T9).
- **Type consistency:** `allocate_business_id(db, entity_type) -> str` used identically in T1/T3; `idMode/toggleIdMode` named identically in T5/T6/T8; `onCollapse` in T6/T7; sessionStorage keys `portfoliosListState` (extended) and `portfolioTreeCollapsed` (new).
- **Judgment calls encoded:** model column stays nullable (SQLite fixtures) while Postgres enforces NOT NULL via migration; `business_id` Optional-with-None in Pydantic responses to keep pre-existing fixture-built tests compiling; dimming rule = shown-because-of-descendant only (children of matching parents are NOT dimmed); force-expand while searching without touching persisted expansion state.
