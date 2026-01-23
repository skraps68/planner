"""
Integration tests for Project API endpoints.

These tests verify end-to-end functionality from API endpoints through
services to database operations, ensuring data integrity and business logic.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.project import Project, ProjectPhase, PhaseType
from app.models.program import Program
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
def test_program(client, override_auth_dependency):
    """Create a test program for project tests."""
    program_data = {
        "name": f"Test Program {uuid4()}",
        "business_sponsor": "John Doe",
        "program_manager": "Jane Smith",
        "technical_lead": "Bob Johnson",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31"
    }
    
    response = client.post(
        "/api/v1/programs/",
        json=program_data,
        headers={"Authorization": "Bearer fake-token"}
    )
    assert response.status_code == 201
    return response.json()


class TestProjectAPIBasic:
    """Test basic API endpoints without authentication."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_api_v1_info_includes_projects(self, client):
        """Test API v1 info endpoint includes projects route."""
        response = client.get("/api/v1/")
        assert response.status_code == 200
        data = response.json()
        assert "projects" in data["available_routes"]
    
    def test_openapi_schema_includes_projects(self, client):
        """Test that OpenAPI schema includes project endpoints."""
        response = client.get("/api/v1/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "/api/v1/projects/" in schema["paths"]
        assert "/api/v1/projects/{project_id}" in schema["paths"]


class TestProjectAPICRUD:
    """Test Project API CRUD operations with mocked authentication."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_project_success(self, client, test_program):
        """Test successful project creation."""
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}",
            "description": "Test project description"
        }
        
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        if response.status_code != 201:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.json()}")
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == project_data["name"]
        assert data["program_id"] == project_data["program_id"]
        assert data["cost_center_code"] == project_data["cost_center_code"]
        assert "id" in data
        assert "created_at" in data
        assert "phases" in data
        assert len(data["phases"]) >= 1  # At least execution phase
    
    def test_create_project_with_planning_phase(self, client, test_program):
        """Test project creation with planning phase."""
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000&planning_capital_budget=20000&planning_expense_budget=10000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data["phases"]) == 2  # Planning and execution
    
    def test_create_project_invalid_dates(self, client, test_program):
        """Test project creation with invalid dates."""
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-11-30",
            "end_date": "2024-02-01",  # End before start
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_create_project_duplicate_cost_center(self, client, test_program):
        """Test project creation with duplicate cost center code."""
        cost_center = f"CC-{uuid4().hex[:8]}"
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": cost_center
        }
        
        # Create first project
        response1 = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response1.status_code == 201
        
        # Try to create duplicate
        project_data["name"] = f"Test Project {uuid4()}"  # Different name
        response2 = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]
    
    def test_list_projects(self, client):
        """Test listing projects."""
        response = client.get(
            "/api/v1/projects/",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert isinstance(data["items"], list)
    
    def test_list_projects_by_program(self, client, test_program):
        """Test listing projects filtered by program."""
        # Create a project
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        create_response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        
        # List projects for this program
        response = client.get(
            f"/api/v1/projects/?program_id={test_program['id']}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert all(p["program_id"] == test_program["id"] for p in data["items"])
    
    def test_get_project_by_id(self, client, test_program):
        """Test getting a project by ID."""
        # Create a project first
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        create_response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]
        
        # Get the project
        get_response = client.get(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == project_id
        assert data["name"] == project_data["name"]
    
    def test_get_project_not_found(self, client):
        """Test getting a non-existent project."""
        fake_id = uuid4()
        response = client.get(
            f"/api/v1/projects/{fake_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_get_project_by_cost_center(self, client, test_program):
        """Test getting a project by cost center code."""
        # Create a project first
        cost_center = f"CC-{uuid4().hex[:8]}"
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": cost_center
        }
        
        create_response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        
        # Get the project by cost center
        get_response = client.get(
            f"/api/v1/projects/cost-center/{cost_center}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["cost_center_code"] == cost_center
    
    def test_update_project(self, client, test_program):
        """Test updating a project."""
        # Create a project first
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        create_response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]
        
        # Update the project
        update_data = {
            "description": "Updated description",
            "project_manager": "New Manager"
        }
        
        update_response = client.put(
            f"/api/v1/projects/{project_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["description"] == update_data["description"]
        assert data["project_manager"] == update_data["project_manager"]
        assert data["name"] == project_data["name"]  # Unchanged
    
    def test_delete_project(self, client, test_program):
        """Test deleting a project."""
        # Create a project first
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        create_response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]
        
        # Delete the project
        delete_response = client.delete(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] is True
        
        # Verify it's deleted
        get_response = client.get(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert get_response.status_code == 404


class TestProjectPhaseAPI:
    """Test Project Phase API operations."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    @pytest.fixture
    def test_project(self, client, test_program):
        """Create a test project for phase tests."""
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 201
        return response.json()
    
    def test_get_project_phases(self, client, test_project):
        """Test getting all phases for a project."""
        response = client.get(
            f"/api/v1/projects/{test_project['id']}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least execution phase
    
    def test_get_execution_phase(self, client, test_project):
        """Test getting the execution phase."""
        response = client.get(
            f"/api/v1/projects/{test_project['id']}/phases/execution",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["phase_type"] == "execution"
    
    def test_create_planning_phase(self, client, test_project):
        """Test creating a planning phase."""
        response = client.post(
            f"/api/v1/projects/{test_project['id']}/phases/planning?capital_budget=20000&expense_budget=10000",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["phase_type"] == "planning"
        assert float(data["capital_budget"]) == 20000.0
        assert float(data["expense_budget"]) == 10000.0
        assert float(data["total_budget"]) == 30000.0
    
    def test_get_planning_phase(self, client, test_project):
        """Test getting the planning phase."""
        # Create planning phase first
        create_response = client.post(
            f"/api/v1/projects/{test_project['id']}/phases/planning?capital_budget=20000&expense_budget=10000",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        
        # Get planning phase
        response = client.get(
            f"/api/v1/projects/{test_project['id']}/phases/planning",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["phase_type"] == "planning"
    
    def test_update_phase_budget(self, client, test_project):
        """Test updating phase budget."""
        # Get execution phase
        phases_response = client.get(
            f"/api/v1/projects/{test_project['id']}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert phases_response.status_code == 200
        phases = phases_response.json()
        execution_phase = next(p for p in phases if p["phase_type"] == "execution")
        
        # Update budget
        response = client.put(
            f"/api/v1/projects/{test_project['id']}/phases/{execution_phase['id']}?capital_budget=150000&expense_budget=75000",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert float(data["capital_budget"]) == 150000.0
        assert float(data["expense_budget"]) == 75000.0
        assert float(data["total_budget"]) == 225000.0
    
    def test_delete_planning_phase(self, client, test_project):
        """Test deleting a planning phase."""
        # Create planning phase first
        create_response = client.post(
            f"/api/v1/projects/{test_project['id']}/phases/planning?capital_budget=20000&expense_budget=10000",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        phase_id = create_response.json()["id"]
        
        # Delete planning phase
        response = client.delete(
            f"/api/v1/projects/{test_project['id']}/phases/{phase_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestProjectReportingAPI:
    """Test Project Reporting API operations."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    @pytest.fixture
    def test_project(self, client, test_program):
        """Create a test project for reporting tests."""
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 201
        return response.json()
    
    def test_get_project_summary(self, client, test_project):
        """Test getting a project summary."""
        response = client.get(
            f"/api/v1/projects/{test_project['id']}/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_project["id"]
        assert data["name"] == test_project["name"]
        assert "program_name" in data
    
    def test_get_project_report(self, client, test_project):
        """Test getting a comprehensive project report."""
        response = client.get(
            f"/api/v1/projects/{test_project['id']}/report",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == test_project["id"]
        assert "financial_summary" in data
        assert "dates" in data
    
    def test_get_project_budget_status(self, client, test_project):
        """Test getting project budget status."""
        response = client.get(
            f"/api/v1/projects/{test_project['id']}/budget-status",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "budget" in data
        assert "actual" in data
        assert "forecast" in data
        assert "status" in data


class TestProjectAPIAuthentication:
    """Test authentication requirements."""
    
    def test_create_project_requires_auth(self, client):
        """Test that creating a project requires authentication."""
        project_data = {
            "program_id": str(uuid4()),
            "name": "Test Project",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": "CC-TEST"
        }
        response = client.post("/api/v1/projects/", json=project_data)
        assert response.status_code in [401, 403, 501]
    
    def test_list_projects_requires_auth(self, client):
        """Test that listing projects requires authentication."""
        response = client.get("/api/v1/projects/")
        assert response.status_code in [401, 403, 501]
    
    def test_get_project_requires_auth(self, client):
        """Test that getting a project requires authentication."""
        project_id = uuid4()
        response = client.get(f"/api/v1/projects/{project_id}")
        assert response.status_code in [401, 403, 501]
