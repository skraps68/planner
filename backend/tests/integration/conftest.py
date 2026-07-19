"""
Shared fixtures for integration tests.

`client`, `db`, and `TestingSessionLocal` come from the top-level tests/conftest.py
(pytest resolves fixtures from parent conftests automatically). This module adds
reusable authentication fixtures on top of that: a real (non-admin) user and a
real admin user, both persisted to the shared test database, with headers
carrying genuine JWTs (not mocked) — following the pattern already used by
tests/integration/test_middleware_integration.py.

Any test file that defines its own fixtures with these same names (e.g.
test_middleware_integration.py's local `test_user`/`admin_user`/`auth_headers`)
keeps working unchanged: a fixture defined directly in a test module always
takes precedence over one supplied by conftest.py.
"""
import uuid

import pytest

from app.models.user import User, UserRole, RoleType
from app.services.authentication import authentication_service
from tests.conftest import TestingSessionLocal


@pytest.fixture
def test_db(db):
    """Database session backed by the shared file-based test database."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(test_db) -> User:
    """A real, non-admin (VIEWER) user persisted to the test database."""
    unique = uuid.uuid4().hex[:12]
    user = authentication_service.create_user(
        db=test_db,
        username=f"rr_viewer_{unique}",
        email=f"rr_viewer_{unique}@example.com",
        password="testpass123",
        is_active=True,
    )

    viewer_role = UserRole(
        user_id=user.id,
        role_type=RoleType.VIEWER,
        is_active=True,
    )
    test_db.add(viewer_role)
    test_db.commit()

    yield user

    test_db.delete(viewer_role)
    test_db.delete(user)
    test_db.commit()


@pytest.fixture
def admin_user(test_db) -> User:
    """A real admin user (ADMIN UserRole) persisted to the test database."""
    unique = uuid.uuid4().hex[:12]
    user = authentication_service.create_user(
        db=test_db,
        username=f"rr_admin_{unique}",
        email=f"rr_admin_{unique}@example.com",
        password="adminpass123",
        is_active=True,
    )

    admin_role = UserRole(
        user_id=user.id,
        role_type=RoleType.ADMIN,
        is_active=True,
    )
    test_db.add(admin_role)
    test_db.commit()

    yield user

    test_db.delete(admin_role)
    test_db.delete(user)
    test_db.commit()


@pytest.fixture
def auth_headers(test_db, test_user: User) -> dict:
    """Authorization header for a real, non-admin authenticated user."""
    tokens = authentication_service.login(
        db=test_db,
        username=test_user.username,
        password="testpass123",
    )
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def admin_auth_headers(test_db, admin_user: User) -> dict:
    """Authorization header for a real admin authenticated user."""
    tokens = authentication_service.login(
        db=test_db,
        username=admin_user.username,
        password="adminpass123",
    )
    return {"Authorization": f"Bearer {tokens['access_token']}"}
