"""
Integration tests for Audit API endpoints.
"""
import pytest
from unittest.mock import MagicMock
from uuid import uuid4
from datetime import datetime

from app.models.user import User
from app.api import deps


# Mock user for authentication bypass
def mock_get_current_user():
    """Mock current user for testing."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.username = "testuser"
    user.email = "test@example.com"
    user.is_active = True
    return user


@pytest.fixture
def override_auth_dependency():
    """Override authentication dependency for tests that need it."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user
    app.dependency_overrides[deps.get_current_active_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)
    app.dependency_overrides.pop(deps.get_current_active_user, None)


@pytest.fixture
def db_session():
    """Get database session for tests."""
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestAuditAPI:
    """Test audit API endpoints."""
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_list_audit_logs(self, client, db_session, monkeypatch):
        """Test listing audit logs."""
        from app.services.authorization import authorization_service, Permission
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        response = client.get(
            "/api/v1/audit",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_entity_audit_history(self, client, db_session, monkeypatch):
        """Test getting audit history for a specific entity."""
        from app.services.authorization import authorization_service, Permission
        from app.services.authentication import authentication_service
        from app.services.audit import audit_service
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        # Create a test user and log an action
        user = authentication_service.create_user(
            db_session,
            username=f"audituser_{uuid4().hex[:8]}",
            email=f"audituser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        # Log a create action
        audit_service.log_create(db_session, mock_get_current_user().id, user)
        
        response = client.get(
            f"/api/v1/audit/entity/User/{user.id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the create action we logged
        assert len(data) > 0
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_user_audit_activity(self, client, db_session, monkeypatch):
        """Test getting audit activity for a specific user."""
        from app.services.authorization import authorization_service, Permission
        from app.services.authentication import authentication_service
        from app.services.audit import audit_service
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username=f"activityuser_{uuid4().hex[:8]}",
            email=f"activityuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        # Log some actions by this user
        audit_service.log_create(db_session, user.id, user)
        
        response = client.get(
            f"/api/v1/audit/user/{user.id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_permission_changes(self, client, db_session, monkeypatch):
        """Test getting permission change audit logs."""
        from app.services.authorization import authorization_service, Permission
        from app.services.authentication import authentication_service
        from app.services.audit import audit_service
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        # Create test users
        admin_user = authentication_service.create_user(
            db_session,
            username=f"admin_{uuid4().hex[:8]}",
            email=f"admin_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        target_user = authentication_service.create_user(
            db_session,
            username=f"target_{uuid4().hex[:8]}",
            email=f"target_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        # Log a permission change
        audit_service.log_permission_change(
            db_session,
            admin_user.id,
            target_user.id,
            "ROLE_ASSIGNED",
            {"role_type": "VIEWER"}
        )
        
        response = client.get(
            "/api/v1/audit/permissions",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_audit_summary(self, client, db_session, monkeypatch):
        """Test getting audit summary statistics."""
        from app.services.authorization import authorization_service, Permission
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        response = client.get(
            "/api/v1/audit/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "total_changes" in data
        assert "creates" in data
        assert "updates" in data
        assert "deletes" in data
        assert "by_entity_type" in data
        assert "by_user" in data
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_recent_changes(self, client, db_session, monkeypatch):
        """Test getting recent audit changes."""
        from app.services.authorization import authorization_service, Permission
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        response = client.get(
            "/api/v1/audit/recent?limit=10",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_user_activity_summary(self, client, db_session, monkeypatch):
        """Test getting user activity summary."""
        from app.services.authorization import authorization_service, Permission
        from app.services.authentication import authentication_service
        from app.services.audit import audit_service
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        # Create a test user and log some actions
        user = authentication_service.create_user(
            db_session,
            username=f"summaryuser_{uuid4().hex[:8]}",
            email=f"summaryuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        audit_service.log_create(db_session, user.id, user)
        
        response = client.get(
            f"/api/v1/audit/user/{user.id}/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "username" in data
        assert "total_actions" in data
        assert "operations" in data
        assert "entities_modified" in data
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_entity_changes_summary(self, client, db_session, monkeypatch):
        """Test getting entity changes summary."""
        from app.services.authorization import authorization_service, Permission
        from app.services.authentication import authentication_service
        from app.services.audit import audit_service
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        # Create a test user and log actions
        user = authentication_service.create_user(
            db_session,
            username=f"entitysummary_{uuid4().hex[:8]}",
            email=f"entitysummary_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        audit_service.log_create(db_session, mock_get_current_user().id, user)
        
        response = client.get(
            f"/api/v1/audit/entity/User/{user.id}/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "entity_type" in data
        assert "entity_id" in data
        assert "total_changes" in data
        assert "operations" in data
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_field_change_history(self, client, db_session, monkeypatch):
        """Test getting field change history."""
        from app.services.authorization import authorization_service, Permission
        from app.services.authentication import authentication_service
        from app.services.audit import audit_service
        
        # Mock permission check
        def mock_has_permission(db, user_id, permission):
            return permission == Permission.VIEW_AUDIT_LOGS
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username=f"fielduser_{uuid4().hex[:8]}",
            email=f"fielduser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        # Log create
        audit_service.log_create(db_session, mock_get_current_user().id, user)
        
        # Update user and log it
        before_values = audit_service.capture_before_update(user)
        user.email = "newemail@example.com"
        db_session.commit()
        audit_service.log_update(db_session, mock_get_current_user().id, user, before_values)
        
        response = client.get(
            f"/api/v1/audit/entity/User/{user.id}/field/email",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_audit_access_denied_without_permission(self, client, db_session, monkeypatch):
        """Test that audit endpoints deny access without proper permissions."""
        from app.services.authorization import authorization_service, Permission
        
        # Mock permission check to deny access
        def mock_has_permission(db, user_id, permission):
            return False
        
        monkeypatch.setattr(authorization_service, "has_permission", mock_has_permission)
        
        response = client.get(
            "/api/v1/audit",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
