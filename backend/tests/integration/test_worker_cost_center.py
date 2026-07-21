"""Worker cost center carried through create/update, with server-default fallback."""
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.resource import Worker, WorkerType
from app.services.resource import worker_service, worker_type_service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_create_worker_persists_cost_center(db):
    wt = worker_type_service.create_worker_type(db, type="Engineer", description="d")
    w = worker_service.create_worker(
        db, external_id="EMP100", name="Cost Worker",
        worker_type_id=wt.id, cost_center_code="CC-777",
    )
    assert w.cost_center_code == "CC-777"


def test_update_worker_changes_cost_center(db):
    wt = worker_type_service.create_worker_type(db, type="Engineer", description="d")
    w = worker_service.create_worker(
        db, external_id="EMP101", name="Cost Worker 2",
        worker_type_id=wt.id, cost_center_code="CC-777",
    )
    updated = worker_service.update_worker(db, worker_id=w.id, cost_center_code="CC-888")
    assert updated.cost_center_code == "CC-888"


def test_server_default_when_omitted(db):
    wt = WorkerType(id=uuid4(), type="T", description="d")
    db.add(wt)
    db.flush()
    w = Worker(id=uuid4(), external_id="EMP102", name="No CC", worker_type_id=wt.id)
    db.add(w)
    db.commit()
    db.refresh(w)
    assert w.cost_center_code == "CC-0000"
