"""
Integration tests for the split labor/non-labor actuals import endpoints:
POST /api/v1/actuals/import/labor and POST /api/v1/actuals/import/non-labor.

The legacy single POST /api/v1/actuals/import route has been removed in
favor of these two routes.
"""
import io
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.main import app
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.models.resource_assignment import ResourceAssignment
from app.models.rate import Rate
from app.models.actual import Actual
from app.api import deps
from app.services.actuals_import import ActualsImportError
from tests.conftest import TestingSessionLocal


# --- Auth override (mirrors tests/integration/test_assignment_api.py:24-40) ---

def mock_get_current_user():
    """Mock current user for testing."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.username = "testuser"
    user.email = "test@example.com"
    user.is_active = True
    return user


@pytest.fixture
def auth_headers():
    """Override authentication dependency for tests that need it."""
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user
    yield {}
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def db_session():
    """Create a database session for direct database setup via the shared
    test engine/tables (the `client` fixture's `db` dependency creates the
    tables; this session shares that same database)."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_project(db, cost_center_code):
    """Build real chain: Portfolio -> Program -> Project."""
    portfolio = Portfolio(
        name=f"Portfolio {uuid4()}",
        description="Test portfolio",
        owner="owner",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    db.add(portfolio)
    db.flush()

    program = Program(
        portfolio_id=portfolio.id,
        name=f"Program {uuid4()}",
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
        name=f"Project {uuid4()}",
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


@pytest.fixture
def labor_setup(db_session):
    """Portfolio->Program->Project, WorkerType->Worker->Rate, LABOR Resource
    with a planned ResourceAssignment (60/40 split) on 2026-03-03."""
    db = db_session
    project = _make_project(db, f"CC-LABOR-{uuid4()}")

    worker_type = WorkerType(type=f"Engineer-{uuid4()}", description="Software Engineer")
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
        external_id=f"EMP-{uuid4()}",
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


@pytest.fixture
def nonlabor_setup(db_session):
    """Project + a NON_LABOR resource."""
    db = db_session
    project = _make_project(db, f"CC-NONLABOR-{uuid4()}")

    resource = Resource(name="Cloud Hosting", resource_type=ResourceType.NON_LABOR, worker_id=None)
    db.add(resource)
    db.commit()

    return SimpleNamespace(project=project, resource=resource)


def test_labor_import_single_percentage_happy_path(client, auth_headers, labor_setup):
    ctx = labor_setup
    csv_content = (
        "project_id,external_worker_id,worker_name,date,percentage\n"
        f"{ctx.project.id},{ctx.worker.external_id},{ctx.worker.name},{ctx.assignment.assignment_date},100\n"
    )
    response = client.post(
        "/api/v1/actuals/import/labor",
        files={"file": ("a.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["successful_imports"] == 1
    assert body["failed_imports"] == 0
    assert body["validation_only"] is False


def test_labor_import_capital_expense_split(client, auth_headers, labor_setup):
    ctx = labor_setup
    csv_content = (
        "project_id,external_worker_id,worker_name,date,capital_percentage,expense_percentage\n"
        f"{ctx.project.id},{ctx.worker.external_id},{ctx.worker.name},{ctx.assignment.assignment_date},50,30\n"
    )
    response = client.post(
        "/api/v1/actuals/import/labor",
        files={"file": ("a.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["successful_imports"] == 1
    assert body["failed_imports"] == 0

    actual_id = body["results"][0]["actual_id"]
    assert actual_id is not None

    db = TestingSessionLocal()
    try:
        actual = db.query(Actual).filter(Actual.id == actual_id).one()
        # rate 500.00 * 50% = 250.00 capital, 500.00 * 30% = 150.00 expense
        assert actual.capital_amount == Decimal("250.00")
        assert actual.expense_amount == Decimal("150.00")
        assert actual.actual_cost == Decimal("400.00")
        assert actual.capital_amount + actual.expense_amount == actual.actual_cost
    finally:
        db.close()


def test_nonlabor_import_happy_path(client, auth_headers, nonlabor_setup):
    ctx = nonlabor_setup
    csv_content = (
        "project_id,resource_id,date,capital,expense\n"
        f"{ctx.project.id},{ctx.resource.id},2026-03-03,400,100\n"
    )
    response = client.post(
        "/api/v1/actuals/import/non-labor",
        files={"file": ("a.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["successful_imports"] == 1
    assert body["failed_imports"] == 0

    actual_id = body["results"][0]["actual_id"]
    assert actual_id is not None

    db = TestingSessionLocal()
    try:
        actual = db.query(Actual).filter(Actual.id == actual_id).one()
        assert actual.capital_amount == Decimal("400.00")
        assert actual.expense_amount == Decimal("100.00")
        assert actual.actual_cost == Decimal("500.00")
        assert actual.external_worker_id is None
        assert actual.allocation_percentage is None
    finally:
        db.close()


def test_labor_import_validate_only_persists_nothing(client, auth_headers, labor_setup):
    ctx = labor_setup
    csv_content = (
        "project_id,external_worker_id,worker_name,date,percentage\n"
        f"{ctx.project.id},{ctx.worker.external_id},{ctx.worker.name},{ctx.assignment.assignment_date},100\n"
    )
    response = client.post(
        "/api/v1/actuals/import/labor?validate_only=true",
        files={"file": ("a.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["validation_only"] is True
    assert body["successful_imports"] == 1
    # Nothing should be persisted -- no actual_id assigned, and no rows in DB
    assert all(r["actual_id"] is None for r in body["results"])

    db = TestingSessionLocal()
    try:
        count = db.query(Actual).filter(Actual.project_id == ctx.project.id).count()
        assert count == 0
    finally:
        db.close()


def test_labor_csv_rejected_by_nonlabor_endpoint(client, auth_headers, labor_setup):
    ctx = labor_setup
    csv_content = (
        "project_id,external_worker_id,worker_name,date,percentage\n"
        f"{ctx.project.id},{ctx.worker.external_id},{ctx.worker.name},{ctx.assignment.assignment_date},100\n"
    )
    # This labor-shaped CSV is missing the non-labor importer's required
    # columns (resource_id, capital, expense), so the header-level check in
    # NonLaborActualsImportService.parse_csv rejects it via
    # ActualsImportError. That is a plain (non-AppException) error, so it is
    # not converted to a 4xx JSON body -- it propagates through the generic
    # 500 handler, and TestClient re-raises it (raise_server_exceptions=True
    # by default). Either way, this must NOT look like a successful import.
    with pytest.raises(ActualsImportError, match="Missing required columns"):
        client.post(
            "/api/v1/actuals/import/non-labor",
            files={"file": ("a.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        )


def test_old_import_route_is_gone(client, auth_headers):
    csv_content = (
        "project_id,external_worker_id,worker_name,date,percentage\n"
        f"{uuid4()},EMP1,Ann,2026-03-03,100\n"
    )
    response = client.post(
        "/api/v1/actuals/import",
        files={"file": ("a.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code in (404, 405)
