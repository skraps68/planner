# Portfolio Financials Section — Design

**Date:** 2026-07-21
**Status:** Agreed design (brainstormed & confirmed 2026-07-21), not yet implemented. Build on a **new branch** off `main`.
**Scope:** Full-stack — add the same Budget vs. Actual vs. Forecast "financials section" that the Program and Project detail pages already have to the **Portfolio detail page**, aggregating across the portfolio's programs and their projects, with a full program → project → phase drill-down.

---

## 1. Goal

The Program and Project detail pages each render a financials panel — a `FinancialSummaryTable` + a `ChartSection`, fed by a forecast API and scoped by a drill-down and a Labor/Non-Labor toggle. The Portfolio detail page has no financials at all. Give the Portfolio page the **same** section, aggregated over the whole portfolio, matching the other two pages' "Details + Financials split view" layout, with a drill-down one level deeper (program → project → phase).

## 2. Decisions locked during brainstorming

- **Target:** the Portfolio detail page (`frontend/src/pages/portfolios/PortfolioDetailPage.tsx`).
- **Drill-down depth:** full **program → project → phase** cascading selectors (one level deeper than the Program page).
- **Layout:** restructure the Portfolio page into the same **Details + Financials split view** the Program/Project pages use, for cross-page consistency.

## 3. How the existing sections work (reference)

- Financials panel = `components/portfolio/FinancialSummaryTable` + `components/portfolio/ChartSection` (`compact`).
- Data comes from `api/forecast.ts`: `getProgramForecast(id, asOfDate)` and `getProjectForecast(id, asOfDate, phaseId?)`, both returning `ForecastApiResponse` (`budget`/`actual`/`forecast` four-way category breakdowns + `analysis`).
- `utils/forecastTransform.transformForecastData(data, toggle)` applies the Labor/Non-Labor toggle and produces the table/chart data. It is **generic over the forecast response** — no per-entity logic.
- Program page drill-down state: `selectedProjectId`, `selectedPhaseId`, `toggle`; data via `projectsApi.list({program_id})` and `phasesApi.list(projectId)`; the forecast query picks project-vs-program based on selection.

## 4. Backend — the only genuinely new logic

### 4.1 `ForecastingService.calculate_portfolio_forecast`
File: `backend/app/services/forecasting.py`.

- Signature mirrors `calculate_program_forecast`:
  ```python
  def calculate_portfolio_forecast(self, db: Session, portfolio_id: UUID,
                                   as_of_date: Optional[date] = None) -> ForecastData
  ```
- Fetch the portfolio via a new import `from app.repositories.portfolio import portfolio_repository`; raise `ValueError(f"Portfolio with ID {portfolio_id} does not exist")` if missing.
- Iterate `portfolio.programs` (the existing SQLAlchemy relationship the `portfolios.py` endpoints already use), calling `self.calculate_program_forecast(db, program.id, as_of_date)` for each, and **sum the 21 Decimal series** using the identical accumulation block already present in `calculate_program_forecast` (the code comments there explicitly bless reusing this pattern for a portfolio).
- Return `ForecastData(entity_id=portfolio_id, entity_name=portfolio.name, entity_type="portfolio", …all 21 summed series…)`.
- Empty portfolio (no programs) → all-zero `ForecastData` (the loop simply doesn't run), which serializes cleanly.

`ForecastData.to_dict()` serializes `entity_type` verbatim and derives `analysis` from totals, so a `"portfolio"` payload needs **no** changes to `to_dict` or the analysis properties.

### 4.2 Endpoint
File: `backend/app/api/v1/endpoints/reports.py`.

- Add `GET /reports/forecast/portfolio/{portfolio_id}` modeled exactly on `get_program_forecast`: same `as_of_date` query param, same `Depends(get_db)` + `Depends(get_current_user)` auth, calls `calculate_portfolio_forecast(...)`, returns `.to_dict()`, maps `ValueError` → `404`.

### 4.3 Note: sibling validator (out of the hot path)
The separate `get_budget_vs_actual_vs_forecast` method validates `entity_type in ["project", "program"]`. The new forecast endpoint does **not** route through it, so no change is required. Extending that validator to accept `"portfolio"` is optional future work and is **out of scope** here.

## 5. Frontend

### 5.1 `api/forecast.ts`
- Widen `ForecastApiResponse.entity_type` to `'project' | 'program' | 'portfolio'`.
- Add `getPortfolioForecast(portfolioId: string, asOfDate: string): Promise<ForecastApiResponse>` hitting `/reports/forecast/portfolio/${portfolioId}` with `{ as_of_date }` — a direct analogue of `getProgramForecast`.

### 5.2 `PortfolioDetailPage.tsx`
Restructure into the Details + Financials split view (mirroring `ProgramDetailPage`), and add the financials panel.

- **New state:** `selectedProgramId`, `selectedProjectId`, `selectedPhaseId` (all `string | null`), and `toggle: LaborToggle` (`{ laborOn: true, nonlaborOn: true }`).
- **Data sources** (only the top tier is new):
  - Programs: `portfoliosApi.getPrograms(id)` — **already fetched on this page**.
  - Projects for the selected program: `projectsApi.list({ program_id: selectedProgramId, limit: 1000 })`, enabled when a program is selected.
  - Phases for the selected project: `phasesApi.list(selectedProjectId)`, enabled when a project is selected.
- **Forecast query cascade** (React Query key includes all selections + `today`) — the new endpoint is only hit at the portfolio-total level; drilling in reuses the existing endpoints:
  - `selectedPhaseId` → `getProjectForecast(selectedProjectId, today, selectedPhaseId)`
  - else `selectedProjectId` → `getProjectForecast(selectedProjectId, today)`
  - else `selectedProgramId` → `getProgramForecast(selectedProgramId, today)`
  - else → `getPortfolioForecast(id, today)` ← **new**
- **Transform + render:** `transformForecastData(forecastData, toggle)` → `FinancialSummaryTable` + `ChartSection compact` + the Labor/Non-Labor toggle, plus **three cascading selectors** (Program → Project → Phase).
- **Cascade reset semantics:** selecting a program clears `selectedProjectId` and `selectedPhaseId`; selecting a project clears `selectedPhaseId`. Each selector offers an "All …" option that clears that tier (and deeper tiers), returning the panel to the parent scope.

### 5.3 No new presentational code
`FinancialSummaryTable`, `ChartSection`, and `transformForecastData` are reused unchanged.

## 6. Data flow

```
Portfolio page
  ├─ Details (left)          ── existing portfolio fields
  └─ Financials (right)
       selectors: [Program ▾][Project ▾][Phase ▾]   toggle: [Labor][Non-Labor]
       → forecast cascade (portfolio | program | project | project+phase)
       → transformForecastData(data, toggle)
       → FinancialSummaryTable + ChartSection(compact)
  [ Programs table below, as today ]
```

## 7. Testing strategy (full cases in the plan)

- **Backend:**
  - Service: a portfolio with two programs (each with projects) equals the sum of the two program forecasts, including the four-way labor/non-labor series; empty-portfolio → all zeros; unknown id → `ValueError`.
  - Endpoint: `200` with `entity_type == "portfolio"` and summed totals; `404` for a missing portfolio; auth required.
- **Frontend:**
  - Financials panel renders `FinancialSummaryTable` + chart from a mocked `getPortfolioForecast`.
  - Drill-down cascade selects the correct endpoint at each tier (portfolio → program → project → phase) and resets deeper selections.
  - Labor/Non-Labor toggle changes the rendered figures.
  - Type budget (`cd frontend && npx tsc --noEmit | wc -l`) stays at its current baseline (**234**); no net-new type errors.

## 8. Challenges / risks

1. **New backend method + endpoint.** Low risk — the summation pattern is pre-authorized in `calculate_program_forecast`'s comments and reused verbatim; `to_dict`/`analysis` already generic.
2. **Programs source.** Use the existing `portfolio.programs` relationship (no new repository method); requires importing `portfolio_repository` into the forecasting service.
3. **`entity_type` literal.** Extend the frontend union to include `'portfolio'`. The backend `to_dict` needs no change; the sibling `get_budget_vs_actual_vs_forecast` validator is out of the hot path and left unchanged (noted, out of scope).
4. **Performance.** A portfolio forecast recomputes every project forecast across every program (nested summation over all assignments) — N× heavier than a program forecast. Acceptable for current data sizes; React Query caches by `as_of_date` + selection. Caching child forecasts is flagged as **future** optimization, out of scope.
5. **Layout churn.** Restructuring `PortfolioDetailPage` into the split view is the largest single change; the Programs table stays below the split view.
6. **Cascade reset correctness.** The three-tier selector reset logic (program clears project+phase, project clears phase) is the main new UI logic and is covered by tests.

## 9. Out of scope

- Optimizing portfolio-forecast performance (memoizing child forecasts server-side).
- Extending the `get_budget_vs_actual_vs_forecast` report method / other report surfaces to portfolios.
- Any change to the Program/Project financials sections or the shared components.
- Filtering/permission changes beyond reusing the existing `get_current_user` auth on the new endpoint.
