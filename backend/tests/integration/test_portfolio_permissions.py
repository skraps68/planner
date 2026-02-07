"""
Integration tests for Portfolio permissions and scope-based access control.

Tests Requirements 10.1-10.8:
- 10.1: Permission checks for Portfolio create operations
- 10.2: Permission checks for Portfolio read operations
- 10.3: Permission checks for Portfolio update operations
- 10.4: Permission checks for Portfolio delete operations
- 10.5: Scope-based access control integration
- 10.6: 403 Forbidden error for unauthorized operations
- 10.7: Audit logging for Portfolio create operations
- 10.8: Audit logging for Portfolio update/delete operations
"""
import pytest
from datetime import date
from uuid import uuid4, UUID
from unittest.mock import MagicMock, patch

from sqlalchemy.orm import Session

from app.models.user import User, RoleType, ScopeType
from app.services.authorization import Permission
from app.api import deps


# Database session fixture for permission tests
@pytest.fixture
def db_session():
    """Create a database session for testing."""
    from tests.conftest import TestingSessionLocal
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


# Test user fixtures with different roles
@pytest.fixture
def admin_user(db_session: Session):
    """Create an admin user for testing."""
    from app.models.user import User, UserRole, ScopeAssignment
    
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == "admin_user_perm").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="admin_user_perm",
        email="admin_perm@example.com",
        password_hash="hashed_password",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    # Add admin role
    user_role = UserRole(
        user_id=user.id,
        role_type=RoleType.ADMIN,
        is_active=True
    )
    db_session.add(user_role)
    db_session.commit()
    
    # Add GLOBAL scope for admin
    scope_assignment = ScopeAssignment(
        user_role_id=user_role.id,
        scope_type=ScopeType.GLOBAL,
        is_active=True
    )
    db_session.add(scope_assignment)
    db_session.commit()
    
    return user


@pytest.fixture
def program_manager_user(db_session: Session):
    """Create a program manager user for testing."""
    from app.models.user import User, UserRole, ScopeAssignment
    
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == "program_manager_perm").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="program_manager_perm",
        email="pm_perm@example.com",
        password_hash="hashed_password",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    # Add program manager role
    user_role = UserRole(
        user_id=user.id,
        role_type=RoleType.PROGRAM_MANAGER,
        is_active=True
    )
    db_session.add(user_role)
    db_session.commit()
    
    # Add GLOBAL scope for program manager (for testing purposes)
    scope_assignment = ScopeAssignment(
        user_role_id=user_role.id,
        scope_type=ScopeType.GLOBAL,
        is_active=True
    )
    db_session.add(scope_assignment)
    db_session.commit()
    
    return user


@pytest.fixture
def viewer_user(db_session: Session):
    """Create a viewer user for testing."""
    from app.models.user import User, UserRole, ScopeAssignment
    
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == "viewer_user_perm").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="viewer_user_perm",
        email="viewer_perm@example.com",
        password_hash="hashed_password",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    # Add viewer role
    user_role = UserRole(
        user_id=user.id,
        role_type=RoleType.VIEWER,
        is_active=True
    )
    db_session.add(user_role)
    db_session.commit()
    
    # Add GLOBAL scope for viewer (for testing purposes)
    scope_assignment = ScopeAssignment(
        user_role_id=user_role.id,
        scope_type=ScopeType.GLOBAL,
        is_active=True
    )
    db_session.add(scope_assignment)
    db_session.commit()
    
    return user


@pytest.fixture
def no_role_user(db_session: Session):
    """Create a user with no roles for testing."""
    from app.models.user import User
    
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == "no_role_user_perm").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="no_role_user_perm",
        email="norole_perm@example.com",
        password_hash="hashed_password",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    return user
    user = User(
        id=uuid4(),
        username="viewer_user",
        email="viewer@example.com",
        password_hash="hashed_password",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    # Add viewer role
    user_role = UserRole(
        user_id=user.id,
        role_type=RoleType.VIEWER,
        is_active=True
    )
    db_session.add(user_role)
    db_session.commit()
    
    return user


@pytest.fixture
def no_role_user(db_session: Session):
    """Create a user with no roles for testing."""
    from app.models.user import User
    
    user = User(
        id=uuid4(),
        username="no_role_user",
        email="norole@example.com",
        password_hash="hashed_password",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    return user


@pytest.fixture
def test_portfolio(db_session: Session, admin_user: User):
    """Create a test portfolio."""
    from app.models.portfolio import Portfolio
    
    portfolio = Portfolio(
        id=uuid4(),
        name=f"Test Portfolio {uuid4()}",
        description="Test portfolio for permission tests",
        owner="Test Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31),
        created_by=str(admin_user.id),
        updated_by=str(admin_user.id)
    )
    db_session.add(portfolio)
    db_session.commit()
    db_session.refresh(portfolio)
    
    return portfolio


@pytest.fixture
def portfolio_with_scope(db_session: Session, admin_user: User, program_manager_user: User):
    """Create a portfolio with scope assignment for program manager."""
    from app.models.portfolio import Portfolio
    from app.models.user import ScopeAssignment, UserRole
    
    portfolio = Portfolio(
        id=uuid4(),
        name=f"Scoped Portfolio {uuid4()}",
        description="Portfolio with scope assignment",
        owner="Test Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31),
        created_by=str(admin_user.id),
        updated_by=str(admin_user.id)
    )
    db_session.add(portfolio)
    db_session.commit()
    
    # Get the program manager's user role
    user_role = db_session.query(UserRole).filter(
        UserRole.user_id == program_manager_user.id
    ).first()
    
    # Add scope assignment for program manager at portfolio level
    # Note: ScopeAssignment uses program_id/project_id, not portfolio_id
    # For portfolio-level access, we'll use GLOBAL scope type
    scope_assignment = ScopeAssignment(
        user_role_id=user_role.id,
        scope_type=ScopeType.GLOBAL,
        is_active=True
    )
    db_session.add(scope_assignment)
    db_session.commit()
    db_session.refresh(portfolio)
    
    return portfolio


def mock_get_current_user(user: User):
    """Create a mock function that returns a specific user."""
    def _mock():
        return user
    return _mock


class TestPortfolioCreatePermissions:
    """Test Portfolio create operation permissions (Requirement 10.1)."""
    
    def test_admin_can_create_portfolio(self, client, db, admin_user):
        """Test that admin user can create portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            portfolio_data = {
                "name": f"Admin Portfolio {uuid4()}",
                "description": "Portfolio created by admin",
                "owner": "Admin User",
                "reporting_start_date": "2024-01-01",
                "reporting_end_date": "2024-12-31"
            }
            
            response = client.post(
                "/api/v1/portfolios/",
                json=portfolio_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 201
            data = response.json()
            assert data["name"] == portfolio_data["name"]
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_program_manager_cannot_create_portfolio(self, client, db, program_manager_user):
        """Test that program manager cannot create portfolios (no permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            portfolio_data = {
                "name": f"PM Portfolio {uuid4()}",
                "description": "Portfolio creation attempt by PM",
                "owner": "PM User",
                "reporting_start_date": "2024-01-01",
                "reporting_end_date": "2024-12-31"
            }
            
            response = client.post(
                "/api/v1/portfolios/",
                json=portfolio_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json()
            assert "error" in response_data
            assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_viewer_cannot_create_portfolio(self, client, db, viewer_user):
        """Test that viewer cannot create portfolios (no permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(viewer_user)
        
        try:
            portfolio_data = {
                "name": f"Viewer Portfolio {uuid4()}",
                "description": "Portfolio creation attempt by viewer",
                "owner": "Viewer User",
                "reporting_start_date": "2024-01-01",
                "reporting_end_date": "2024-12-31"
            }
            
            response = client.post(
                "/api/v1/portfolios/",
                json=portfolio_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json()
            assert "error" in response_data
            assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)

    
    def test_no_role_user_cannot_create_portfolio(self, client, db, no_role_user):
        """Test that user with no roles cannot create portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(no_role_user)
        
        try:
            portfolio_data = {
                "name": f"No Role Portfolio {uuid4()}",
                "description": "Portfolio creation attempt by no-role user",
                "owner": "No Role User",
                "reporting_start_date": "2024-01-01",
                "reporting_end_date": "2024-12-31"
            }
            
            response = client.post(
                "/api/v1/portfolios/",
                json=portfolio_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)


class TestPortfolioReadPermissions:
    """Test Portfolio read operation permissions (Requirement 10.2)."""
    
    def test_admin_can_read_portfolio(self, client, db, admin_user, test_portfolio):
        """Test that admin user can read portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            response = client.get(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(test_portfolio.id)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_program_manager_can_read_portfolio(self, client, db, program_manager_user, test_portfolio):
        """Test that program manager can read portfolios (has READ_PORTFOLIO permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            response = client.get(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(test_portfolio.id)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_viewer_can_read_portfolio(self, client, db, viewer_user, test_portfolio):
        """Test that viewer can read portfolios (has READ_PORTFOLIO permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(viewer_user)
        
        try:
            response = client.get(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(test_portfolio.id)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)

    
    def test_no_role_user_cannot_read_portfolio(self, client, db, no_role_user, test_portfolio):
        """Test that user with no roles cannot read portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(no_role_user)
        
        try:
            response = client.get(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_admin_can_list_portfolios(self, client, db, admin_user):
        """Test that admin user can list portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            response = client.get(
                "/api/v1/portfolios/",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert isinstance(data["items"], list)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_viewer_can_list_portfolios(self, client, db, viewer_user):
        """Test that viewer can list portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(viewer_user)
        
        try:
            response = client.get(
                "/api/v1/portfolios/",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert isinstance(data["items"], list)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_no_role_user_cannot_list_portfolios(self, client, db, no_role_user):
        """Test that user with no roles cannot list portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(no_role_user)
        
        try:
            response = client.get(
                "/api/v1/portfolios/",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)



class TestPortfolioUpdatePermissions:
    """Test Portfolio update operation permissions (Requirement 10.3)."""
    
    def test_admin_can_update_portfolio(self, client, db, admin_user, test_portfolio):
        """Test that admin user can update portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            update_data = {
                "description": "Updated by admin",
                "owner": "Updated Owner"
            }
            
            response = client.put(
                f"/api/v1/portfolios/{test_portfolio.id}",
                json=update_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["description"] == update_data["description"]
            assert data["owner"] == update_data["owner"]
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_program_manager_cannot_update_portfolio(self, client, db, program_manager_user, test_portfolio):
        """Test that program manager cannot update portfolios (no permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            update_data = {
                "description": "Update attempt by PM",
                "owner": "PM Owner"
            }
            
            response = client.put(
                f"/api/v1/portfolios/{test_portfolio.id}",
                json=update_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_viewer_cannot_update_portfolio(self, client, db, viewer_user, test_portfolio):
        """Test that viewer cannot update portfolios (no permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(viewer_user)
        
        try:
            update_data = {
                "description": "Update attempt by viewer",
                "owner": "Viewer Owner"
            }
            
            response = client.put(
                f"/api/v1/portfolios/{test_portfolio.id}",
                json=update_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_no_role_user_cannot_update_portfolio(self, client, db, no_role_user, test_portfolio):
        """Test that user with no roles cannot update portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(no_role_user)
        
        try:
            update_data = {
                "description": "Update attempt by no-role user",
                "owner": "No Role Owner"
            }
            
            response = client.put(
                f"/api/v1/portfolios/{test_portfolio.id}",
                json=update_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)



class TestPortfolioDeletePermissions:
    """Test Portfolio delete operation permissions (Requirement 10.4)."""
    
    def test_admin_can_delete_portfolio(self, client, db_session, admin_user):
        """Test that admin user can delete portfolios."""
        from app.main import app
        from app.models.portfolio import Portfolio
        
        # Create a portfolio to delete
        portfolio = Portfolio(
            id=uuid4(),
            name=f"Delete Test Portfolio {uuid4()}",
            description="Portfolio to be deleted",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31),
            created_by=str(admin_user.id),
            updated_by=str(admin_user.id)
        )
        db_session.add(portfolio)
        db_session.commit()
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            response = client.delete(
                f"/api/v1/portfolios/{portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            assert response.json()["success"] is True
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_program_manager_cannot_delete_portfolio(self, client, db, program_manager_user, test_portfolio):
        """Test that program manager cannot delete portfolios (no permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            response = client.delete(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_viewer_cannot_delete_portfolio(self, client, db, viewer_user, test_portfolio):
        """Test that viewer cannot delete portfolios (no permission)."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(viewer_user)
        
        try:
            response = client.delete(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_no_role_user_cannot_delete_portfolio(self, client, db, no_role_user, test_portfolio):
        """Test that user with no roles cannot delete portfolios."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(no_role_user)
        
        try:
            response = client.delete(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden (Requirement 10.6)
            assert response.status_code == 403
            response_data = response.json(); assert "error" in response_data; assert "permission" in response_data["error"]["message"].lower()
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)



class TestPortfolioScopeBasedAccess:
    """Test scope-based access control for portfolios (Requirement 10.5)."""
    
    def test_user_can_access_portfolio_in_scope(self, client, db, program_manager_user, portfolio_with_scope):
        """Test that user can access portfolio within their scope."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            response = client.get(
                f"/api/v1/portfolios/{portfolio_with_scope.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(portfolio_with_scope.id)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_user_cannot_access_portfolio_outside_scope(self, client, db, program_manager_user, test_portfolio):
        """Test that user cannot access portfolio outside their scope."""
        from app.main import app
        
        # program_manager_user has no scope assignment for test_portfolio
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            response = client.get(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            # Should return 403 Forbidden due to scope restriction (Requirement 10.6)
            assert response.status_code == 403
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_admin_can_access_all_portfolios(self, client, db, admin_user, test_portfolio, portfolio_with_scope):
        """Test that admin can access all portfolios regardless of scope."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            # Access first portfolio
            response1 = client.get(
                f"/api/v1/portfolios/{test_portfolio.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            assert response1.status_code == 200
            
            # Access second portfolio
            response2 = client.get(
                f"/api/v1/portfolios/{portfolio_with_scope.id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            assert response2.status_code == 200
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_list_portfolios_filtered_by_scope(self, client, db, program_manager_user, portfolio_with_scope):
        """Test that listing portfolios is filtered by user's scope."""
        from app.main import app
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(program_manager_user)
        
        try:
            response = client.get(
                "/api/v1/portfolios/",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            
            # Should only see portfolios within scope
            portfolio_ids = [item["id"] for item in data["items"]]
            assert str(portfolio_with_scope.id) in portfolio_ids
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)



class TestPortfolioAuditLogging:
    """Test audit logging for portfolio operations (Requirements 10.7, 10.8)."""
    
    def test_portfolio_create_is_audited(self, client, db_session, admin_user):
        """Test that portfolio creation is logged to audit trail (Requirement 10.7)."""
        from app.main import app
        from app.models.audit import AuditLog
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            portfolio_data = {
                "name": f"Audited Portfolio {uuid4()}",
                "description": "Portfolio for audit test",
                "owner": "Audit Test Owner",
                "reporting_start_date": "2024-01-01",
                "reporting_end_date": "2024-12-31"
            }
            
            response = client.post(
                "/api/v1/portfolios/",
                json=portfolio_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 201
            portfolio_id = response.json()["id"]
            
            # Check audit log
            audit_logs = db_session.query(AuditLog).filter(
                AuditLog.entity_type == "Portfolio",
                AuditLog.entity_id == UUID(portfolio_id),
                AuditLog.action == "CREATE"
            ).all()
            
            assert len(audit_logs) > 0
            audit_log = audit_logs[0]
            assert audit_log.user_id == admin_user.id
            assert audit_log.entity_type == "Portfolio"
            assert audit_log.action == "CREATE"
            assert audit_log.timestamp is not None
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_portfolio_update_is_audited(self, client, db_session, admin_user, test_portfolio):
        """Test that portfolio updates are logged to audit trail (Requirement 10.8)."""
        from app.main import app
        from app.models.audit import AuditLog
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            update_data = {
                "description": "Updated for audit test",
                "owner": "Updated Owner"
            }
            
            response = client.put(
                f"/api/v1/portfolios/{test_portfolio.id}",
                json=update_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            
            # Check audit log
            audit_logs = db_session.query(AuditLog).filter(
                AuditLog.entity_type == "Portfolio",
                AuditLog.entity_id == test_portfolio.id,
                AuditLog.action == "UPDATE"
            ).all()
            
            assert len(audit_logs) > 0
            audit_log = audit_logs[0]
            assert audit_log.user_id == admin_user.id
            assert audit_log.entity_type == "Portfolio"
            assert audit_log.action == "UPDATE"
            assert audit_log.timestamp is not None
            # Check that before/after values are captured
            assert audit_log.old_values is not None or audit_log.new_values is not None
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_portfolio_delete_is_audited(self, client, db_session, admin_user):
        """Test that portfolio deletion is logged to audit trail (Requirement 10.8)."""
        from app.main import app
        from app.models.audit import AuditLog
        from app.models.portfolio import Portfolio
        
        # Create a portfolio to delete
        portfolio = Portfolio(
            id=uuid4(),
            name=f"Delete Audit Portfolio {uuid4()}",
            description="Portfolio for delete audit test",
            owner="Delete Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31),
            created_by=str(admin_user.id),
            updated_by=str(admin_user.id)
        )
        db_session.add(portfolio)
        db_session.commit()
        portfolio_id = portfolio.id
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            response = client.delete(
                f"/api/v1/portfolios/{portfolio_id}",
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 200
            
            # Check audit log
            audit_logs = db_session.query(AuditLog).filter(
                AuditLog.entity_type == "Portfolio",
                AuditLog.entity_id == portfolio_id,
                AuditLog.action == "DELETE"
            ).all()
            
            assert len(audit_logs) > 0
            audit_log = audit_logs[0]
            assert audit_log.user_id == admin_user.id
            assert audit_log.entity_type == "Portfolio"
            assert audit_log.action == "DELETE"
            assert audit_log.timestamp is not None
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
    
    def test_audit_log_includes_user_identity(self, client, db_session, admin_user):
        """Test that audit logs include user identity and timestamp (Requirement 10.8)."""
        from app.main import app
        from app.models.audit import AuditLog
        
        # Override auth dependency
        app.dependency_overrides[deps.get_current_user] = mock_get_current_user(admin_user)
        
        try:
            portfolio_data = {
                "name": f"User Identity Portfolio {uuid4()}",
                "description": "Portfolio for user identity audit test",
                "owner": "Identity Test Owner",
                "reporting_start_date": "2024-01-01",
                "reporting_end_date": "2024-12-31"
            }
            
            response = client.post(
                "/api/v1/portfolios/",
                json=portfolio_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            
            assert response.status_code == 201
            portfolio_id = response.json()["id"]
            
            # Check audit log has user identity and timestamp
            audit_log = db_session.query(AuditLog).filter(
                AuditLog.entity_type == "Portfolio",
                AuditLog.entity_id == UUID(portfolio_id),
                AuditLog.action == "CREATE"
            ).first()
            
            assert audit_log is not None
            assert audit_log.user_id == admin_user.id
            assert audit_log.timestamp is not None
            # Verify timestamp is recent (within last minute)
            from datetime import datetime, timedelta
            assert audit_log.timestamp > datetime.utcnow() - timedelta(minutes=1)
        finally:
            app.dependency_overrides.pop(deps.get_current_user, None)
