"""
Integration tests: worker-type and rate write endpoints are admin-gated.

Worker-type writes (POST/PUT/DELETE /workers/types*) and rate mutations
(POST /rates/, POST /rates/worker-type/{id}/update, POST /rates/worker-type/{id}/close)
require check_admin_permission. Reads (GET) and non-type worker writes stay open
to any authenticated user.
"""
from uuid import uuid4

import pytest

from app.models.resource import WorkerType


@pytest.fixture
def employment_type_id(test_db) -> str:
    """A WorkerType to use as the rate's worker_type_id.

    The shared test database is built via Base.metadata.create_all (not
    migrations), so it has no pre-seeded worker types. Tests that need one
    must create it themselves.
    """
    unique = uuid4().hex[:12]
    worker_type = WorkerType(type=f"Employee-{unique}", description="d")
    test_db.add(worker_type)
    test_db.commit()
    test_db.refresh(worker_type)
    return str(worker_type.id)


def test_worker_type_create_requires_admin(client, auth_headers, admin_auth_headers):
    body = {"type": f"Temp Type {uuid4().hex[:8]}", "description": "d"}
    assert client.post("/api/v1/workers/types", json=body, headers=auth_headers).status_code == 403

    body2 = {"type": f"Temp Type {uuid4().hex[:8]}", "description": "d"}
    assert client.post("/api/v1/workers/types", json=body2, headers=admin_auth_headers).status_code == 201


def test_worker_type_list_open(client, auth_headers):
    assert client.get("/api/v1/workers/types", headers=auth_headers).status_code == 200


def test_rate_create_requires_admin(client, auth_headers, admin_auth_headers, employment_type_id):
    body = {
        "worker_type_id": employment_type_id,
        "rate_amount": "999",
        "start_date": "2026-08-01",
    }
    assert client.post("/api/v1/rates/", json=body, headers=auth_headers).status_code == 403


def test_rate_create_succeeds_for_admin(client, admin_auth_headers, employment_type_id):
    body = {
        "worker_type_id": employment_type_id,
        "rate_amount": "999",
        "start_date": "2026-08-01",
    }
    response = client.post("/api/v1/rates/", json=body, headers=admin_auth_headers)
    assert response.status_code == 201
