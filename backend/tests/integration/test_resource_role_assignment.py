"""
Integration tests for resource role assignment on the Resource API:
- LABOR resources default to the "Default" resource role when none is given.
- NON_LABOR resources reject an explicit resource role.
- ResourceResponse carries denormalized role/worker/rate fields.
"""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest

from app.models.rate import Rate
from app.models.resource import ResourceRole, Worker, WorkerType


@pytest.fixture
def default_role(test_db) -> ResourceRole:
    """
    Ensure a "Default" resource role exists in the test database.

    The shared test database is built via Base.metadata.create_all (not the
    27f01e1d45e6 migration), so it does NOT come pre-seeded with the "Default"
    role the way a real/migrated database would. Tests that rely on "Default"
    existing must create it themselves.
    """
    role = test_db.query(ResourceRole).filter(ResourceRole.name == "Default").first()
    if role is None:
        role = ResourceRole(name="Default", description="Default resource role")
        test_db.add(role)
        test_db.commit()
        test_db.refresh(role)
    return role


@pytest.fixture
def some_role_id(test_db) -> str:
    """A non-Default resource role id, for the non-labor-rejects-role test."""
    unique = uuid4().hex[:12]
    role = ResourceRole(name=f"Role-{unique}", description="d")
    test_db.add(role)
    test_db.commit()
    test_db.refresh(role)
    return str(role.id)


@pytest.fixture
def labor_worker_fixture(test_db, default_role) -> Worker:
    """A Worker on an employment-class WorkerType with a current Rate."""
    unique = uuid4().hex[:12]
    worker_type = WorkerType(type=f"EmploymentClass-{unique}", description="d")
    test_db.add(worker_type)
    test_db.flush()

    rate = Rate(
        worker_type_id=worker_type.id,
        rate_amount=Decimal("150.00"),
        start_date=date(2020, 1, 1),
        end_date=None,
    )
    test_db.add(rate)

    worker = Worker(
        worker_type_id=worker_type.id,
        external_id=f"EMP-{unique}",
        name=f"Worker {unique}",
    )
    test_db.add(worker)
    test_db.commit()
    test_db.refresh(worker)
    return worker


def test_labor_resource_defaults_to_default_role(client, auth_headers, labor_worker_fixture):
    body = {"name": "_", "resource_type": "LABOR", "worker_id": str(labor_worker_fixture.id)}
    r = client.post("/api/v1/resources/", json=body, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["resource_role_name"] == "Default"
    assert data["worker_type_name"] is not None   # denormalized
    # current_rate present (worker's employment-class rate)
    assert "current_rate" in data
    assert data["current_rate"] == "150.00"


def test_nonlabor_resource_rejects_role(client, auth_headers, some_role_id):
    body = {"name": "License", "resource_type": "NON_LABOR", "resource_role_id": some_role_id}
    r = client.post("/api/v1/resources/", json=body, headers=auth_headers)
    assert r.status_code == 400
