"""
Unit tests for LaborActualsImportService (labor actuals CSV importer with
optional capital/expense percentage split columns).
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Worker, WorkerType
from app.services.actuals_import import (
    labor_actuals_import_service as svc,
    ActualsImportError,
)

CSV_SINGLE = "project_id,external_worker_id,worker_name,date,percentage\n" \
             "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,80\n"
CSV_SPLIT = "project_id,external_worker_id,worker_name,date,capital_percentage,expense_percentage\n" \
            "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,50,30\n"
CSV_NEITHER = "project_id,external_worker_id,worker_name,date\n" \
              "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03\n"
CSV_BOTH = "project_id,external_worker_id,worker_name,date,percentage,capital_percentage,expense_percentage\n" \
           "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,80,50,30\n"
CSV_RESOURCE_ID = "project_id,resource_id,external_worker_id,worker_name,date,percentage\n" \
                   "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,EMP1,Ann,2026-03-03,80\n"
CSV_PERCENTAGE_PLUS_CAPITAL = (
    "project_id,external_worker_id,worker_name,date,percentage,capital_percentage\n"
    "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,80,50\n"
)
CSV_CAPITAL_ONLY = (
    "project_id,external_worker_id,worker_name,date,capital_percentage\n"
    "11111111-1111-1111-1111-111111111111,EMP1,Ann,2026-03-03,50\n"
)


def test_parse_single_percentage():
    recs = svc.parse_csv(CSV_SINGLE)
    assert len(recs) == 1
    assert recs[0].percentage_str == "80"


def test_parse_capital_expense_split():
    recs = svc.parse_csv(CSV_SPLIT)
    assert recs[0].capital_percentage_str == "50"
    assert recs[0].expense_percentage_str == "30"


def test_parse_csv_neither_percentage_form_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_NEITHER)


def test_parse_csv_both_percentage_forms_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_BOTH)


def test_parse_csv_resource_id_column_rejects():
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_RESOURCE_ID)


def test_parse_csv_percentage_plus_capital_percentage_rejects():
    """percentage + exactly one of the split pair must be rejected, not
    silently accepted as single-percentage form with the stray column
    dropped."""
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_PERCENTAGE_PLUS_CAPITAL)


def test_parse_csv_capital_percentage_only_rejects():
    """Only one of the split pair present (no percentage column either)
    must be rejected as incomplete."""
    with pytest.raises(ActualsImportError):
        svc.parse_csv(CSV_CAPITAL_ONLY)


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
        cost_center_code="CC-LABOR-IMPORT",
    )
    db.add(project)
    db.flush()
    return project


def _make_worker(db, external_id="EMP1", name="Ann"):
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
    return worker


def _csv_single(project_id, external_worker_id="EMP1", worker_name="Ann",
                actual_date="2026-03-03", percentage="80"):
    return (
        "project_id,external_worker_id,worker_name,date,percentage\n"
        f"{project_id},{external_worker_id},{worker_name},{actual_date},{percentage}\n"
    )


def _csv_split(project_id, external_worker_id="EMP1", worker_name="Ann",
               actual_date="2026-03-03", capital="50", expense="30"):
    return (
        "project_id,external_worker_id,worker_name,date,capital_percentage,expense_percentage\n"
        f"{project_id},{external_worker_id},{worker_name},{actual_date},{capital},{expense}\n"
    )


def test_validate_valid_single_percentage_row_passes(db_session):
    project = _make_project(db_session)
    _make_worker(db_session)

    csv_content = _csv_single(project.id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert records[0].is_valid(), records[0].validation_errors


def test_validate_unknown_project_rejected(db_session):
    _make_worker(db_session)
    unknown_project_id = "99999999-9999-9999-9999-999999999999"

    csv_content = _csv_single(unknown_project_id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("does not exist" in e for e in records[0].validation_errors)


def test_validate_unknown_worker_rejected(db_session):
    project = _make_project(db_session)
    # No worker created.

    csv_content = _csv_single(project.id)
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("does not exist" in e for e in records[0].validation_errors)


def test_validate_worker_name_mismatch_rejected(db_session):
    project = _make_project(db_session)
    _make_worker(db_session, name="Ann")

    csv_content = _csv_single(project.id, worker_name="Bob")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("mismatch" in e for e in records[0].validation_errors)


def test_validate_bad_date_format_rejected(db_session):
    project = _make_project(db_session)
    _make_worker(db_session)

    csv_content = _csv_single(project.id, actual_date="03/03/2026")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("Invalid date format" in e for e in records[0].validation_errors)


def test_validate_single_percentage_over_100_rejected(db_session):
    project = _make_project(db_session)
    _make_worker(db_session)

    csv_content = _csv_single(project.id, percentage="150")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("must be <= 100.0" in e for e in records[0].validation_errors)


def test_validate_split_sum_over_100_rejected(db_session):
    project = _make_project(db_session)
    _make_worker(db_session)

    csv_content = _csv_split(project.id, capital="70", expense="40")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("must be <= 100.0" in e for e in records[0].validation_errors)


def test_validate_split_zero_zero_is_valid(db_session):
    """Regression for fix #2: a 0/0 split pair is valid, consistent with a
    single-form percentage=0 row being accepted."""
    project = _make_project(db_session)
    _make_worker(db_session)

    csv_content = _csv_split(project.id, capital="0", expense="0")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert records[0].is_valid(), records[0].validation_errors


def test_validate_split_one_empty_cell_rejected(db_session):
    project = _make_project(db_session)
    _make_worker(db_session)

    csv_content = _csv_split(project.id, capital="50", expense="")
    records = svc.parse_csv(csv_content)
    svc.validate_records(db_session, records)

    assert not records[0].is_valid()
    assert any("expense_percentage is required" in e for e in records[0].validation_errors)
