# Portfolio Financials Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Program/Project "financials section" (Budget vs. Actual vs. Forecast table + chart, Labor/Non-Labor toggle, program→project→phase drill-down) to the Portfolio detail page, aggregated across the whole portfolio.

**Architecture:** Full-stack. Backend adds one `ForecastingService.calculate_portfolio_forecast` method (summing each program's existing forecast, reusing the exact accumulation block `calculate_program_forecast` already uses) and one `GET /reports/forecast/portfolio/{id}` endpoint. Frontend adds `getPortfolioForecast` + a `'portfolio'` `entity_type`, and rebuilds `PortfolioDetailPage` into the Program/Project "Details + Financials split view" with a three-tier drill-down whose forecast query hits the new portfolio endpoint only at the top level and reuses the existing program/project endpoints when drilled in.

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic v2; React 18 + TypeScript + MUI + React Query + Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-portfolio-financials-section-design.md`.
- **Branch:** work continues on `feat/portfolio-financials` (already branched off `main`; the design doc is committed there).
- **Backend tests:** `docker exec planner-app python -m pytest <paths> -q` (container cwd `/app` == host `backend/`, live-mounted). If a test result looks stale after an edit, compare `md5sum <file>` host vs `docker exec planner-app md5sum /app/<file>`; if they differ, `mv` the file to `/tmp` and back on the host to bust the virtiofs cache (never `docker cp`).
- **Frontend tests:** `cd frontend && npx vitest run <path>` — this vitest **rejects `-q`**; never pass it.
- **Type budget:** `cd frontend && npx tsc --noEmit | wc -l` stays at **234**.
- The Program/Project financials sections and the shared components (`FinancialSummaryTable`, `ChartSection`, `transformForecastData`, `nextToggleState`) are **reused unchanged** — do not modify them.
- Never modify or stage `.kiro/specs/ideas.txt` or `docs/database-erd.html`.
- Docker must be up (`docker ps` shows `planner-app` healthy). If not: `systemctl --user start docker-desktop` and wait for health.

---

## Task 1: Backend — `calculate_portfolio_forecast` service method

**Files:**
- Modify: `backend/app/services/forecasting.py` (add import near line 13; add method after `calculate_program_forecast`, which ends ~line 555)
- Test: `backend/tests/unit/test_forecasting_reporting.py` (add tests in the existing `TestForecastingService` class; reuse its `db`, `sample_program`, `sample_project`, `sample_actuals` fixtures at the top of the file)

**Interfaces:**
- Consumes: existing `self.calculate_program_forecast(db, program_id, as_of_date) -> ForecastData`; existing `ForecastData` constructor (12 positional series + 12 keyword four-way series); `portfolio.programs` relationship on the `Portfolio` model.
- Produces: `forecasting_service.calculate_portfolio_forecast(db: Session, portfolio_id: UUID, as_of_date: Optional[date] = None) -> ForecastData` with `entity_type == "portfolio"`. Task 2 calls this.

**Context:** `sample_program` (defined ~line 41 of the test file) already creates a `Portfolio` and one `Program` under it, so `sample_program.portfolio_id` is a real portfolio containing exactly one program. A single-program portfolio's forecast therefore equals that program's forecast — the cleanest aggregation assertion.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/unit/test_forecasting_reporting.py`, inside `class TestForecastingService`, add (the file already imports `date`, `Decimal`, `pytest`, `Portfolio`, `forecasting_service`):

```python
    def test_calculate_portfolio_forecast(self, db, sample_program, sample_project, sample_actuals):
        """Portfolio forecast aggregates its programs; a single-program portfolio
        equals that program's forecast."""
        portfolio_id = sample_program.portfolio_id
        forecast = forecasting_service.calculate_portfolio_forecast(
            db=db,
            portfolio_id=portfolio_id,
            as_of_date=date(2024, 1, 10),
        )
        assert forecast.entity_type == "portfolio"
        assert forecast.entity_id == portfolio_id
        assert forecast.total_budget == Decimal('150000.00')
        assert forecast.total_actual == Decimal('2500.00')

    def test_calculate_portfolio_forecast_empty(self, db):
        """A portfolio with no programs yields an all-zero forecast."""
        portfolio = Portfolio(
            name="Empty Portfolio",
            description="No programs",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31),
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
        forecast = forecasting_service.calculate_portfolio_forecast(db=db, portfolio_id=portfolio.id)
        assert forecast.entity_type == "portfolio"
        assert forecast.total_budget == Decimal('0.00')
        assert forecast.total_forecast == Decimal('0.00')

    def test_calculate_portfolio_forecast_not_found(self, db):
        """Unknown portfolio id raises ValueError."""
        import uuid
        with pytest.raises(ValueError, match="does not exist"):
            forecasting_service.calculate_portfolio_forecast(db=db, portfolio_id=uuid.uuid4())
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `docker exec planner-app python -m pytest tests/unit/test_forecasting_reporting.py -k portfolio -q`
Expected: FAIL — `AttributeError: 'ForecastingService' object has no attribute 'calculate_portfolio_forecast'`.

- [ ] **Step 3: Add the portfolio repository import**

In `backend/app/services/forecasting.py`, after the existing `from app.repositories.program import program_repository` line (~line 13), add:

```python
from app.repositories.portfolio import portfolio_repository
```

- [ ] **Step 4: Add the method**

In `backend/app/services/forecasting.py`, immediately after `calculate_program_forecast` returns (right before `def delete_...`/the next method — i.e. after the `calculate_program_forecast` method body ends), add:

```python
    def calculate_portfolio_forecast(
        self,
        db: Session,
        portfolio_id: UUID,
        as_of_date: Optional[date] = None
    ) -> ForecastData:
        """
        Calculate aggregated forecast for a portfolio (all its programs).

        Sums each program's ForecastData using the same per-series accumulation
        as calculate_program_forecast (which sums its projects) — a generic
        summation over child ForecastData objects.

        Raises:
            ValueError: If portfolio not found
        """
        if as_of_date is None:
            as_of_date = date.today()

        portfolio = portfolio_repository.get(db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio with ID {portfolio_id} does not exist")

        total_budget = Decimal('0.00')
        capital_budget = Decimal('0.00')
        expense_budget = Decimal('0.00')
        total_actual = Decimal('0.00')
        capital_actual = Decimal('0.00')
        expense_actual = Decimal('0.00')
        total_forecast = Decimal('0.00')
        capital_forecast = Decimal('0.00')
        expense_forecast = Decimal('0.00')
        budget_labor_capital = Decimal('0.00')
        budget_labor_expense = Decimal('0.00')
        budget_nonlabor_capital = Decimal('0.00')
        budget_nonlabor_expense = Decimal('0.00')
        actual_labor_capital = Decimal('0.00')
        actual_labor_expense = Decimal('0.00')
        actual_nonlabor_capital = Decimal('0.00')
        actual_nonlabor_expense = Decimal('0.00')
        forecast_labor_capital = Decimal('0.00')
        forecast_labor_expense = Decimal('0.00')
        forecast_nonlabor_capital = Decimal('0.00')
        forecast_nonlabor_expense = Decimal('0.00')

        for program in (portfolio.programs or []):
            pf = self.calculate_program_forecast(
                db=db,
                program_id=program.id,
                as_of_date=as_of_date
            )
            total_budget += pf.total_budget
            capital_budget += pf.capital_budget
            expense_budget += pf.expense_budget
            total_actual += pf.total_actual
            capital_actual += pf.capital_actual
            expense_actual += pf.expense_actual
            total_forecast += pf.total_forecast
            capital_forecast += pf.capital_forecast
            expense_forecast += pf.expense_forecast
            budget_labor_capital += pf.budget_labor_capital
            budget_labor_expense += pf.budget_labor_expense
            budget_nonlabor_capital += pf.budget_nonlabor_capital
            budget_nonlabor_expense += pf.budget_nonlabor_expense
            actual_labor_capital += pf.actual_labor_capital
            actual_labor_expense += pf.actual_labor_expense
            actual_nonlabor_capital += pf.actual_nonlabor_capital
            actual_nonlabor_expense += pf.actual_nonlabor_expense
            forecast_labor_capital += pf.forecast_labor_capital
            forecast_labor_expense += pf.forecast_labor_expense
            forecast_nonlabor_capital += pf.forecast_nonlabor_capital
            forecast_nonlabor_expense += pf.forecast_nonlabor_expense

        return ForecastData(
            entity_id=portfolio_id,
            entity_name=portfolio.name,
            entity_type="portfolio",
            total_budget=total_budget,
            capital_budget=capital_budget,
            expense_budget=expense_budget,
            total_actual=total_actual,
            capital_actual=capital_actual,
            expense_actual=expense_actual,
            total_forecast=total_forecast,
            capital_forecast=capital_forecast,
            expense_forecast=expense_forecast,
            budget_labor_capital=budget_labor_capital,
            budget_labor_expense=budget_labor_expense,
            budget_nonlabor_capital=budget_nonlabor_capital,
            budget_nonlabor_expense=budget_nonlabor_expense,
            actual_labor_capital=actual_labor_capital,
            actual_labor_expense=actual_labor_expense,
            actual_nonlabor_capital=actual_nonlabor_capital,
            actual_nonlabor_expense=actual_nonlabor_expense,
            forecast_labor_capital=forecast_labor_capital,
            forecast_labor_expense=forecast_labor_expense,
            forecast_nonlabor_capital=forecast_nonlabor_capital,
            forecast_nonlabor_expense=forecast_nonlabor_expense,
        )
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `docker exec planner-app python -m pytest tests/unit/test_forecasting_reporting.py -k portfolio -q`
Expected: PASS (3 tests). If a result looks stale, apply the virtiofs cache-bust from Global Constraints.

- [ ] **Step 6: Regression check the forecasting suite**

Run: `docker exec planner-app python -m pytest tests/unit/test_forecasting_reporting.py -q`
Expected: same pass/fail profile as before plus the 3 new passing tests. Note any pre-existing failures; do not fix out-of-scope debt.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/forecasting.py backend/tests/unit/test_forecasting_reporting.py
git commit -m "feat(forecast): add calculate_portfolio_forecast (sum of program forecasts)"
```

---

## Task 2: Backend — portfolio forecast endpoint

**Files:**
- Modify: `backend/app/api/v1/endpoints/reports.py` (add a route after `get_program_forecast`, ~line 80)
- Test: `backend/tests/integration/test_reports_api.py` (add a test mirroring the program-forecast endpoint test; reuse its `sample_program`/`sample_project` fixtures)

**Interfaces:**
- Consumes: `forecasting_service.calculate_portfolio_forecast(db, portfolio_id, as_of_date)` (Task 1).
- Produces: `GET /api/v1/reports/forecast/portfolio/{portfolio_id}?as_of_date=YYYY-MM-DD` → `ForecastData.to_dict()` JSON with `entity_type == "portfolio"`. Task 3 calls this.

**Context:** `to_dict()` already serializes `entity_type` verbatim and derives `analysis` from totals, so no serializer change is needed. Auth mirrors the sibling endpoints: `Depends(get_db)` + `Depends(get_current_user)`. The router is mounted under `/api/v1/reports` (verify the prefix used by the existing program test and copy it exactly).

- [ ] **Step 1: Write the failing test**

In `backend/tests/integration/test_reports_api.py`, find the existing program-forecast endpoint test (search `forecast/program`) and add a sibling test just below it, copying its client/fixture/auth setup and swapping the path + entity_type. Concretely:

```python
    def test_get_portfolio_forecast(self, client, auth_headers, sample_program, sample_project):
        """GET /reports/forecast/portfolio/{id} returns an aggregated portfolio forecast."""
        portfolio_id = sample_program.portfolio_id
        response = client.get(
            f"/api/v1/reports/forecast/portfolio/{portfolio_id}",
            params={"as_of_date": "2024-01-10"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["entity_type"] == "portfolio"
        assert body["entity_id"] == str(portfolio_id)
        assert "budget" in body and "actual" in body and "analysis" in body

    def test_get_portfolio_forecast_not_found(self, client, auth_headers):
        """Unknown portfolio id → 404."""
        import uuid
        response = client.get(
            f"/api/v1/reports/forecast/portfolio/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404
```

> If the existing program-forecast test in this file uses different fixture names for the client/auth (e.g. `client` vs `test_client`, `auth_headers` vs a token helper), match those exact names — copy them from the neighboring test rather than inventing new ones.

- [ ] **Step 2: Run the test to verify it fails**

Run: `docker exec planner-app python -m pytest tests/integration/test_reports_api.py -k portfolio_forecast -q`
Expected: FAIL — `404` for the first test (route not registered yet).

- [ ] **Step 3: Add the endpoint**

In `backend/app/api/v1/endpoints/reports.py`, immediately after the `get_program_forecast` function (ends ~line 80), add:

```python
@router.get(
    "/forecast/portfolio/{portfolio_id}",
    summary="Get portfolio forecast",
    description="Calculate aggregated cost forecast for a portfolio (all its programs)"
)
async def get_portfolio_forecast(
    portfolio_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to calculate forecast as of (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate aggregated forecast for a portfolio.

    Returns budget vs actual vs forecast data aggregated across all programs.
    """
    try:
        forecast_data = forecasting_service.calculate_portfolio_forecast(
            db=db,
            portfolio_id=portfolio_id,
            as_of_date=as_of_date
        )
        return forecast_data.to_dict()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `docker exec planner-app python -m pytest tests/integration/test_reports_api.py -k portfolio_forecast -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/reports.py backend/tests/integration/test_reports_api.py
git commit -m "feat(reports): add GET /reports/forecast/portfolio/{id} endpoint"
```

---

## Task 3: Frontend — `getPortfolioForecast` API client

**Files:**
- Modify: `frontend/src/api/forecast.ts`

**Interfaces:**
- Consumes: the Task 2 endpoint.
- Produces: `getPortfolioForecast(portfolioId: string, asOfDate: string): Promise<ForecastApiResponse>`; `ForecastApiResponse.entity_type` widened to `'project' | 'program' | 'portfolio'`. Task 4 imports both.

**Context:** This mirrors the existing `getProgramForecast` exactly. No dedicated unit test (the repo doesn't unit-test these thin API wrappers); Task 4's component test exercises it. Verified by the Task 4 type-check.

- [ ] **Step 1: Widen the entity_type union**

In `frontend/src/api/forecast.ts`, change the `entity_type` field of `ForecastApiResponse`:

```ts
  entity_type: 'project' | 'program' | 'portfolio'
```

- [ ] **Step 2: Add the client function**

At the end of `frontend/src/api/forecast.ts`, add:

```ts
/**
 * Get portfolio-level (aggregated across all programs) forecast data
 * @param portfolioId - The ID of the portfolio
 * @param asOfDate - The date to split actuals from forecast (ISO format: YYYY-MM-DD)
 */
export const getPortfolioForecast = async (
  portfolioId: string,
  asOfDate: string
): Promise<ForecastApiResponse> => {
  const response = await apiClient.get(`/reports/forecast/portfolio/${portfolioId}`, {
    params: { as_of_date: asOfDate }
  })
  return response.data
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/forecast.ts
git commit -m "feat(forecast-api): add getPortfolioForecast + 'portfolio' entity_type"
```

---

## Task 4: Frontend — Portfolio detail page financials panel + drill-down

**Files:**
- Modify: `frontend/src/pages/portfolios/PortfolioDetailPage.tsx`
- Test: `frontend/src/pages/portfolios/PortfolioDetailPage.financials.test.tsx` (new)

**Interfaces:**
- Consumes: `getProgramForecast`, `getProjectForecast`, `getPortfolioForecast` (Task 3); `transformForecastData`, `LaborToggle` from `../../utils/forecastTransform`; `nextToggleState` from `../projects/laborToggle`; `phasesApi.list(projectId): Promise<ProjectPhase[]>`; `projectsApi.list({ program_id, limit }): Promise<PaginatedResponse<Project>>`; `portfoliosApi.getPrograms(id): Promise<Program[]>` (already used on the page); `FinancialSummaryTable`, `ChartSection`.
- Produces: the Portfolio detail page's financials section (the feature's UI).

**Context:** The page already fetches `programs` via `portfoliosApi.getPrograms(id!)` (query key `['portfolio', id, 'programs']`). The financials query hits the new portfolio endpoint only when no program is selected; drilling in reuses the existing program/project endpoints. The forecast query key must include `id`, all three selections, and `today` so React Query refetches per scope. The existing full-width "Portfolio Info" `Paper` (starts ~line 240, `<Paper sx={{ p: 2, mb: 2 }}>`) is wrapped into the left column of a new two-column `Grid`; the financials panel is the right column; the Programs section below is unchanged.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/portfolios/PortfolioDetailPage.financials.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import PortfolioDetailPage from './PortfolioDetailPage'
import { portfoliosApi } from '../../api/portfolios'
import * as forecastApi from '../../api/forecast'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useParams: () => ({ id: 'pf1' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('../../api/portfolios', () => ({
  portfoliosApi: {
    get: vi.fn(),
    getPrograms: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('../../api/projects', () => ({
  projectsApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 1000, pages: 0 }) },
}))
vi.mock('../../api/phases', () => ({
  phasesApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../api/forecast', async () => ({
  ...(await vi.importActual<any>('../../api/forecast')),
  getPortfolioForecast: vi.fn(),
  getProgramForecast: vi.fn(),
  getProjectForecast: vi.fn(),
}))

const portfolio = {
  id: 'pf1',
  name: 'North Star',
  description: 'd',
  owner: 'Owner',
  reporting_start_date: '2024-01-01',
  reporting_end_date: '2024-12-31',
  version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  business_id: '010000001',
}

const portfolioForecast = {
  entity_id: 'pf1',
  entity_name: 'North Star',
  entity_type: 'portfolio' as const,
  budget: { total: 150000, capital: 100000, expense: 50000, labor_capital: 100000, labor_expense: 50000, nonlabor_capital: 0, nonlabor_expense: 0 },
  actual: { total: 2500, capital: 2000, expense: 500, labor_capital: 2000, labor_expense: 500, nonlabor_capital: 0, nonlabor_expense: 0 },
  forecast: { total: 140000, capital: 95000, expense: 45000, labor_capital: 95000, labor_expense: 45000, nonlabor_capital: 0, nonlabor_expense: 0 },
  analysis: { budget_remaining: 10000, forecast_variance: 10000, budget_utilization_percentage: 1.67, forecast_to_budget_percentage: 93.3 },
}

const adminStore = () =>
  createTestStore({
    auth: { user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] }, token: 't', isAuthenticated: true },
  })

describe('PortfolioDetailPage financials', () => {
  beforeEach(() => {
    vi.mocked(portfoliosApi.get).mockResolvedValue(portfolio as any)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue([
      { id: 'pg1', name: 'Platform', portfolio_id: 'pf1' } as any,
    ])
    vi.mocked(forecastApi.getPortfolioForecast).mockResolvedValue(portfolioForecast as any)
  })

  it('renders the financials panel from the portfolio forecast', async () => {
    render(<PortfolioDetailPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('North Star')).toBeInTheDocument())
    // The portfolio-total forecast endpoint is used when no program is selected
    await waitFor(() => expect(forecastApi.getPortfolioForecast).toHaveBeenCalledWith('pf1', expect.any(String)))
    // The drill-down "Program" selector is present
    expect(screen.getByLabelText('Program')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/portfolios/PortfolioDetailPage.financials.test.tsx`
Expected: FAIL — `getPortfolioForecast` is never called and there is no `Program` selector yet.

- [ ] **Step 3: Add imports**

In `frontend/src/pages/portfolios/PortfolioDetailPage.tsx`, extend the MUI import block to include `Autocomplete`, `Switch`, `FormControlLabel` (add them to the existing `from '@mui/material'` list), and add these module imports after the existing `portfoliosApi` import:

```tsx
import { projectsApi } from '../../api/projects'
import { phasesApi } from '../../api/phases'
import { getPortfolioForecast, getProgramForecast, getProjectForecast } from '../../api/forecast'
import { transformForecastData, LaborToggle } from '../../utils/forecastTransform'
import { nextToggleState } from '../projects/laborToggle'
import { FinancialSummaryTable } from '../../components/portfolio/FinancialSummaryTable'
import ChartSection from '../../components/portfolio/ChartSection'
```

- [ ] **Step 4: Add drill-down + forecast state and queries**

In `frontend/src/pages/portfolios/PortfolioDetailPage.tsx`, right after the existing `programs` query (ends ~line 72), add:

```tsx
  // Financials drill-down state
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const [toggle, setToggle] = useState<LaborToggle>({ laborOn: true, nonlaborOn: true })

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Projects for the selected program (drill-down tier 2)
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'program', selectedProgramId],
    queryFn: () => projectsApi.list({ program_id: selectedProgramId!, limit: 1000 }),
    enabled: !!selectedProgramId,
  })
  const drilldownProjects = projectsData?.items || []

  // Phases for the selected project (drill-down tier 3)
  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ['phases', selectedProjectId],
    queryFn: () => phasesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  })
  const drilldownPhases = phasesData || []

  // Forecast scoped to the current drill-down selection
  const { data: forecastData, isLoading: forecastLoading, error: forecastError } = useQuery({
    queryKey: ['forecast', 'portfolio', id, selectedProgramId, selectedProjectId, selectedPhaseId, today],
    queryFn: async () => {
      if (selectedProjectId) {
        return await getProjectForecast(selectedProjectId, today, selectedPhaseId)
      }
      if (selectedProgramId) {
        return await getProgramForecast(selectedProgramId, today)
      }
      return await getPortfolioForecast(id!, today)
    },
    enabled: !!id,
  })

  const financialTableData = useMemo(() => {
    if (!forecastData) return null
    return transformForecastData(forecastData, toggle)
  }, [forecastData, toggle])

  const handleProgramChange = (programId: string | null) => {
    setSelectedProgramId(programId)
    setSelectedProjectId(null)
    setSelectedPhaseId(null)
  }
  const handleProjectChange = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedPhaseId(null)
  }
```

> Also ensure `useMemo` is imported from `react` (change `import React, { useState } from 'react'` to `import React, { useState, useMemo } from 'react'`).

- [ ] **Step 5: Wrap the details Paper into a split view and add the financials panel**

In the render, wrap the existing Portfolio Info `Paper` (the block starting `{/* Portfolio Info Section */}` with `<Paper sx={{ p: 2, mb: 2 }}>`) so it becomes the left column of a two-column grid, and add the financials panel as the right column. Replace the opening of that section:

Find:
```tsx
      {/* Portfolio Info Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
```
Replace with:
```tsx
      {/* Details + Financials split view */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
      {/* Portfolio Info Section */}
      <Paper sx={{ p: 2, height: '100%' }}>
```

Then find the matching closing `</Paper>` that ends the Portfolio Info Section (the one immediately before `{/* Programs Section */}`) and replace it with:
```tsx
      </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 1.5, height: '100%' }}>
            {/* Drill-down filters: scope financials to a program / project / phase */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Autocomplete
                size="small"
                sx={{ flex: 1, minWidth: 140 }}
                options={programs}
                getOptionLabel={(option) => option.name}
                value={programs.find((p) => p.id === selectedProgramId) || null}
                onChange={(_, newValue) => handleProgramChange(newValue?.id || null)}
                renderInput={(params) => <TextField {...params} label="Program" placeholder="All" />}
              />
              <Autocomplete
                size="small"
                sx={{ flex: 1, minWidth: 140 }}
                options={drilldownProjects}
                getOptionLabel={(option) => option.name}
                value={drilldownProjects.find((p) => p.id === selectedProjectId) || null}
                onChange={(_, newValue) => handleProjectChange(newValue?.id || null)}
                disabled={!selectedProgramId}
                renderInput={(params) => <TextField {...params} label="Project" placeholder="All" />}
              />
              <Autocomplete
                size="small"
                sx={{ flex: 1, minWidth: 140 }}
                options={drilldownPhases}
                getOptionLabel={(option) => option.name}
                value={drilldownPhases.find((p) => p.id === selectedPhaseId) || null}
                onChange={(_, newValue) => setSelectedPhaseId(newValue?.id || null)}
                loading={phasesLoading}
                disabled={!selectedProjectId || phasesLoading}
                renderInput={(params) => <TextField {...params} label="Phase" placeholder="All" />}
              />
              <Box sx={{ display: 'flex', ml: 'auto' }}>
                <FormControlLabel
                  control={<Switch size="small" checked={toggle.laborOn} onChange={() => setToggle(nextToggleState(toggle, 'labor'))} />}
                  label="Labor"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={toggle.nonlaborOn} onChange={() => setToggle(nextToggleState(toggle, 'nonlabor'))} />}
                  label="Non-Labor"
                />
              </Box>
            </Box>
            <FinancialSummaryTable
              compact
              data={financialTableData}
              loading={forecastLoading}
              error={forecastError ? new Error('Failed to load financial data') : null}
            />
            <ChartSection compact data={financialTableData} />
          </Paper>
        </Grid>
      </Grid>
```

> The MUI `Autocomplete` renders its input with an accessible label matching the `TextField label` ("Program"/"Project"/"Phase"), which is what the Step 1 test queries via `getByLabelText('Program')`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/portfolios/PortfolioDetailPage.financials.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the existing Portfolio detail tests (regression)**

Run: `cd frontend && npx vitest run src/pages/portfolios/PortfolioDetailPage.test.tsx src/pages/portfolios/PortfolioDetailPage.conflict.test.tsx`
Expected: same pass/fail profile as before this branch (the split-view wrap keeps the Details fields and edit controls intact). Note any pre-existing failures; do not fix out-of-scope debt.

- [ ] **Step 8: Type-check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/portfolios/PortfolioDetailPage.tsx frontend/src/pages/portfolios/PortfolioDetailPage.financials.test.tsx
git commit -m "feat(portfolios): add financials section with program/project/phase drill-down"
```

---

## Final Verification (after all tasks)

- [ ] Backend: `docker exec planner-app python -m pytest tests/unit/test_forecasting_reporting.py tests/integration/test_reports_api.py -q` → green (no new failures vs. documented pre-existing debt).
- [ ] Frontend: `cd frontend && npx vitest run src/pages/portfolios/` → green.
- [ ] `cd frontend && npx tsc --noEmit | wc -l` → `234`.
- [ ] Manual smoke (optional): open a portfolio detail page — the financials panel shows the portfolio total; selecting a Program scopes to that program (calls the program endpoint), then Project, then Phase; the Labor/Non-Labor switches change the figures; the Programs table still renders below.
```
