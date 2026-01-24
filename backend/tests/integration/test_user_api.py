"""
Integration tests for User Management API endpoints.
"""
import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from app.models.user import User, RoleType, ScopeType
from app.api import deps


# Mock admin user for authentication bypass
def mock_get_admin_user():
    """Mock admin user for testing."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.username = "adminuser"
    user.email = "admin@example.com"
    user.is_active = True
    return user


@pytest.fixture
def override_auth_dependency():
    """Override authentication dependency for tests that need it."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_admin_user
    app.dependency_overrides[deps.get_current_active_user] = mock_get_admin_user
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


class TestUserManagementAPI:
    """Test user management API endpoints."""
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_create_user_success(self, client, db_session):
        """Test successful user creation."""
        from app.services.authorization import authorization_service
        from app.services.role_management import role_management_service
        
        # Get the mock admin user and give it admin role
        admin_user_id = mock_get_admin_user().id
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        user_data = {
            "username": f"newuser_{uuid4().hex[:8]}",
            "email": f"newuser_{uuid4().hex[:8]}@example.com",
            "password": "securepassword123",
            "is_active": True
        }
        
        response = client.post(
            "/api/v1/users",
            json=user_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == user_data["username"]
        assert data["email"] == user_data["email"]
        assert data["is_active"] == True
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_create_user_duplicate_username(self, client, db_session):
        """Test user creation with duplicate username."""
        from app.services.authentication import authentication_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create initial user
        username = f"duplicate_{uuid4().hex[:8]}"
        authentication_service.create_user(
            db_session,
            username=username,
            email=f"{username}@example.com",
            password="password123",
            is_active=True
        )
        
        # Try to create another user with same username
        user_data = {
            "username": username,
            "email": "different@example.com",
            "password": "password123",
            "is_active": True
        }
        
        response = client.post(
            "/api/v1/users",
            json=user_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 400
        assert "Username already exists" in response.json()["detail"]
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_list_users(self, client, db_session):
        """Test listing users."""
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        response = client.get(
            "/api/v1/users",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_user_by_id(self, client, db_session):
        """Test getting user by ID."""
        from app.services.authentication import authentication_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username=f"getuser_{uuid4().hex[:8]}",
            email=f"getuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        response = client.get(
            f"/api/v1/users/{user.id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == user.username
        assert data["email"] == user.email
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_update_user(self, client, db_session):
        """Test updating user."""
        from app.services.authentication import authentication_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username=f"updateuser_{uuid4().hex[:8]}",
            email=f"updateuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        # Update user
        update_data = {
            "email": f"updated_{uuid4().hex[:8]}@example.com",
            "is_active": False
        }
        
        response = client.put(
            f"/api/v1/users/{user.id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == update_data["email"]
        assert data["is_active"] == False
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_delete_user(self, client, db_session):
        """Test deleting (deactivating) user."""
        from app.services.authentication import authentication_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username=f"deleteuser_{uuid4().hex[:8]}",
            email=f"deleteuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        response = client.delete(
            f"/api/v1/users/{user.id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 204
        
        # Verify user is deactivated - need to query fresh from DB
        from app.repositories.user import user_repository
        db_session.expire_all()  # Expire all cached objects
        updated_user = user_repository.get(db_session, user.id)
        assert updated_user.is_active == False


class TestRoleManagementAPI:
    """Test role management API endpoints."""
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_assign_role_to_user(self, client, db_session):
        """Test assigning a role to a user."""
        from app.services.authentication import authentication_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user
        user = authentication_service.create_user(
            db_session,
            username=f"roleuser_{uuid4().hex[:8]}",
            email=f"roleuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        # Assign role
        role_data = {
            "user_id": str(user.id),
            "role_type": RoleType.PROJECT_MANAGER.value,
            "is_active": True
        }
        
        response = client.post(
            f"/api/v1/users/{user.id}/roles",
            json=role_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["role_type"] == RoleType.PROJECT_MANAGER.value
        assert data["is_active"] == True
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_user_roles(self, client, db_session):
        """Test getting user roles."""
        from app.services.authentication import authentication_service
        from app.services.role_management import role_management_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user with roles
        user = authentication_service.create_user(
            db_session,
            username=f"rolesuser_{uuid4().hex[:8]}",
            email=f"rolesuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        role_management_service.assign_role(db_session, user.id, RoleType.VIEWER, is_active=True)
        role_management_service.assign_role(db_session, user.id, RoleType.PROJECT_MANAGER, is_active=True)
        
        response = client.get(
            f"/api/v1/users/{user.id}/roles",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        role_types = [role["role_type"] for role in data]
        assert RoleType.VIEWER.value in role_types
        assert RoleType.PROJECT_MANAGER.value in role_types
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_remove_role_from_user(self, client, db_session):
        """Test removing a role from a user."""
        from app.services.authentication import authentication_service
        from app.services.role_management import role_management_service
        from app.services.authorization import authorization_service
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user with a role
        user = authentication_service.create_user(
            db_session,
            username=f"removerole_{uuid4().hex[:8]}",
            email=f"removerole_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        role_management_service.assign_role(db_session, user.id, RoleType.VIEWER, is_active=True)
        
        response = client.delete(
            f"/api/v1/users/{user.id}/roles/{RoleType.VIEWER.value}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 204


class TestScopeManagementAPI:
    """Test scope management API endpoints."""
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_assign_scope_to_role(self, client, db_session):
        """Test assigning a scope to a user role."""
        from app.services.authentication import authentication_service
        from app.services.role_management import role_management_service
        from app.services.authorization import authorization_service
        from app.repositories.program import program_repository
        from app.models.program import Program
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user with a role
        user = authentication_service.create_user(
            db_session,
            username=f"scopeuser_{uuid4().hex[:8]}",
            email=f"scopeuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        user_role = role_management_service.assign_role(
            db_session, user.id, RoleType.PROGRAM_MANAGER, is_active=True
        )
        
        # Create a test program
        from datetime import date
        program = Program(
            name=f"Test Program {uuid4().hex[:8]}",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db_session.add(program)
        db_session.commit()
        db_session.refresh(program)
        
        # Assign scope
        scope_data = {
            "user_role_id": str(user_role.id),
            "scope_type": ScopeType.PROGRAM.value,
            "program_id": str(program.id),
            "project_id": None,
            "is_active": True
        }
        
        response = client.post(
            f"/api/v1/users/roles/{user_role.id}/scopes",
            json=scope_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["scope_type"] == ScopeType.PROGRAM.value
        assert data["program_id"] == str(program.id)
    
    @pytest.mark.usefixtures("override_auth_dependency")
    def test_get_role_scopes(self, client, db_session):
        """Test getting scopes for a user role."""
        from app.services.authentication import authentication_service
        from app.services.role_management import role_management_service
        from app.services.authorization import authorization_service
        from app.models.program import Program
        
        # Mock authorization check
        def mock_is_admin(db, user_id):
            return True
        
        authorization_service.is_admin = mock_is_admin
        
        # Create a test user with a role
        user = authentication_service.create_user(
            db_session,
            username=f"getscopeuser_{uuid4().hex[:8]}",
            email=f"getscopeuser_{uuid4().hex[:8]}@example.com",
            password="password123",
            is_active=True
        )
        
        user_role = role_management_service.assign_role(
            db_session, user.id, RoleType.PROGRAM_MANAGER, is_active=True
        )
        
        # Create a test program and assign scope
        from datetime import date
        program = Program(
            name=f"Test Program {uuid4().hex[:8]}",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db_session.add(program)
        db_session.commit()
        db_session.refresh(program)
        
        role_management_service.assign_scope(
            db_session,
            user_role.id,
            ScopeType.PROGRAM,
            program_id=program.id,
            is_active=True
        )
        
        response = client.get(
            f"/api/v1/users/roles/{user_role.id}/scopes",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert data[0]["scope_type"] == ScopeType.PROGRAM.value
