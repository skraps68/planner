"""
Integration tests for Authentication API endpoints.
"""
import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.models.user import User, RoleType, ScopeType
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
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def db_session():
    """Get database session for tests."""
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestAuthenticationAPI:
    """Test authentication API endpoints."""
    
    def test_login_success(self, client, db_session):
        """Test successful login."""
        from app.services.authentication import authentication_service
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username="logintest",
            email="logintest@example.com",
            password="testpassword123",
            is_active=True
        )
        
        # Assign a role to the user
        from app.services.role_management import role_management_service
        role_management_service.assign_role(
            db_session,
            user.id,
            RoleType.VIEWER,
            is_active=True
        )
        
        # Attempt login
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "logintest",
                "password": "testpassword123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tokens" in data
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]
        assert data["username"] == "logintest"
        assert data["email"] == "logintest@example.com"
        assert RoleType.VIEWER.value in data["active_roles"]
    
    def test_login_invalid_credentials(self, client, db_session):
        """Test login with invalid credentials."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "nonexistent",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]
    
    def test_login_no_roles(self, client, db_session):
        """Test login with user that has no roles."""
        from app.services.authentication import authentication_service
        
        # Create a test user without roles
        user = authentication_service.create_user(
            db_session,
            username="noroleuser",
            email="norole@example.com",
            password="testpassword123",
            is_active=True
        )
        
        # Attempt login
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "noroleuser",
                "password": "testpassword123"
            }
        )
        
        assert response.status_code == 403
        assert "no active roles" in response.json()["detail"]
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_current_user_info(self, client, db_session):
        """Test getting current user information."""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # This will work with mocked auth
        assert response.status_code == 200
        data = response.json()
        assert "username" in data
        assert "email" in data
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_change_password_success(self, client, db_session):
        """Test successful password change."""
        from app.services.authentication import authentication_service
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username="pwdchange",
            email="pwdchange@example.com",
            password="oldpassword123",
            is_active=True
        )
        
        # Mock the current user to be this user
        def mock_current_user():
            return user
        
        from app.main import app
        app.dependency_overrides[deps.get_current_active_user] = mock_current_user
        
        # Change password
        response = client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "oldpassword123",
                "new_password": "newpassword456"
            },
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        assert "Password changed successfully" in response.json()["message"]
        
        # Refresh user from database to get updated password hash
        db_session.refresh(user)
        
        # Verify new password works
        assert authentication_service.verify_password("newpassword456", user.password_hash)
        
        # Clean up
        app.dependency_overrides.pop(deps.get_current_active_user, None)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_change_password_wrong_current(self, client, db_session):
        """Test password change with wrong current password."""
        from app.services.authentication import authentication_service
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username="pwdwrong",
            email="pwdwrong@example.com",
            password="correctpassword",
            is_active=True
        )
        
        # Mock the current user
        def mock_current_user():
            return user
        
        from app.main import app
        app.dependency_overrides[deps.get_current_active_user] = mock_current_user
        
        # Attempt password change with wrong current password
        response = client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword456"
            },
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 400
        assert "Current password is incorrect" in response.json()["detail"]
        
        # Clean up
        app.dependency_overrides.pop(deps.get_current_active_user, None)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_logout(self, client):
        """Test logout endpoint."""
        response = client.post(
            "/api/v1/auth/logout",
            json={},
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        assert "Successfully logged out" in response.json()["message"]
    
    def test_refresh_token(self, client, db_session):
        """Test token refresh."""
        from app.services.authentication import authentication_service
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username="refreshtest",
            email="refresh@example.com",
            password="testpassword123",
            is_active=True
        )
        
        # Create a refresh token
        refresh_token = authentication_service.create_refresh_token(
            data={"sub": str(user.id), "username": user.username}
        )
        
        # Refresh the token
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tokens" in data
        assert "access_token" in data["tokens"]
    
    def test_refresh_token_invalid(self, client):
        """Test token refresh with invalid token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"}
        )
        
        assert response.status_code == 401
        assert "Invalid refresh token" in response.json()["detail"]


class TestRoleSwitching:
    """Test role switching functionality."""
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_switch_role_success(self, client, db_session):
        """Test successful role switching."""
        from app.services.authentication import authentication_service
        from app.services.role_management import role_management_service
        
        # Create a test user with multiple roles
        user = authentication_service.create_user(
            db_session,
            username="multirole",
            email="multirole@example.com",
            password="testpassword123",
            is_active=True
        )
        
        # Assign multiple roles
        role_management_service.assign_role(db_session, user.id, RoleType.VIEWER, is_active=True)
        role_management_service.assign_role(db_session, user.id, RoleType.PROJECT_MANAGER, is_active=True)
        
        # Mock the current user
        def mock_current_user():
            return user
        
        from app.main import app
        app.dependency_overrides[deps.get_current_active_user] = mock_current_user
        
        # Switch to PROJECT_MANAGER role
        response = client.post(
            "/api/v1/auth/switch-role",
            json={
                "role_type": RoleType.PROJECT_MANAGER.value
            },
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["active_role"] == RoleType.PROJECT_MANAGER.value
        assert "tokens" in data
        
        # Clean up
        app.dependency_overrides.pop(deps.get_current_active_user, None)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_switch_role_not_assigned(self, client, db_session):
        """Test switching to a role user doesn't have."""
        from app.services.authentication import authentication_service
        from app.services.role_management import role_management_service
        
        # Create a test user with only VIEWER role
        user = authentication_service.create_user(
            db_session,
            username="singlerole",
            email="singlerole@example.com",
            password="testpassword123",
            is_active=True
        )
        
        role_management_service.assign_role(db_session, user.id, RoleType.VIEWER, is_active=True)
        
        # Mock the current user
        def mock_current_user():
            return user
        
        from app.main import app
        app.dependency_overrides[deps.get_current_active_user] = mock_current_user
        
        # Try to switch to ADMIN role (not assigned)
        response = client.post(
            "/api/v1/auth/switch-role",
            json={
                "role_type": RoleType.ADMIN.value
            },
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 403
        assert "does not have role" in response.json()["detail"]
        
        # Clean up
        app.dependency_overrides.pop(deps.get_current_active_user, None)
