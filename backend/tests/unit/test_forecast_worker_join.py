"""Forecast assignment costing resolves workers via worker_id, never by name."""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.rate import Rate
from app.models.resource import Resource, ResourceRole, ResourceType, Worker, WorkerType
from app.services.forecasting import ForecastingService


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    wt = WorkerType(id=uuid4(), type="Engineer", description="d")
    session.add(wt); session.flush()
    w = Worker(id=uuid4(), worker_type_id=wt.id, external_id="EMP001", name="Jane Doe")
    session.add(w); session.flush()
    session.add(Rate(id=uuid4(), worker_type_id=wt.id, rate_amount=Decimal("1600.00"),
                     start_date=date(2020, 1, 1), end_date=None))
    role = ResourceRole(id=uuid4(), name="Test Role")
    session.add(role); session.flush()
    session.add(Resource(id=uuid4(), name="Jane Doe", resource_type=ResourceType.LABOR,
                         worker_id=w.id, resource_role_id=role.id))
    # A decoy resource with the same NAME as the worker but no link — must NOT price at 1600
    session.add(Resource(id=uuid4(), name="Jane Doe", resource_type=ResourceType.NON_LABOR))
    session.commit()
    yield session
    session.close()


class _Asg:
    def __init__(self, resource_id):
        self.resource_id = resource_id
        self.assignment_date = date(2026, 6, 1)
        self.capital_percentage = Decimal("60.00")
        self.expense_percentage = Decimal("40.00")


def test_linked_labor_resource_uses_worker_rate(db):
    svc = ForecastingService()
    linked = db.query(Resource).filter(Resource.worker_id.isnot(None)).one()
    cost, resource_type = svc._calculate_assignment_cost(db, _Asg(linked.id))
    assert cost == Decimal("1600.00")  # 1600 * (60+40)/100
    assert resource_type == ResourceType.LABOR


def test_non_labor_uses_default(db):
    svc = ForecastingService()
    decoy = db.query(Resource).filter(Resource.worker_id.is_(None)).one()
    cost, resource_type = svc._calculate_assignment_cost(db, _Asg(decoy.id))
    assert cost == Decimal("500.00")  # non-labor default retained
    assert resource_type == ResourceType.NON_LABOR
