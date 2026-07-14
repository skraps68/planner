"""Integration tests for the ForecastData four-way labor/non-labor breakdown.

Covers:
  (a) to_dict() emits 7 keys per series (total/capital/expense + the 4 new
      labor_capital/labor_expense/nonlabor_capital/nonlabor_expense) and the
      derived capital/expense reconcile against the labor+nonlabor halves.
  (b) actual routing: a labor actual and a non-labor actual land in the right
      buckets with exact values.
  (c) forecast routing: future assignments for a labor resource (worker-rate
      path) and a non-labor resource (default $500/day path) route correctly.
  (d) budget 4-way matches the four ProjectPhase budget columns exactly.
  (e) program-level aggregation sums the four-way keys across two projects.

No shared `project_with_phase_budget` fixture exists in this repo yet, so this
builds a local in-memory sqlite fixture, following the pattern in
tests/integration/test_actuals_service_split.py (Portfolio -> Program ->
Project chain, WorkerType/Worker/Rate, LABOR/NON_LABOR Resource builders).
"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.models.resource_assignment import ResourceAssignment
from app.models.rate import Rate
from app.models.actual import Actual

from app.services.forecasting import forecasting_service


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def _make_portfolio_program(db, name_suffix):
    portfolio = Portfolio(
        name=f"Portfolio {name_suffix}",
        description="Test portfolio",
        owner="owner",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    db.add(portfolio)
    db.flush()

    program = Program(
        portfolio_id=portfolio.id,
        name=f"Program {name_suffix}",
        business_sponsor="sponsor",
        program_manager="manager",
        technical_lead="lead",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(program)
    db.flush()
    return program


def _make_project(db, program, cost_center_code):
    project = Project(
        program_id=program.id,
        name=f"Project {cost_center_code}",
        business_sponsor="s",
        project_manager="m",
        technical_lead="t",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        cost_center_code=cost_center_code,
    )
    db.add(project)
    db.flush()
    return project


def _make_labor_resource(db, suffix, rate_amount=Decimal("1000.00")):
    """Build a LABOR resource wired to a Worker/WorkerType/Rate."""
    worker_type = WorkerType(type=f"Engineer-{suffix}", description="Engineer")
    db.add(worker_type)
    db.flush()

    rate = Rate(
        worker_type_id=worker_type.id,
        rate_amount=rate_amount,
        start_date=date(2026, 1, 1),
        end_date=None,
    )
    db.add(rate)

    worker = Worker(
        external_id=f"EMP-{suffix}",
        name=f"Worker {suffix}",
        worker_type_id=worker_type.id,
    )
    db.add(worker)
    db.flush()

    resource = Resource(
        name=f"Labor Resource {suffix}",
        resource_type=ResourceType.LABOR,
        worker_id=worker.id,
    )
    db.add(resource)
    db.flush()
    return SimpleNamespace(resource=resource, worker=worker, worker_type=worker_type, rate=rate)


def _make_nonlabor_resource(db, suffix):
    resource = Resource(name=f"Non-Labor Resource {suffix}", resource_type=ResourceType.NON_LABOR, worker_id=None)
    db.add(resource)
    db.flush()
    return resource


@pytest.fixture()
def full_setup(db_session):
    """One project with a fully-budgeted phase, one labor + one non-labor
    actual (in the past), and one labor + one non-labor future assignment.
    """
    db = db_session
    program = _make_portfolio_program(db, "A")
    project = _make_project(db, program, "CC-FOURWAY-1")

    phase = ProjectPhase(
        project_id=project.id,
        name="Phase 1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        labor_capital_budget=Decimal("6000.00"),
        labor_expense_budget=Decimal("4000.00"),
        nonlabor_capital_budget=Decimal("3000.00"),
        nonlabor_expense_budget=Decimal("2000.00"),
        total_budget=Decimal("15000.00"),
    )
    db.add(phase)
    db.flush()

    labor = _make_labor_resource(db, "1", rate_amount=Decimal("1000.00"))
    nonlabor_resource = _make_nonlabor_resource(db, "1")

    as_of_date = date(2026, 6, 1)

    # Past actuals (before as_of_date) - one labor, one non-labor.
    labor_actual = Actual(
        project_id=project.id,
        resource_id=labor.resource.id,
        external_worker_id=labor.worker.external_id,
        worker_name=labor.worker.name,
        actual_date=date(2026, 2, 1),
        allocation_percentage=Decimal("100.00"),
        actual_cost=Decimal("500.00"),
        capital_amount=Decimal("300.00"),
        expense_amount=Decimal("200.00"),
    )
    db.add(labor_actual)

    nonlabor_actual = Actual(
        project_id=project.id,
        resource_id=nonlabor_resource.id,
        external_worker_id=None,
        worker_name=None,
        actual_date=date(2026, 2, 1),
        allocation_percentage=None,
        actual_cost=Decimal("500.00"),
        capital_amount=Decimal("150.00"),
        expense_amount=Decimal("350.00"),
    )
    db.add(nonlabor_actual)
    db.flush()

    # Future assignments (after as_of_date) - one labor, one non-labor.
    labor_assignment = ResourceAssignment(
        resource_id=labor.resource.id,
        project_id=project.id,
        assignment_date=date(2026, 7, 1),
        capital_percentage=Decimal("60.00"),
        expense_percentage=Decimal("40.00"),
    )
    db.add(labor_assignment)

    nonlabor_assignment = ResourceAssignment(
        resource_id=nonlabor_resource.id,
        project_id=project.id,
        assignment_date=date(2026, 7, 1),
        capital_percentage=Decimal("70.00"),
        expense_percentage=Decimal("30.00"),
    )
    db.add(nonlabor_assignment)
    db.commit()

    return SimpleNamespace(
        project=project,
        phase=phase,
        labor=labor,
        nonlabor_resource=nonlabor_resource,
        labor_actual=labor_actual,
        nonlabor_actual=nonlabor_actual,
        labor_assignment=labor_assignment,
        nonlabor_assignment=nonlabor_assignment,
        as_of_date=as_of_date,
    )


@pytest.fixture()
def project_with_phase_budget(full_setup):
    """Alias fixture matching the name referenced by the task brief's test."""
    return full_setup.project


def test_to_dict_has_seven_keys_per_series(db_session, project_with_phase_budget, full_setup):
    fd = forecasting_service.calculate_project_forecast(
        db_session, project_with_phase_budget.id, as_of_date=full_setup.as_of_date
    )
    d = fd.to_dict()
    for series in ("budget", "actual", "forecast"):
        for key in ("total", "capital", "expense", "labor_capital", "labor_expense", "nonlabor_capital", "nonlabor_expense"):
            assert key in d[series], f"{series}.{key} missing"
        # labor+nonlabor sub-fields reconcile to capital/expense
        assert d[series]["capital"] == d[series]["labor_capital"] + d[series]["nonlabor_capital"]
        assert d[series]["expense"] == d[series]["labor_expense"] + d[series]["nonlabor_expense"]


def test_actual_routes_labor_and_nonlabor_by_resource_type(db_session, full_setup):
    fd = forecasting_service.calculate_project_forecast(
        db_session, full_setup.project.id, as_of_date=full_setup.as_of_date
    )
    assert fd.actual_labor_capital == Decimal("300.00")
    assert fd.actual_labor_expense == Decimal("200.00")
    assert fd.actual_nonlabor_capital == Decimal("150.00")
    assert fd.actual_nonlabor_expense == Decimal("350.00")
    assert fd.total_actual == Decimal("1000.00")


def test_forecast_routes_labor_and_nonlabor_by_resource_type(db_session, full_setup):
    fd = forecasting_service.calculate_project_forecast(
        db_session, full_setup.project.id, as_of_date=full_setup.as_of_date
    )
    # Labor: worker rate $1000/day * (60+40)/100 = 1000; capital=600, expense=400
    assert fd.forecast_labor_capital == Decimal("600.00")
    assert fd.forecast_labor_expense == Decimal("400.00")
    # Non-labor: default $500/day path * (70+30)/100 = 500; capital=350, expense=150
    assert fd.forecast_nonlabor_capital == Decimal("350.00")
    assert fd.forecast_nonlabor_expense == Decimal("150.00")
    assert fd.total_forecast == Decimal("1500.00")


def test_budget_four_way_matches_phase_columns_exactly(db_session, full_setup):
    fd = forecasting_service.calculate_project_forecast(
        db_session, full_setup.project.id, as_of_date=full_setup.as_of_date
    )
    phase = full_setup.phase
    assert fd.budget_labor_capital == phase.labor_capital_budget
    assert fd.budget_labor_expense == phase.labor_expense_budget
    assert fd.budget_nonlabor_capital == phase.nonlabor_capital_budget
    assert fd.budget_nonlabor_expense == phase.nonlabor_expense_budget
    assert fd.total_budget == phase.total_budget


def test_program_level_aggregates_four_way_across_projects(db_session):
    db = db_session
    program = _make_portfolio_program(db, "B")
    project1 = _make_project(db, program, "CC-PROG-1")
    project2 = _make_project(db, program, "CC-PROG-2")

    phase1 = ProjectPhase(
        project_id=project1.id,
        name="Phase 1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        labor_capital_budget=Decimal("1000.00"),
        labor_expense_budget=Decimal("500.00"),
        nonlabor_capital_budget=Decimal("300.00"),
        nonlabor_expense_budget=Decimal("200.00"),
        total_budget=Decimal("2000.00"),
    )
    phase2 = ProjectPhase(
        project_id=project2.id,
        name="Phase 1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        labor_capital_budget=Decimal("2000.00"),
        labor_expense_budget=Decimal("1000.00"),
        nonlabor_capital_budget=Decimal("600.00"),
        nonlabor_expense_budget=Decimal("400.00"),
        total_budget=Decimal("4000.00"),
    )
    db.add(phase1)
    db.add(phase2)
    db.commit()

    fd = forecasting_service.calculate_program_forecast(
        db, program.id, as_of_date=date(2026, 6, 1)
    )

    assert fd.budget_labor_capital == Decimal("3000.00")
    assert fd.budget_labor_expense == Decimal("1500.00")
    assert fd.budget_nonlabor_capital == Decimal("900.00")
    assert fd.budget_nonlabor_expense == Decimal("600.00")
    assert fd.total_budget == Decimal("6000.00")

    d = fd.to_dict()
    assert d["budget"]["labor_capital"] == 3000.00
    assert d["budget"]["nonlabor_expense"] == 600.00
    assert d["budget"]["capital"] == d["budget"]["labor_capital"] + d["budget"]["nonlabor_capital"]


def test_to_dict_legacy_nine_param_construction_keeps_capital_expense():
    """Test that legacy callers passing only the 9 original params get their
    capital/expense preserved in to_dict() via fallback.
    """
    from uuid import uuid4

    # Construct ForecastData with only the original 9 params (no four-way)
    entity_id = uuid4()
    fd = ForecastData(
        entity_id=entity_id,
        entity_name="Test Entity",
        entity_type="project",
        total_budget=Decimal("100"),
        capital_budget=Decimal("70"),
        expense_budget=Decimal("30"),
        total_actual=Decimal("0"),
        capital_actual=Decimal("0"),
        expense_actual=Decimal("0"),
        total_forecast=Decimal("0"),
        capital_forecast=Decimal("0"),
        expense_forecast=Decimal("0"),
        # Four-way params all default to zero
    )

    # Verify the ForecastData object has the legacy values stored
    assert fd.capital_budget == Decimal("70")
    assert fd.expense_budget == Decimal("30")
    assert fd.total_budget == Decimal("100")

    # Verify the four-way keys are all zero (defaults)
    assert fd.budget_labor_capital == Decimal("0.00")
    assert fd.budget_labor_expense == Decimal("0.00")
    assert fd.budget_nonlabor_capital == Decimal("0.00")
    assert fd.budget_nonlabor_expense == Decimal("0.00")
    assert fd.actual_labor_capital == Decimal("0.00")
    assert fd.actual_labor_expense == Decimal("0.00")
    assert fd.actual_nonlabor_capital == Decimal("0.00")
    assert fd.actual_nonlabor_expense == Decimal("0.00")
    assert fd.forecast_labor_capital == Decimal("0.00")
    assert fd.forecast_labor_expense == Decimal("0.00")
    assert fd.forecast_nonlabor_capital == Decimal("0.00")
    assert fd.forecast_nonlabor_expense == Decimal("0.00")

    # Call to_dict() and verify the fallback emits the legacy values
    d = fd.to_dict()
    assert d["budget"]["capital"] == 70.0, "Budget capital should be 70.0 from legacy param"
    assert d["budget"]["expense"] == 30.0, "Budget expense should be 30.0 from legacy param"
    assert d["budget"]["total"] == 100.0, "Budget total should be 100.0"

    # Verify the four-way keys are still 0.0
    assert d["budget"]["labor_capital"] == 0.0
    assert d["budget"]["labor_expense"] == 0.0
    assert d["budget"]["nonlabor_capital"] == 0.0
    assert d["budget"]["nonlabor_expense"] == 0.0

    # Verify the same for actual and forecast (which are all zero)
    assert d["actual"]["capital"] == 0.0
    assert d["actual"]["expense"] == 0.0
    assert d["forecast"]["capital"] == 0.0
    assert d["forecast"]["expense"] == 0.0
