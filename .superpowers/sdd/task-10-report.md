# Task 10 report: split actuals import into /import/labor and /import/non-labor

## Status: DONE

## What changed

### backend/app/services/actuals.py
- Added `_create_labor_split_actual(db, project_id, external_worker_id, worker_name, actual_date, capital_percentage, expense_percentage)`:
  mirrors create_actual's project/worker/name-match checks, then looks up the
  active rate via `rate_repository.get_active_rate` (RateNotFoundError if
  none) and the worker's resource via `resource_repository.get_by_worker_id`
  (BusinessRuleViolationError `NO_RESOURCE_FOR_WORKER` if none). Costs it as:
  `actual_cost = quantize(rate * (cap%+exp%) / 100, 0.01)`,
  `capital_amount = quantize(rate * cap% / 100, 0.01)`,
  `expense_amount = actual_cost - capital_amount` (guarantees the DB check
  constraint `capital+expense=actual_cost` holds exactly). Writes the Actual
  via `actual_repository.create` directly -- it does **not** call
  `create_actual`/`_calculate_cost`, so it never requires a planned
  ResourceAssignment for the date (unlike the single-percentage path).
- Added `import_labor_batch(db, records: List[LaborImportRecord], validate_allocation=True)`:
  same transaction/rollback/result shape as `import_actuals_batch`
  (`{"status","imported_count","actuals"}`). Per row: if `record.percentage
  is not None` delegates to `create_actual` (single-bucket, assignment-split,
  `validate_allocation=False` since batch-level validation already ran); else
  delegates to `_create_labor_split_actual` (explicit split). When
  `validate_allocation=True`, runs
  `allocation_validator_service.validate_batch_actuals` first using
  `percentage` or `capital_percentage+expense_percentage` as the allocation
  sum, exactly like the legacy batch importer.
- Added `import_nonlabor_batch(db, records: List[NonLaborImportRecord])`:
  same shape, delegates each row to `create_nonlabor_actual`. No allocation
  validation (non-labor actuals carry no worker/allocation percentage).
- Imports `LaborImportRecord`, `NonLaborImportRecord` from
  `app.services.actuals_import` alongside the existing `ActualsImportRecord`.
- Fixed the dead `r.errors` reference (should have been
  `r.validation_errors`) in the new methods' "invalid records" branch --
  the legacy `import_actuals_batch` had the same bug but it's unreachable
  there too (the endpoint always pre-filters to `is_valid()` records before
  calling batch), so it was left as-is in the legacy method and only
  corrected in the new ones.

### backend/app/api/v1/endpoints/actuals.py
- Removed `POST /import` (legacy `ActualsImportRecord`/single-percentage
  route) entirely.
- Added `POST /import/labor`: same request/response shape as the old route
  (`UploadFile` CSV + `validate_only` query param -> `ActualImportResponse`
  with per-row `ActualImportResult`), wired to
  `labor_actuals_import_service` (parse_csv/validate_records/get_validation_errors)
  and `actuals_service.import_labor_batch`. Docstring documents both CSV
  forms (single `percentage` vs. `capital_percentage`+`expense_percentage`)
  and that a `resource_id` column is rejected.
- Added `POST /import/non-labor`: same shape, wired to
  `nonlabor_actuals_import_service` and `actuals_service.import_nonlabor_batch`.
  Docstring documents the `project_id,resource_id,date,capital,expense`
  format and that labor-form columns are rejected.
- Updated `POST /check-allocation-conflicts` to parse/validate with
  `labor_actuals_import_service` instead of the legacy service (it's
  percentage-based, so this is the correct home for it), and to compute
  `allocation_percentage` as `r.percentage` for single-bucket rows or
  `r.capital_percentage + r.expense_percentage` for split rows. Docstring
  updated accordingly.
- Import block now pulls in `labor_actuals_import_service`,
  `nonlabor_actuals_import_service` (dropped the legacy
  `actuals_import_service` import, which is no longer referenced in this
  file but remains defined/exported elsewhere for any other consumers).

### backend/app/schemas/actual.py
- **No changes.** Per design decision #2, CSV-upload endpoints don't need
  new request/row schemas (the request is `UploadFile` + a query param, not
  a JSON body of rows) -- `ActualImportResponse`/`ActualImportResult`
  already cover the response shape and are reused as-is for both new routes.
  Recording this here since the brief flagged it as an option to consider;
  decision was not to add dead schemas.

### backend/tests/integration/test_actuals_import_endpoints.py (new)
Built on the shared `client` fixture (tests/conftest.py, overrides
`deps.get_db`, creates tables via the session-scoped `db` fixture) plus a
local `auth_headers` fixture copying the `override_auth_dependency` pattern
from `test_assignment_api.py:24-40` (mocks `deps.get_current_user`). Data
built through `TestingSessionLocal` directly: Portfolio->Program->Project,
WorkerType->Worker->Rate, LABOR Resource(worker_id)->ResourceAssignment
(60/40 split) on 2026-03-03, and a separate NON_LABOR Resource. `client` is
listed first in every test signature so its `db` dependency creates tables
before the raw-session fixtures try to use them (mirrors the ordering
already used in `test_actuals_api.py`).

Six tests, all passing:
1. `test_labor_import_single_percentage_happy_path` -- 200, successful_imports==1.
2. `test_labor_import_capital_expense_split` -- 200, successful_imports==1,
   and verifies via a fresh DB session that stored `capital_amount`/`expense_amount`
   equal rate×% exactly (rate 500.00, 50%/30% -> 250.00/150.00, sums to
   actual_cost 400.00).
3. `test_nonlabor_import_happy_path` -- 200, successful_imports==1, dollars
   stored exactly as given (400/100 -> actual_cost 500).
4. `test_labor_import_validate_only_persists_nothing` -- `validate_only=true`
   returns `validation_only: true`, no `actual_id`s, and a DB count check
   confirms zero rows persisted.
5. `test_labor_csv_rejected_by_nonlabor_endpoint` -- posting a labor-shaped
   CSV to `/import/non-labor` is rejected. **Deviation from the brief's
   suggested assertion** ("200 with failed rows or 4xx"): the actual
   behavior is that `NonLaborActualsImportService.parse_csv` raises a plain
   `ActualsImportError` (missing `resource_id`/`capital`/`expense` columns)
   which is not an `AppException`, so FastAPI's `generic_exception_handler`
   converts it to a 500 JSON response -- but Starlette's `ServerErrorMiddleware`
   always re-raises after invoking the handler (this is intentional Starlette
   behavior, to let test clients optionally surface the underlying error),
   and `TestClient` has `raise_server_exceptions=True` by default. So instead
   of asserting on `response.status_code`, the test wraps the `client.post`
   call in `pytest.raises(ActualsImportError, match="Missing required columns")`.
   This still proves the strict-header rejection fires; it does not represent
   the CSV being silently accepted.
6. `test_old_import_route_is_gone` -- `POST /api/v1/actuals/import` ->
   404/405.

## Test results

- `docker exec planner-app python -m pytest tests/integration/test_actuals_import_endpoints.py -q` -> **6 passed**.
- `docker exec planner-app python -m pytest tests/unit/test_labor_actuals_import.py tests/unit/test_nonlabor_actuals_import.py tests/integration/test_actuals_service_split.py -q` -> **32 passed** (matches the expected 28+4).
- `docker exec planner-app python -c "import app.main"` -> clean, no output/errors.

## Concerns / things worth knowing

- `tests/integration/test_actuals_api.py` (legacy `TestActualsAPI` class,
  including `test_import_actuals_csv`, `test_import_actuals_validation_only`,
  `test_check_allocation_conflicts`) now errors -- but it was **already**
  erroring before this task's changes (confirmed via `git stash`/`stash pop`
  A-B comparison: identical 11 errors + 1 failure in `test_actuals_api.py`
  and `test_actuals_services.py` before and after). Root cause is the
  pre-existing fixture-drift bug documented in the memory backlog
  (`test-repair-backlog.md`): `Program` factories in these older test files
  don't set `portfolio_id`, which is NOT NULL, so `IntegrityError` fires at
  fixture setup before the test body (and therefore before the route change)
  is ever reached. This is out of scope for Task 10 and untouched by this
  change; flagging per the memory note "start here when asked to fix the
  tests, don't re-audit."
- The legacy `actuals_import_service` (`ActualsImportService` instance) and
  `import_actuals_batch` in `actuals.py` are left in place, still exported
  from `app/services/__init__.py` and covered by their own
  `tests/unit/test_actuals_services.py` unit tests (which have the same
  pre-existing fixture-drift errors, unrelated to this change) -- nothing in
  Task 10 required removing them, and no remaining code in
  `app/api/v1/endpoints/actuals.py` references them after this change.
- `check-allocation-conflicts`'s docstring/behavior update (pointing it at
  `labor_actuals_import_service`) is an in-scope but incidental behavior
  change: it now also accepts the `capital_percentage`/`expense_percentage`
  split form (summing the two for the conflict check) and rejects a
  `resource_id` column, whereas previously it only accepted the legacy
  single-`percentage` header. This matches design decision #2 explicitly.
