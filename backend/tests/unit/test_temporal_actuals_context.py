from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registers every relationship/table
from app.core.exceptions import ImportError as ImportException
from app.models.actual import Actual, ActualImportBatch
from app.models.base import Base
from app.models.resource_assignment import ResourceAssignment
from app.models.temporal import EntityRevision
from app.repositories.actual import actual_repository
from app.services.actuals import ActualsService
from app.temporal import ACTOR_KEY, install_temporal_listeners


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    install_temporal_listeners()
    db = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(engine)


def test_temporal_listener_captures_full_state_updates_and_tombstones(session):
    actor_id = uuid4()
    session.info[ACTOR_KEY] = actor_id
    assignment = ResourceAssignment(
        resource_id=uuid4(),
        project_id=uuid4(),
        assignment_date=date(2026, 7, 20),
        capital_percentage=Decimal("40"),
        expense_percentage=Decimal("20"),
    )
    session.add(assignment)
    session.commit()

    assignment.capital_percentage = Decimal("50")
    session.commit()
    session.delete(assignment)
    session.commit()

    revisions = session.query(EntityRevision).filter_by(
        entity_type="resource_assignments",
        entity_id=assignment.id,
    ).order_by(EntityRevision.recorded_at).all()

    assert [revision.operation for revision in revisions] == [
        "CREATE",
        "UPDATE",
        "DELETE",
    ]
    assert revisions[0].snapshot["capital_percentage"] == "40"
    assert revisions[1].snapshot["capital_percentage"] == "50"
    assert revisions[2].is_tombstone is True
    assert all(revision.actor_id == actor_id for revision in revisions)
    assert len({revision.transaction_id for revision in revisions}) == 3


class _Record:
    def __init__(self, row_number: int):
        self.row_number = row_number
        self.project_id = uuid4()
        self.resource_id = uuid4()
        self.actual_date = date(2026, 7, 20)
        self.capital = Decimal("80")
        self.expense = Decimal("20")
        self.validation_errors = []

    def is_valid(self):
        return not self.validation_errors


def _add_nonlabor_actual(db, *, project_id, resource_id, actual_date,
                         capital_amount, expense_amount, import_batch_id, **kwargs):
    return actual_repository.create_in_transaction(
        db,
        obj_in={
            "project_id": project_id,
            "resource_id": resource_id,
            "import_batch_id": import_batch_id,
            "external_worker_id": None,
            "worker_name": None,
            "actual_date": actual_date,
            "allocation_percentage": None,
            "actual_cost": capital_amount + expense_amount,
            "capital_amount": capital_amount,
            "expense_amount": expense_amount,
        },
    )


def test_actual_import_is_atomic_and_shares_one_revision_transaction(
    session,
    monkeypatch,
):
    service = ActualsService()
    monkeypatch.setattr(service, "create_nonlabor_actual", _add_nonlabor_actual)

    result = service.import_nonlabor_batch(
        session,
        [_Record(1), _Record(2)],
        actuals_through_date=date(2026, 7, 21),
        file_name="actuals.csv",
    )

    batch = result["batch"]
    actuals = session.query(Actual).all()
    revisions = session.query(EntityRevision).filter(
        EntityRevision.entity_type.in_(["actual_import_batches", "actuals"])
    ).all()
    assert len(actuals) == 2
    assert batch.record_count == 2
    assert all(actual.import_batch_id == batch.id for actual in actuals)
    assert {revision.transaction_id for revision in revisions} == {
        batch.transaction_id,
    }
    assert actual_repository.latest_watermarks(session)["non_labor"] == date(
        2026,
        7,
        21,
    )


def test_failed_actual_import_rolls_back_rows_batch_and_revisions(
    session,
    monkeypatch,
):
    service = ActualsService()
    calls = 0

    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("source row failed")
        return _add_nonlabor_actual(*args, **kwargs)

    monkeypatch.setattr(service, "create_nonlabor_actual", fail_second)

    with pytest.raises(ImportException):
        service.import_nonlabor_batch(session, [_Record(1), _Record(2)])

    assert session.query(Actual).count() == 0
    assert session.query(ActualImportBatch).count() == 0
    assert session.query(EntityRevision).count() == 0
