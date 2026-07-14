"""Integration tests for Task 12: reporting four-way aggregation + variance
labor-only guard.

Covers:
  (a) get_multi_project_report's "aggregated_summary" carries the four new
      labor_capital/labor_expense/nonlabor_capital/nonlabor_expense keys per
      series (budget/actual/forecast), summed across projects.
  (b) variance_analysis_service.get_variance_summary does not crash when a
      project has a non-labor actual (NULL external_worker_id/allocation).
  (c) variance analysis considers labor actuals only: a project with one
      labor actual and one non-labor actual on the same (otherwise
      unplanned) date reports the unplanned_work variance once, not twice.

No shared `program_with_projects` / `project_with_nonlabor_actual` fixtures
exist in this repo yet, so this builds local in-memory sqlite fixtures,
following the pattern in tests/integration/test_forecast_four_way.py
(Portfolio -> Program -> Project chain, WorkerType/Worker/Rate,
LABOR/NON_LABOR Resource builders).
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
from app.models.rate import Rate
from app.models.actual import Actual

from app.services.reporting import reporting_service
from app.services.variance_analysis import variance_analysis_service


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
def program_with_projects(db_session):
    """A program with two projects, each with a fully four-way-budgeted phase."""
    db = db_session
    program = _make_portfolio_program(db, "REPORT")
    project1 = _make_project(db, program, "CC-RPT-1")
    project2 = _make_project(db, program, "CC-RPT-2")

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

    return SimpleNamespace(program=program, projects=[project1, project2])


@pytest.fixture()
def project_with_nonlabor_actual(db_session):
    """A project with a single non-labor actual (NULL worker fields)."""
    db = db_session
    program = _make_portfolio_program(db, "NLA")
    project = _make_project(db, program, "CC-NLA-1")

    phase = ProjectPhase(
        project_id=project.id,
        name="Phase 1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        labor_capital_budget=Decimal("0.00"),
        labor_expense_budget=Decimal("0.00"),
        nonlabor_capital_budget=Decimal("600.00"),
        nonlabor_expense_budget=Decimal("400.00"),
        total_budget=Decimal("1000.00"),
    )
    db.add(phase)
    db.flush()

    nonlabor_resource = _make_nonlabor_resource(db, "NLA-1")

    nonlabor_actual = Actual(
        project_id=project.id,
        resource_id=nonlabor_resource.id,
        external_worker_id=None,
        worker_name=None,
        actual_date=date(2026, 3, 1),
        allocation_percentage=None,
        actual_cost=Decimal("500.00"),
        capital_amount=Decimal("300.00"),
        expense_amount=Decimal("200.00"),
    )
    db.add(nonlabor_actual)
    db.commit()

    return project


@pytest.fixture()
def project_with_labor_and_nonlabor_actual_same_date(db_session):
    """A project with one labor actual and one non-labor actual on the same
    date, with no matching resource assignment on that date — so a labor-only
    variance analysis should report exactly one unplanned_work variance
    (the non-labor actual must not also produce one)."""
    db = db_session
    program = _make_portfolio_program(db, "MIX")
    project = _make_project(db, program, "CC-MIX-1")

    phase = ProjectPhase(
        project_id=project.id,
        name="Phase 1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        labor_capital_budget=Decimal("600.00"),
        labor_expense_budget=Decimal("400.00"),
        nonlabor_capital_budget=Decimal("300.00"),
        nonlabor_expense_budget=Decimal("200.00"),
        total_budget=Decimal("1500.00"),
    )
    db.add(phase)
    db.flush()

    labor = _make_labor_resource(db, "MIX-1")
    nonlabor_resource = _make_nonlabor_resource(db, "MIX-1")

    shared_date = date(2026, 3, 15)

    labor_actual = Actual(
        project_id=project.id,
        resource_id=labor.resource.id,
        external_worker_id=labor.worker.external_id,
        worker_name=labor.worker.name,
        actual_date=shared_date,
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
        actual_date=shared_date,
        allocation_percentage=None,
        actual_cost=Decimal("500.00"),
        capital_amount=Decimal("300.00"),
        expense_amount=Decimal("200.00"),
    )
    db.add(nonlabor_actual)
    db.commit()

    return project


def test_multi_project_report_has_four_way(db_session, program_with_projects):
    rep = reporting_service.get_multi_project_report(
        db=db_session, project_ids=[p.id for p in program_with_projects.projects])
    for series in ("budget", "actual", "forecast"):
        for key in ("labor_capital", "labor_expense", "nonlabor_capital", "nonlabor_expense"):
            assert key in rep["aggregated_summary"][series]

    # Budgets are known exactly (no actuals/assignments yet) so we can assert
    # the sums reconcile across the two projects.
    budget = rep["aggregated_summary"]["budget"]
    assert budget["labor_capital"] == 3000.00
    assert budget["labor_expense"] == 1500.00
    assert budget["nonlabor_capital"] == 900.00
    assert budget["nonlabor_expense"] == 600.00
    assert budget["capital"] == budget["labor_capital"] + budget["nonlabor_capital"]
    assert budget["expense"] == budget["labor_expense"] + budget["nonlabor_expense"]


def test_variance_ignores_nonlabor_actuals(db_session, project_with_nonlabor_actual):
    # a non-labor actual has NULL external_worker_id and must not crash allocation math
    result = variance_analysis_service.get_variance_summary(
        db=db_session, project_id=project_with_nonlabor_actual.id,
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    assert "summary" in result


def test_variance_analysis_sees_only_labor_actual_on_shared_date(
    db_session, project_with_labor_and_nonlabor_actual_same_date
):
    project = project_with_labor_and_nonlabor_actual_same_date
    result = variance_analysis_service.get_variance_summary(
        db=db_session, project_id=project.id,
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))

    # Only the labor actual should register as unplanned work; the non-labor
    # actual (no external_worker_id) must be filtered out before the
    # allocation-percentage summation, and must not double the count.
    assert result["summary"]["variance_by_type"].get("unplanned_work") == 1
