"""Strict worker↔labor-resource linkage rules."""
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.services.resource import resource_service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    wt = WorkerType(id=uuid4(), type="Engineer", description="d")
    session.add(wt)
    session.flush()
    session.add(Worker(id=uuid4(), worker_type_id=wt.id, external_id="EMP001", name="Jane Doe"))
    session.commit()
    yield session
    session.close()


def _worker(db):
    return db.query(Worker).first()


def test_labor_requires_worker(db):
    with pytest.raises(ValueError):
        resource_service.create_resource(db, name="x", resource_type=ResourceType.LABOR)


def test_labor_name_derived_from_worker(db):
    w = _worker(db)
    r = resource_service.create_resource(
        db, name="ignored", resource_type=ResourceType.LABOR, worker_id=w.id
    )
    assert r.worker_id == w.id
    assert r.name == "Jane Doe"


def test_non_labor_rejects_worker(db):
    w = _worker(db)
    with pytest.raises(ValueError):
        resource_service.create_resource(
            db, name="AWS", resource_type=ResourceType.NON_LABOR, worker_id=w.id
        )


def test_duplicate_worker_link_rejected(db):
    w = _worker(db)
    resource_service.create_resource(db, name="i", resource_type=ResourceType.LABOR, worker_id=w.id)
    with pytest.raises(ValueError):
        resource_service.create_resource(db, name="i2", resource_type=ResourceType.LABOR, worker_id=w.id)


def test_worker_rename_cascades_to_resource(db):
    w = _worker(db)
    r = resource_service.create_resource(db, name="i", resource_type=ResourceType.LABOR, worker_id=w.id)
    resource_service.update_worker(db, worker_id=w.id, name="Jane Smith")
    db.refresh(r)
    assert r.name == "Jane Smith"
