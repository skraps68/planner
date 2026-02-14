"""
Integration tests for Portfolio API endpoints.
"""
import pytest
from datetime import date
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models.user import User, RoleType, UserRole, ScopeAssignment, ScopeType
from app.api import deps


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


@pytest.fixture
def admin_user(db_session: Session):
    """Create an admin user for testing."""
    from app.models.user import User, UserRole, ScopeAssignment, ScopeType
    
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == "test_admin").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="test_admin",
        email="admin@test.com",
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


def mock_get_current_user_factory(user: User):
    """Factory to create a mock get_current_user function."""
    def mock_get_current_user():
        return user
    return mock_get_current_user


@pytest.fixture
def override_auth_dependency(admin_user):
    """Override authentication dependency for tests that need it."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user_factory(admin_user)
    app.dependency_overrides[deps.get_current_active_user] = mock_get_current_user_factory(admin_user)
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)
    app.dependency_overrides.pop(deps.get_current_active_user, None)


class TestPortfolioAPIBasic:
    """Test basic API endpoints without authentication."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_api_v1_info_includes_portfolios(self, client):
        """Test API v1 info endpoint includes portfolios."""
        response = client.get("/api/v1/")
        assert response.status_code == 200
        data = response.json()
        assert "portfolios" in data["available_routes"]
        assert data["available_routes"]["portfolios"] == "/api/v1/portfolios"
    
    def test_openapi_schema_includes_portfolios(self, client):
        """Test that OpenAPI schema includes portfolio endpoints."""
        response = client.get("/api/v1/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "paths" in schema
        # Check that portfolio endpoints are documented
        assert "/api/v1/portfolios/" in schema["paths"]
        assert "/api/v1/portfolios/{portfolio_id}" in schema["paths"]


class TestPortfolioAPICRUD:
    """Test Portfolio API CRUD operations with mocked authentication."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_portfolio_success(self, client):
        """Test successful portfolio creation."""
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Debug: print response if it fails
        if response.status_code != 201:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.json()}")
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == portfolio_data["name"]
        assert data["description"] == portfolio_data["description"]
        assert data["owner"] == portfolio_data["owner"]
        assert "id" in data
        assert "created_at" in data
        assert data["program_count"] == 0
    
    def test_create_portfolio_invalid_dates(self, client):
        """Test portfolio creation with invalid dates (end before start)."""
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-12-31",
            "reporting_end_date": "2024-01-01"  # End before start
        }
        
        response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_create_portfolio_missing_required_fields(self, client):
        """Test portfolio creation with missing required fields."""
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            # Missing description, owner, and dates
        }
        
        response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_create_portfolio_duplicate_name(self, client):
        """Test portfolio creation with duplicate name."""
        portfolio_name = f"Unique Portfolio {uuid4()}"
        portfolio_data = {
            "name": portfolio_name,
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        # Create first portfolio
        response1 = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response1.status_code == 201
        
        # Try to create duplicate
        response2 = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]
    
    def test_list_portfolios(self, client):
        """Test listing portfolios."""
        response = client.get(
            "/api/v1/portfolios/",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert isinstance(data["items"], list)
    
    def test_list_portfolios_with_pagination(self, client):
        """Test listing portfolios with pagination."""
        response = client.get(
            "/api/v1/portfolios/?page=1&size=10",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["size"] == 10
        assert len(data["items"]) <= 10
    
    def test_get_portfolio_by_id(self, client):
        """Test getting a portfolio by ID."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        portfolio_id = create_response.json()["id"]
        
        # Get the portfolio
        get_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == portfolio_id
        assert data["name"] == portfolio_data["name"]
    
    def test_get_portfolio_not_found(self, client):
        """Test getting a non-existent portfolio returns 404."""
        fake_id = uuid4()
        response = client.get(
            f"/api/v1/portfolios/{fake_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_get_portfolio_by_name(self, client):
        """Test getting a portfolio by name."""
        # Create a portfolio first
        portfolio_name = f"Test Portfolio {uuid4()}"
        portfolio_data = {
            "name": portfolio_name,
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        
        # Get the portfolio by name
        get_response = client.get(
            f"/api/v1/portfolios/name/{portfolio_name}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["name"] == portfolio_name
    
    def test_update_portfolio(self, client):
        """Test updating a portfolio."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        created_portfolio = create_response.json()
        portfolio_id = created_portfolio["id"]
        version = created_portfolio["version"]
        
        # Update the portfolio
        update_data = {
            "description": "Updated description",
            "owner": "Jane Smith",
            "version": version
        }
        
        update_response = client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["description"] == update_data["description"]
        assert data["owner"] == update_data["owner"]
        assert data["name"] == portfolio_data["name"]  # Unchanged
        assert data["version"] == version + 1  # Version incremented
    
    def test_update_portfolio_invalid_dates(self, client):
        """Test updating a portfolio with invalid dates."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        created_portfolio = create_response.json()
        portfolio_id = created_portfolio["id"]
        version = created_portfolio["version"]
        
        # Try to update with invalid dates
        update_data = {
            "reporting_start_date": "2024-12-31",
            "reporting_end_date": "2024-01-01",
            "version": version
        }
        
        update_response = client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code in [400, 422]  # Either business logic or validation error
    
    def test_delete_portfolio_without_programs(self, client):
        """Test deleting a portfolio without programs."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        portfolio_id = create_response.json()["id"]
        
        # Delete the portfolio
        delete_response = client.delete(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] is True
        
        # Verify it's deleted
        get_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert get_response.status_code == 404
    
    def test_delete_portfolio_with_programs_fails(self, client):
        """Test deleting a portfolio with programs returns 409 Conflict."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_portfolio_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_portfolio_response.status_code == 201
        portfolio_id = create_portfolio_response.json()["id"]
        
        # Create a program in this portfolio
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": portfolio_id
        }
        
        create_program_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_program_response.status_code == 201
        
        # Try to delete the portfolio
        delete_response = client.delete(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert delete_response.status_code == 409  # Conflict
        assert "associated program" in delete_response.json()["detail"].lower()
    
    def test_get_portfolio_programs(self, client):
        """Test getting a portfolio's programs."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_portfolio_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_portfolio_response.status_code == 201
        portfolio_id = create_portfolio_response.json()["id"]
        
        # Create a program in this portfolio
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": portfolio_id
        }
        
        create_program_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_program_response.status_code == 201
        
        # Get the programs
        programs_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}/programs",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert programs_response.status_code == 200
        data = programs_response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == program_data["name"]
    
    def test_get_portfolio_programs_empty(self, client):
        """Test getting programs for a portfolio with no programs."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        portfolio_id = create_response.json()["id"]
        
        # Get the programs
        programs_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}/programs",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert programs_response.status_code == 200
        data = programs_response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    def test_get_portfolio_programs_not_found(self, client):
        """Test getting programs for a non-existent portfolio returns 404."""
        fake_id = uuid4()
        response = client.get(
            f"/api/v1/portfolios/{fake_id}/programs",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_get_portfolio_summary(self, client):
        """Test getting a portfolio summary."""
        # Create a portfolio first
        portfolio_data = {
            "name": f"Test Portfolio {uuid4()}",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        portfolio_id = create_response.json()["id"]
        
        # Get the summary
        summary_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert summary_response.status_code == 200
        data = summary_response.json()
        assert data["id"] == portfolio_id
        assert data["name"] == portfolio_data["name"]
        assert "program_count" in data


class TestPortfolioAPIAuthentication:
    """Test authentication requirements."""
    
    def test_create_portfolio_requires_auth(self, client):
        """Test that creating a portfolio requires authentication."""
        portfolio_data = {
            "name": "Test Portfolio",
            "description": "Test portfolio description",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        response = client.post("/api/v1/portfolios/", json=portfolio_data)
        # Should return 401, 403, or 501 (not implemented)
        assert response.status_code in [401, 403, 501]
    
    def test_list_portfolios_requires_auth(self, client):
        """Test that listing portfolios requires authentication."""
        response = client.get("/api/v1/portfolios/")
        # Should return 401, 403, or 501 (not implemented)
        assert response.status_code in [401, 403, 501]
    
    def test_get_portfolio_requires_auth(self, client):
        """Test that getting a portfolio requires authentication."""
        portfolio_id = uuid4()
        response = client.get(f"/api/v1/portfolios/{portfolio_id}")
        # Should return 401, 403, or 501 (not implemented)
        assert response.status_code in [401, 403, 501]
