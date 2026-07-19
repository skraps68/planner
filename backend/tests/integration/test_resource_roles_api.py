"""
Integration tests for ResourceRole API endpoints.
"""
import pytest

from app.models.resource import ResourceRole


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


def test_list_roles_open_to_any_user(client, auth_headers):
    r = client.get("/api/v1/resource-roles", headers=auth_headers)
    assert r.status_code == 200


def test_create_role_requires_admin(client, auth_headers, admin_auth_headers):
    body = {"name": "QA Engineer", "description": "d"}
    assert client.post("/api/v1/resource-roles", json=body, headers=auth_headers).status_code == 403
    r = client.post("/api/v1/resource-roles", json=body, headers=admin_auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "QA Engineer"
    assert data["resource_count"] == 0


def test_create_role_duplicate_name_rejected(client, admin_auth_headers):
    body = {"name": "Duplicate Role", "description": "d"}
    first = client.post("/api/v1/resource-roles", json=body, headers=admin_auth_headers)
    assert first.status_code == 201

    second = client.post("/api/v1/resource-roles", json=body, headers=admin_auth_headers)
    assert second.status_code == 400


def test_default_role_cannot_be_deleted(client, admin_auth_headers, default_role):
    roles = client.get("/api/v1/resource-roles", headers=admin_auth_headers).json()
    default = next(r for r in roles if r["name"] == "Default")
    assert client.delete(f"/api/v1/resource-roles/{default['id']}", headers=admin_auth_headers).status_code == 400


def test_delete_role_requires_admin(client, auth_headers, admin_auth_headers):
    body = {"name": "Temp Role", "description": "d"}
    created = client.post("/api/v1/resource-roles", json=body, headers=admin_auth_headers).json()

    assert client.delete(f"/api/v1/resource-roles/{created['id']}", headers=auth_headers).status_code == 403
    assert client.delete(f"/api/v1/resource-roles/{created['id']}", headers=admin_auth_headers).status_code == 200
