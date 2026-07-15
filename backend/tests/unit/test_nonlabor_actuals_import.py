"""
Unit tests for NonLaborActualsImportService (non-labor actuals CSV importer,
dollar-based: capital/expense columns).
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.services.actuals_import import (
    nonlabor_actuals_import_service as svc,
    ActualsImportError,
)

CSV = "project_id,resource_id,date,capital,expense\n" \
      "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,2026-03-03,400,100\n"

CSV_MISSING_COLUMN = "project_id,resource_id,date,capital\n" \
                     "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,2026-03-03,400\n"

CSV_WITH_EXTERNAL_WORKER_ID = (
    "project_id,resource_id,date,capital,expense,external_worker_id\n"
    "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,2026-03-03,400,100,EMP1\n"
)

CSV_WITH_PERCENTAGE = (
    "project_id,resource_id,date,capital,expense,percentage\n"
    "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,2026-03-03,400,100,80\n"
)


def test_parse_nonlabor_dollars():
    recs = svc.parse_csv(CSV)
    assert len(recs) == 1
    assert recs[0].capital_str == "400"
    assert recs[0].expense_str == "100"
    assert recs[0].resource_id_str == "22222222-2222-2222-2222-222222222222"


def test_parse_csv_missing_column_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_MISSING_COLUMN)


def test_parse_csv_with_external_worker_id_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_WITH_EXTERNAL_WORKER_ID)


def test_parse_csv_with_percentage_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_WITH_PERCENTAGE)


# ---------------------------------------------------------------------------
# Row-validation tests (validate_records)
# ---------------------------------------------------------------------------


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def _make_project(db):
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
        cost_center_code="CC-NONLABOR-IMPORT",
    )
    db.add(project)
    db.flush()
    return project


def _make_nonlabor_resource(db, name="Cloud Hosting"):
    resource = Resource(
        name=name,
        resource_type=ResourceType.NON_LABOR,
        worker_id=None,
    )
    db.add(resource)
    db.flush()
    return resource


def _make_labor_resource(db, external_id="EMP1", name="Ann"):
    worker_type = WorkerType(type="Engineer-%s" % external_id, description="desc")
    db.add(worker_type)
    db.flush()

    worker = Worker(
        external_id=external_id,
        name=name,
        worker_type_id=worker_type.id,
    )
    db.add(worker)
    db.flush()

    resource = Resource(
        name=name,
        resource_type=ResourceType.LABOR,
        worker_id=worker.id,
    )
    db.add(resource)
    db.flush()
    return resource


def _csv(project_id, resource_id, actual_date="2026-03-03", capital="400", expense="100"):
    return (
        "project_id,resource_id,date,capital,expense\n"
        f"{project_id},{resource_id},{actual_date},{capital},{expense}\n"
    )


def test_validate_valid_row_passes(db_session):
    project = _make_project(db_session)
    resource = _make_nonlabor_resource(db_session)

    csv_content = _csv(project.id, resource.id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert records[0].is_valid(), records[0].validation_errors


def test_validate_unknown_project_rejected(db_session):
    resource = _make_nonlabor_resource(db_session)
    unknown_project_id = "99999999-9999-9999-9999-999999999999"

    csv_content = _csv(unknown_project_id, resource.id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("does not exist" in e for e in records[0].validation_errors)


def test_validate_unknown_resource_rejected(db_session):
    project = _make_project(db_session)
    unknown_resource_id = "88888888-8888-8888-8888-888888888888"

    csv_content = _csv(project.id, unknown_resource_id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("does not exist" in e for e in records[0].validation_errors)


def test_validate_labor_resource_rejected(db_session):
    project = _make_project(db_session)
    resource = _make_labor_resource(db_session)

    csv_content = _csv(project.id, resource.id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("is not non-labor" in e for e in records[0].validation_errors)


def test_validate_bad_date_format_rejected(db_session):
    project = _make_project(db_session)
    resource = _make_nonlabor_resource(db_session)

    csv_content = _csv(project.id, resource.id, actual_date="03/03/2026")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("Invalid date format" in e for e in records[0].validation_errors)


def test_validate_negative_capital_rejected(db_session):
    project = _make_project(db_session)
    resource = _make_nonlabor_resource(db_session)

    csv_content = _csv(project.id, resource.id, capital="-50")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("capital must be >= 0" in e for e in records[0].validation_errors)


def test_validate_non_numeric_expense_rejected(db_session):
    project = _make_project(db_session)
    resource = _make_nonlabor_resource(db_session)

    csv_content = _csv(project.id, resource.id, expense="abc")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("Invalid expense format" in e for e in records[0].validation_errors)


def test_validate_zero_zero_dollars_is_valid(db_session):
    project = _make_project(db_session)
    resource = _make_nonlabor_resource(db_session)

    csv_content = _csv(project.id, resource.id, capital="0", expense="0")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert records[0].is_valid(), records[0].validation_errors
