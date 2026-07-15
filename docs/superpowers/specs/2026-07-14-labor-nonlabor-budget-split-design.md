# Labor / Non-Labor Budget Split — Technical Design

**Date:** 2026-07-14
**Status:** Agreed design, not yet implemented. Build on a **new branch** off the
current `main` tip (`fb761cb`).
**Origin:** Brainstormed & agreed 2026-07-13 (memory note
`labor-nonlabor-budget-split-design`); this document is the full technical
design that note asked for, grounded in the current code.

---

## 1. Goal & motivation

Today every phase budget, actual, and forecast is split **capital vs expense**.
That split alone can't tell people-cost from materials/licenses. Finance needs a
second, orthogonal axis: **labor vs non-labor**.

After this change every phase budget — and the actuals and forecast series that
sit against it — is split into **4 categories**:

| | Capital | Expense |
|---|---|---|
| **Labor** | `labor_capital` | `labor_expense` |
| **Non-Labor** | `nonlabor_capital` | `nonlabor_expense` |

The four always sum to the phase/series total. The existing capital/expense
split is preserved as a **derived** view (`capital = labor_capital +
nonlabor_capital`, `expense = labor_expense + nonlabor_expense`), so nothing
that reads capital/expense/total today breaks, and all existing variance math is
unchanged because totals are unchanged.

## 2. Guiding principles

- **Totals are invariant.** The migration backfills existing capital/expense
  entirely into the **Labor** columns (non-labor = 0). Every phase's capital,
  expense, and total stay numerically identical, so no historical report moves.
- **Derive, don't duplicate.** Wherever code reads `phase.capital_budget` /
  `expense_budget` today, we keep those readable as **hybrid properties** that
  sum the new columns. This shrinks the change surface dramatically —
  `forecasting.py`, `phase_service.py` budget-sum validation, and reporting keep
  compiling against the same attribute names.
- **`resource_type` is the single source of truth** for classifying a cost as
  labor vs non-labor, on **both** actuals and forecast — identical basis, so a
  dollar classified one way in forecast is classified the same way in actuals.
- **Backward-compatible API.** Each financial series keeps emitting
  `{total, capital, expense}` **and** adds `{labor_capital, labor_expense,
  nonlabor_capital, nonlabor_expense}`. Existing consumers ignore the new keys;
  the new toggle uses them.

## 3. Current-state facts this design relies on

Verified in the code (2026-07-14):

- `ProjectPhase` (`backend/app/models/project.py:62`) has `capital_budget`,
  `expense_budget`, `total_budget` (`Numeric(15,2)`), with
  `CheckConstraint('capital_budget + expense_budget = total_budget')`.
- `Actual` (`backend/app/models/actual.py`) has a **nullable**
  `resource_assignment_id` FK that is **write-only**: `ActualsService._calculate_cost`
  sets it via a fragile "first assignment whose `assignment_date == actual_date`"
  match (`backend/app/services/actuals.py:173`), and nothing reads it for logic —
  `variance_analysis` matches actuals↔forecast independently by
  `external_worker_id`/date. Safe to drop.
- `Resource.resource_type` is `ResourceType.LABOR | NON_LABOR`;
  `Resource.worker_id` is **unique** and non-null exactly for LABOR rows
  (`backend/app/models/resource.py:24`, CHECK-enforced). So
  `external_worker_id → Worker → Resource` is a deterministic backfill path.
- `ForecastingService._calculate_assignment_cost`
  (`backend/app/services/forecasting.py:255`) **already** loads
  `resource.resource_type` and already gives non-labor resources a default
  ($500/day) — non-labor already participates in forecast; we only need to route
  its capital/expense into the non-labor buckets.
- Actuals import today is a single CSV importer (`actuals_import.py`,
  columns `project_id,external_worker_id,worker_name,date,percentage`) feeding
  `ActualsService.import_actuals_batch`.
- The financial API shape is produced by `ForecastData.to_dict()`
  (`forecasting.py:75`) and aggregated in `reporting.py`
  (`get_multi_project_report`, `backend/app/services/reporting.py:187`).
- Frontend financial types live in `frontend/src/api/forecast.ts`
  (`CategoryBreakdown {total,capital,expense}`, `ForecastApiResponse`).
  `transformForecastData` (`utils/forecastTransform.ts`) turns the response into
  `FinancialTableData`, consumed by `FinancialSummaryTable.tsx` and
  `ChartSection.tsx`. **Confirmed consumers of the forecast→transform→chart
  pipeline are exactly two pages:** `ProjectDetailPage.tsx` (line ~108) and
  `ProgramDetailPage.tsx`. (See §9 note on "portfolio dashboard".)

## 4. Data model changes

### 4.1 `ProjectPhase` (`backend/app/models/project.py`)

- **Drop** `capital_budget`, `expense_budget` columns.
- **Add** four `Numeric(15,2)`, `nullable=False`, `default=0`, each `>= 0`:
  `labor_capital_budget`, `labor_expense_budget`,
  `nonlabor_capital_budget`, `nonlabor_expense_budget`.
- **Keep** `total_budget` (stored). Rewrite the sum CheckConstraint to:
  `labor_capital_budget + labor_expense_budget + nonlabor_capital_budget +
  nonlabor_expense_budget = total_budget`.
- **Add hybrid properties** so existing readers keep working unchanged:
  ```python
  capital_budget = labor_capital_budget + nonlabor_capital_budget
  expense_budget = labor_expense_budget + nonlabor_expense_budget
  ```
  These are read-only SQLAlchemy `hybrid_property`s (Python-side sums; no writes).

### 4.2 `Actual` (`backend/app/models/actual.py`) — unified, dollar-based

- **Add** `resource_id` FK → `resources.id`, `nullable=False`, indexed. This is
  the single classifier (`actual.resource.resource_type`).
- **Make nullable**: `external_worker_id`, `worker_name`, `allocation_percentage`
  (non-labor actuals have none).
- **Drop** `resource_assignment_id` (column, FK, index, and the
  `ResourceAssignment.actuals` relationship + `Actual.resource_assignment`
  relationship).
- **Keep** dollar `actual_cost`, `capital_amount`, `expense_amount` and the
  `capital_amount + expense_amount = actual_cost` constraint.
- **Add** relationship `resource = relationship("Resource")`.

Classification helper (used by forecasting/reporting aggregation):
`actual.resource.resource_type` → `LABOR` routes `capital_amount`/`expense_amount`
into `labor_*`; `NON_LABOR` into `nonlabor_*`.

## 5. Migrations (Alembic, `backend/alembic/versions/`)

Two migrations, chained after the current head. Both follow the existing
pattern (`7c6a22c3f524_...`): raw-SQL backfill via `op.get_bind()`, explicit
constraint drop/add, verification `print`, full `downgrade()`.

**Migration 1 — phases:**
1. Add the four new columns (`nullable=True` first for the backfill).
2. Backfill: `labor_capital_budget = capital_budget`,
   `labor_expense_budget = expense_budget`, both non-labor columns = 0.
3. `alter_column` the four to `nullable=False`.
4. Drop `check_budget_sum`, `check_capital_budget_positive`,
   `check_expense_budget_positive`; drop `capital_budget`, `expense_budget`.
5. Add four `>= 0` checks + the new 4-way sum check `check_budget_sum`.

**Migration 2 — actuals:**
1. Add `resource_id` (`nullable=True` first), indexed.
2. Backfill: `resource_id = (SELECT r.id FROM resources r JOIN workers w ON
   r.worker_id = w.id WHERE w.external_id = actuals.external_worker_id)`.
   (All existing actuals are labor, so every row resolves.)
3. `alter_column resource_id` → `nullable=False`; add FK constraint.
4. `alter_column` `external_worker_id`, `worker_name`, `allocation_percentage`
   → `nullable=True`.
5. Drop the `resource_assignment_id` FK + column.

`downgrade()` reverses each (non-labor rows, which have null `external_worker_id`,
would block a clean downgrade — the downgrade documents that it only supports the
all-labor state that existed pre-migration, matching the existing migrations'
posture).

## 6. Actuals import — split into two importers

One unified `Actual` table, two ingest paths. Both classify by presence of an
employee/worker id:

- worker id present, non-labor `resource_id` blank → **labor**
- non-labor `resource_id` present, worker blank → **non-labor**
- both or neither → **reject the row**

### 6.1 Labor importer (percentage-based)

Row: `project_id, external_worker_id, worker_name, date`, plus **either** a
single `percentage` **or** a `capital_percentage`+`expense_percentage` pair.
Cost is always `worker rate × %`.

- If `capital_percentage` and `expense_percentage` are present:
  `capital_amount = rate × cap%`, `expense_amount = rate × exp%`,
  `allocation_percentage = cap% + exp%`.
- Else a single `percentage`: `actual_cost = rate × percentage`, split by the
  resource's **planned assignment** cap%/exp% for that date (the same split the
  forecast uses). **If no planned assignment exists on that date → REJECT the
  row.** (No phase-ratio fallback — deliberately removed. This replaces today's
  fragile default-50/50 behavior in `_calculate_cost`.)

### 6.2 Non-labor importer (dollar-based)

Row: `project_id, resource_id, date, capital, expense` (dollar columns, either
may be 0). Stored directly: `capital_amount`, `expense_amount`,
`actual_cost = capital + expense`. No rate, no percentage, `allocation_percentage
= NULL`, `external_worker_id = NULL`, `worker_name = NULL`. No allocation-conflict
check (percentage allocation is meaningless for non-labor).

### 6.3 Endpoints & schemas

Split the current `POST /actuals/import` into:
- `POST /actuals/import/labor` (existing behavior + optional cap%/exp% columns,
  minus the 50/50 fallback)
- `POST /actuals/import/non-labor` (dollar-based)

New Pydantic schemas per importer; both return the existing `ActualImportResponse`
shape. `variance_analysis` and allocation validation operate on **labor actuals
only** (filter `external_worker_id IS NOT NULL`) so nullable columns never reach
percentage math.

## 7. Forecast & financial API (4-way)

### 7.1 `ForecastData` / `_calculate_assignment_cost` (`forecasting.py`)

- `_calculate_assignment_cost` already knows `resource.resource_type`. Return the
  cost **and** its type so the caller can bucket capital/expense into
  labor vs non-labor.
- `ForecastData` gains four-way holders for **each** of budget, actual, forecast:
  `{labor_capital, labor_expense, nonlabor_capital, nonlabor_expense}`.
  - **Budget** 4-way = sums of the four new phase columns.
  - **Actual** 4-way = `capital_amount`/`expense_amount` grouped by
    `actual.resource.resource_type`.
  - **Forecast** 4-way = each future assignment's capital/expense portion routed
    by its resource's type.
- Keep the existing `capital`/`expense`/`total` outputs, now computed as the
  derived sums, so `to_dict()` stays backward compatible.

### 7.2 `to_dict()` shape

```json
{
  "entity_id": "...", "entity_name": "...", "entity_type": "project",
  "budget":   { "total": N, "capital": N, "expense": N,
                "labor_capital": N, "labor_expense": N,
                "nonlabor_capital": N, "nonlabor_expense": N },
  "actual":   { ...same 7 keys... },
  "forecast": { ...same 7 keys... },
  "analysis": { ...unchanged... }
}
```

### 7.3 Aggregations

- Program forecast (`calculate_program_forecast`) and
  `reporting.get_multi_project_report` sum the four new keys across projects
  alongside the existing totals.
- Budget rollups (project/program/portfolio) = sum of the four phase columns
  (via the derived totals, unchanged).

**Portfolio-extensibility requirement (forward-looking).** The four-way
accumulation MUST live on `ForecastData` and in the generic per-series summation
loop — NOT be hardcoded to a two-level (project→program) depth. The hierarchy is
uniform (`Portfolio → programs → projects`, via `Program.portfolio_id`), so a
future `calculate_portfolio_forecast` is a pure additive extension: loop
`portfolio.programs`, sum the identical `ForecastData` series fields, build a
`ForecastData`, reuse `to_dict()` and the same frontend `ChartSection`/toggle.
Portfolio-level financials are out of scope for this change, but this design must
not foreclose them — keep the summation reusable. (The portfolio repository has
no `get_programs` accessor today; that future work adds one, or iterates the
existing `Portfolio.programs` relationship.)

## 8. Phase editor UI (`PhaseList.tsx` / `PhaseEditor.tsx`)

- Section title → **"Project Phases and Budget"**.
- **Two-row budget header:** top row spans `Labor Budget` over a `Capital |
  Expense` pair and `Non-Labor Budget` over a second `Capital | Expense` pair;
  the individual column labels drop the word "Budget".
- **Four editable number inputs** per phase (`labor_capital_budget`,
  `labor_expense_budget`, `nonlabor_capital_budget`, `nonlabor_expense_budget`).
- **Total column stays, read-only** = sum of the four.
- Save still goes through the phase **batch** endpoint, now carrying the four
  budget fields. The totals row sums each of the four columns + grand total.
- Frontend `ProjectPhase` type + `phases.ts` request/response types gain the four
  fields; `capital_budget`/`expense_budget` remain available (server-derived) for
  any read-only display.

## 9. Charts — labor/non-labor toggle

- **Two toggle switches (Labor / Non-Labor)** added to the financial panels of
  **project detail** and **program detail** (the `ChartSection` +
  `FinancialSummaryTable` containers). Default: **both on** (today's full totals).
- `CategoryBreakdown` gains the four sub-fields. `transformForecastData(apiResponse,
  { laborOn, nonlaborOn })` computes each displayed category from toggle state:
  ```
  capital = (laborOn ? labor_capital : 0) + (nonlaborOn ? nonlabor_capital : 0)
  expense = (laborOn ? labor_expense : 0) + (nonlaborOn ? nonlabor_expense : 0)
  total   = capital + expense
  ```
  Applied to **all three** series (budget, actual, forecast), so the table's
  Current-Forecast and Variance and the chart bars all stay internally
  consistent. Both the table and the charts read the same toggled
  `FinancialTableData`.
- **Guard:** never allow both off — turning off the last-on toggle flips the
  other on.

**Scope note on "portfolio dashboard":** the 2026-07-13 brainstorm listed
"portfolio dashboard" as a third toggle location, but the current code mounts the
`ChartSection`/`FinancialSummaryTable` forecast pipeline only on **project** and
**program** detail pages. There is no portfolio-level financial chart panel today
to attach a toggle to. This design therefore scopes the toggle to the two
existing containers; adding a portfolio-level financial panel is a separate,
out-of-scope piece of work. (Flagged for the user rather than silently dropped.)

## 10. Non-goals / explicitly out of scope

- Standalone report pages (`components/reports/*`) keep their current
  capital/expense behavior — no toggle there for now.
- No change to how capital-vs-expense is decided; labor/non-labor is a new,
  orthogonal axis layered on top.
- No new RBAC surface; imports and phase editing inherit existing permissions.
- Portfolio-level financial chart panel (see §9).

## 11. Risks & integration points

1. **Nullable `allocation_percentage` reaching percentage math.**
   `variance_analysis.py` and `allocation_validator` sum `allocation_percentage`
   and key by `external_worker_id`. Mitigation: filter to labor actuals
   (`external_worker_id IS NOT NULL`) at every such entry point; non-labor rows
   never participate in allocation/variance.
2. **Dropping `resource_assignment_id`.** Verified write-only; the drop also
   removes two relationships. `actuals.py` must stop returning/persisting it.
3. **Hybrid properties vs. queries.** `capital_budget`/`expense_budget` become
   Python-side hybrids. Confirmed current readers use them as instance attributes
   (`phase.capital_budget` in `forecasting.py`, `phase_service.py`), not in SQL
   `filter()`s — so Python-side evaluation is sufficient. Any future SQL filter on
   these would need a hybrid expression; none exists today.
4. **Migration ordering.** Phase and actual migrations are independent; chain them
   in either order after the current head, but keep them as two revisions for
   clean rollback.

## 12. Test strategy (summary; full cases in the plan)

- **Model/constraint:** 4-way sum constraint accepts valid splits, rejects
  mismatched totals; hybrid `capital_budget`/`expense_budget` derive correctly.
- **Migrations:** upgrade preserves each phase's capital/expense/total exactly;
  actual `resource_id` backfill resolves every legacy (labor) row.
- **Importers:** labor cap%/exp% path, labor single-% path (assignment split),
  labor single-% with **no assignment → reject**, non-labor dollar path,
  both/neither classifier → reject.
- **Forecast/API:** `to_dict()` emits 7 keys per series; labor+nonlabor sub-fields
  sum to capital/expense/total; non-labor forecast lands in nonlabor buckets.
- **Frontend:** `transformForecastData` toggle math (labor-only, nonlabor-only,
  both, and the both-off guard); phase editor renders/saves four inputs with a
  read-only total; chart+table react to toggles.
