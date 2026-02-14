"""
Integration tests for Program API endpoints.
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
    existing_user = db_session.query(User).filter(User.username == "test_admin_program").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="test_admin_program",
        email="admin_program@test.com",
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


@pytest.fixture
def test_portfolio(client, override_auth_dependency):
    """Create a test portfolio for program tests."""
    portfolio_data = {
        "name": f"Test Portfolio {uuid4()}",
        "description": "Test portfolio for program tests",
        "owner": "Test Owner",
        "reporting_start_date": "2024-01-01",
        "reporting_end_date": "2024-12-31"
    }
    
    response = client.post(
        "/api/v1/portfolios/",
        json=portfolio_data,
        headers={"Authorization": "Bearer fake-token"}
    )
    
    if response.status_code == 201:
        return response.json()
    else:
        # If portfolio creation fails, return None
        return None


class TestProgramAPIBasic:
    """Test basic API endpoints without authentication."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_api_root(self, client):
        """Test API root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_api_v1_info(self, client):
        """Test API v1 info endpoint."""
        response = client.get("/api/v1/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Program and Project Management System API v1"
        assert "programs" in data["available_routes"]
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_openapi_schema(self, client):
        """Test that OpenAPI schema is available."""
        response = client.get("/api/v1/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "openapi" in schema
        assert "paths" in schema
        # Check that program endpoints are documented
        assert "/api/v1/programs/" in schema["paths"]
        assert "/api/v1/programs/{program_id}" in schema["paths"]


class TestProgramAPICRUD:
    """Test Program API CRUD operations with mocked authentication."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_program_success(self, client, test_portfolio):
        """Test successful program creation."""
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "description": "Test program description",
            "portfolio_id": test_portfolio["id"]
        }
        
        response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Debug: print response if it fails
        if response.status_code != 201:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.json()}")
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == program_data["name"]
        assert data["business_sponsor"] == program_data["business_sponsor"]
        assert "id" in data
        assert "created_at" in data
        assert data["project_count"] == 0
    
    def test_create_program_invalid_dates(self, client, test_portfolio):
        """Test program creation with invalid dates."""
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-12-31",
            "end_date": "2024-01-01",  # End before start
            "portfolio_id": test_portfolio["id"]
        }
        
        response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_create_program_duplicate_name(self, client, test_portfolio):
        """Test program creation with duplicate name."""
        program_name = f"Unique Program {uuid4()}"
        program_data = {
            "name": program_name,
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        # Create first program
        response1 = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response1.status_code == 201
        
        # Try to create duplicate
        response2 = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]
    
    def test_list_programs(self, client):
        """Test listing programs."""
        response = client.get(
            "/api/v1/programs/",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert isinstance(data["items"], list)
    
    def test_list_programs_with_pagination(self, client):
        """Test listing programs with pagination."""
        response = client.get(
            "/api/v1/programs/?page=1&size=10",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["size"] == 10
        assert len(data["items"]) <= 10
    
    def test_get_program_by_id(self, client, test_portfolio):
        """Test getting a program by ID."""
        # Create a program first
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        program_id = create_response.json()["id"]
        
        # Get the program
        get_response = client.get(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == program_id
        assert data["name"] == program_data["name"]
    
    def test_get_program_not_found(self, client):
        """Test getting a non-existent program."""
        fake_id = uuid4()
        response = client.get(
            f"/api/v1/programs/{fake_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_get_program_by_name(self, client, test_portfolio):
        """Test getting a program by name."""
        # Create a program first
        program_name = f"Test Program {uuid4()}"
        program_data = {
            "name": program_name,
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        
        # Get the program by name
        get_response = client.get(
            f"/api/v1/programs/name/{program_name}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["name"] == program_name
    
    def test_update_program(self, client, test_portfolio):
        """Test updating a program."""
        # Create a program first
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        created_program = create_response.json()
        program_id = created_program["id"]
        version = created_program["version"]
        
        # Update the program
        update_data = {
            "description": "Updated description",
            "program_manager": "New Manager",
            "version": version
        }
        
        update_response = client.put(
            f"/api/v1/programs/{program_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["description"] == update_data["description"]
        assert data["program_manager"] == update_data["program_manager"]
        assert data["name"] == program_data["name"]  # Unchanged
        assert data["version"] == version + 1  # Version incremented
    
    def test_update_program_invalid_dates(self, client, test_portfolio):
        """Test updating a program with invalid dates."""
        # Create a program first
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        program_id = create_response.json()["id"]
        
        # Try to update with invalid dates
        update_data = {
            "start_date": "2024-12-31",
            "end_date": "2024-01-01"
        }
        
        update_response = client.put(
            f"/api/v1/programs/{program_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code in [400, 422]  # Either business logic or validation error
    
    def test_delete_program(self, client, test_portfolio):
        """Test deleting a program."""
        # Create a program first
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        program_id = create_response.json()["id"]
        
        # Delete the program
        delete_response = client.delete(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] is True
        
        # Verify it's deleted
        get_response = client.get(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert get_response.status_code == 404
    
    def test_get_program_summary(self, client, test_portfolio):
        """Test getting a program summary."""
        # Create a program first
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        program_id = create_response.json()["id"]
        
        # Get the summary
        summary_response = client.get(
            f"/api/v1/programs/{program_id}/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert summary_response.status_code == 200
        data = summary_response.json()
        assert data["id"] == program_id
        assert data["name"] == program_data["name"]
        assert "project_count" in data
    
    def test_get_program_projects(self, client, test_portfolio):
        """Test getting a program's projects."""
        # Create a program first
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        program_id = create_response.json()["id"]
        
        # Get the projects
        projects_response = client.get(
            f"/api/v1/programs/{program_id}/projects",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert projects_response.status_code == 200
        data = projects_response.json()
        assert isinstance(data, list)
        # Should be empty since we haven't added any projects
        assert len(data) == 0


class TestProgramAPIAuthentication:
    """Test authentication requirements."""
    
    def test_create_program_requires_auth(self, client):
        """Test that creating a program requires authentication."""
        program_data = {
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        response = client.post("/api/v1/programs/", json=program_data)
        # Should return 401, 403, or 501 (not implemented)
        assert response.status_code in [401, 403, 501]
    
    def test_list_programs_requires_auth(self, client):
        """Test that listing programs requires authentication."""
        response = client.get("/api/v1/programs/")
        # Should return 401, 403, or 501 (not implemented)
        assert response.status_code in [401, 403, 501]
    
    def test_get_program_requires_auth(self, client):
        """Test that getting a program requires authentication."""
        program_id = uuid4()
        response = client.get(f"/api/v1/programs/{program_id}")
        # Should return 401, 403, or 501 (not implemented)
        assert response.status_code in [401, 403, 501]


class TestProgramPortfolioRelationship:
    """Test Program-Portfolio relationship in API."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_program_without_portfolio_id_fails(self, client):
        """Test that creating a program without portfolio_id returns 400."""
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "description": "Test program without portfolio"
        }
        
        response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail validation because portfolio_id is required
        assert response.status_code == 422  # Validation error
        assert "portfolio_id" in str(response.json()).lower()
    
    def test_create_program_with_invalid_portfolio_id_fails(self, client):
        """Test that creating a program with invalid portfolio_id returns 400."""
        fake_portfolio_id = str(uuid4())
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": fake_portfolio_id
        }
        
        response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail because portfolio doesn't exist
        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"].lower()
    
    def test_get_program_includes_portfolio_data(self, client, test_portfolio):
        """Test that getting a program includes portfolio data."""
        # Create a program
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        program_id = create_response.json()["id"]
        
        # Get the program
        get_response = client.get(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Verify portfolio_id is included
        assert "portfolio_id" in data
        assert data["portfolio_id"] == test_portfolio["id"]
        
        # Verify portfolio data is included
        assert "portfolio" in data
        if data["portfolio"] is not None:
            assert data["portfolio"]["id"] == test_portfolio["id"]
            assert data["portfolio"]["name"] == test_portfolio["name"]
    
    def test_update_program_portfolio_id(self, client, test_portfolio):
        """Test updating a program's portfolio_id."""
        # Create a second portfolio
        portfolio2_data = {
            "name": f"Test Portfolio 2 {uuid4()}",
            "description": "Second test portfolio",
            "owner": "Test Owner 2",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        portfolio2_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio2_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert portfolio2_response.status_code == 201
        portfolio2 = portfolio2_response.json()
        
        # Create a program with first portfolio
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        created_program = create_response.json()
        program_id = created_program["id"]
        version = created_program["version"]
        
        # Update to second portfolio
        update_data = {
            "portfolio_id": portfolio2["id"],
            "version": version
        }
        
        update_response = client.put(
            f"/api/v1/programs/{program_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["portfolio_id"] == portfolio2["id"]
        assert data["version"] == version + 1
        
        # Verify the change persisted
        get_response = client.get(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert get_response.status_code == 200
        assert get_response.json()["portfolio_id"] == portfolio2["id"]
    
    def test_update_program_with_invalid_portfolio_id_fails(self, client, test_portfolio):
        """Test that updating a program with invalid portfolio_id returns 400."""
        # Create a program
        program_data = {
            "name": f"Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "portfolio_id": test_portfolio["id"]
        }
        
        create_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        created_program = create_response.json()
        program_id = created_program["id"]
        version = created_program["version"]
        
        # Try to update with invalid portfolio_id
        fake_portfolio_id = str(uuid4())
        update_data = {
            "portfolio_id": fake_portfolio_id,
            "version": version
        }
        
        update_response = client.put(
            f"/api/v1/programs/{program_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 400
        assert "does not exist" in update_response.json()["detail"].lower()