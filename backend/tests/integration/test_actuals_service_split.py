"""Integration tests for ActualsService labor/non-labor create paths.

Labor actuals now split cost by the worker's resource's *planned*
ResourceAssignment for the given date (rejecting when none exists, instead of
falling back to a 50/50 split). Non-labor actuals are created directly from
dollar amounts with no worker/allocation involved.
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
from app.models.project import Project
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.models.resource_assignment import ResourceAssignment
from app.models.rate import Rate

from app.services.actuals import actuals_service
from app.core.exceptions import BusinessRuleViolationError


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def _make_project(db, cost_center_code):
    """Build real chain: Portfolio -> Program -> Project."""
    portfolio = Portfolio(
        name="P1",
        description="Test portfolio",
        owner="owner",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    db.add(portfolio)
    db.flush()

    program = Program(
        portfolio_id=portfolio.id,
        name="Prog1",
        business_sponsor="sponsor",
        program_manager="manager",
        technical_lead="lead",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(program)
    db.flush()

    project = Project(
        program_id=program.id,
        name="P",
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


@pytest.fixture()
def labor_setup(db_session):
    db = db_session
    project = _make_project(db, "CC-LABOR-SPLIT")

    worker_type = WorkerType(type="Engineer", description="Software Engineer")
    db.add(worker_type)
    db.flush()

    rate = Rate(
        worker_type_id=worker_type.id,
        rate_amount=Decimal("500.00"),
        start_date=date(2026, 1, 1),
        end_date=None,
    )
    db.add(rate)

    worker = Worker(
        external_id="EMP-SPLIT-1",
        name="Alice Example",
        worker_type_id=worker_type.id,
    )
    db.add(worker)
    db.flush()

    resource = Resource(
        name="Alice Example (Resource)",
        resource_type=ResourceType.LABOR,
        worker_id=worker.id,
    )
    db.add(resource)
    db.flush()

    assignment = ResourceAssignment(
        resource_id=resource.id,
        project_id=project.id,
        assignment_date=date(2026, 3, 3),
        capital_percentage=Decimal("60.00"),
        expense_percentage=Decimal("40.00"),
    )
    db.add(assignment)
    db.commit()

    return SimpleNamespace(
        project=project, worker=worker, resource=resource,
        assignment=assignment, rate=rate,
    )


@pytest.fixture()
def labor_setup_no_assignment(db_session):
    db = db_session
    project = _make_project(db, "CC-LABOR-NOASSIGN")

    worker_type = WorkerType(type="Analyst", description="Business Analyst")
    db.add(worker_type)
    db.flush()

    rate = Rate(
        worker_type_id=worker_type.id,
        rate_amount=Decimal("400.00"),
        start_date=date(2026, 1, 1),
        end_date=None,
    )
    db.add(rate)

    worker = Worker(
        external_id="EMP-SPLIT-2",
        name="Bob Example",
        worker_type_id=worker_type.id,
    )
    db.add(worker)
    db.flush()

    resource = Resource(
        name="Bob Example (Resource)",
        resource_type=ResourceType.LABOR,
        worker_id=worker.id,
    )
    db.add(resource)
    db.commit()

    return SimpleNamespace(project=project, worker=worker, resource=resource, rate=rate)


@pytest.fixture()
def nonlabor_setup(db_session):
    db = db_session
    project = _make_project(db, "CC-NONLABOR-SPLIT")

    resource = Resource(name="Cloud Hosting", resource_type=ResourceType.NON_LABOR, worker_id=None)
    db.add(resource)
    db.commit()

    return SimpleNamespace(project=project, resource=resource)


def test_labor_actual_splits_by_planned_assignment(db_session, labor_setup):
    ctx = labor_setup  # {project, worker, resource, assignment(date, cap%, exp%), rate}
    actual = actuals_service.create_actual(
        db=db_session, project_id=ctx.project.id,
        external_worker_id=ctx.worker.external_id, worker_name=ctx.worker.name,
        actual_date=ctx.assignment.assignment_date,
        allocation_percentage=Decimal("100.00"), validate_allocation=False)
    assert actual.resource_id == ctx.resource.id
    assert actual.capital_amount + actual.expense_amount == actual.actual_cost
    assert actual.capital_amount == Decimal("300.00")
    assert actual.expense_amount == Decimal("200.00")
    assert actual.actual_cost == Decimal("500.00")


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


def test_nonlabor_create_rejects_labor_resource(db_session, labor_setup):
    ctx = labor_setup  # {project, worker, resource(LABOR), ...}
    with pytest.raises(BusinessRuleViolationError):
        actuals_service.create_nonlabor_actual(
            db=db_session, project_id=ctx.project.id, resource_id=ctx.resource.id,
            actual_date=date(2026, 3, 3), capital_amount=Decimal("400"), expense_amount=Decimal("100"))
