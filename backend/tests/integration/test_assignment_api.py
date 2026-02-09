"""
Integration tests for Assignment API endpoints.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.models.project import Project
from app.models.program import Program
from app.models.portfolio import Portfolio
from app.models.resource_assignment import ResourceAssignment
from app.api import deps
from tests.conftest import TestingSessionLocal


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
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def db_session():
    """Create a database session for direct database operations."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_data(db_session, override_auth_dependency):
    """Create test data directly in database."""
    # Create portfolio
    portfolio = Portfolio(
        id=uuid4(),
        name=f"Test Portfolio {uuid4()}",
        description="Test portfolio"
    )
    db_session.add(portfolio)
    
    # Create program
    program = Program(
        id=uuid4(),
        portfolio_id=portfolio.id,
        name=f"Test Program {uuid4()}",
        business_sponsor="John Doe",
        program_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31)
    )
    db_session.add(program)
    
    # Create project
    project = Project(
        id=uuid4(),
        program_id=program.id,
        name=f"Test Project {uuid4()}",
        business_sponsor="Alice Brown",
        project_manager="Bob White",
        technical_lead="Charlie Green",
        start_date=date(2024, 2, 1),
        end_date=date(2024, 11, 30),
        cost_center_code=f"CC-{uuid4().hex[:8]}"
    )
    db_session.add(project)
    
    # Create resource
    resource = Resource(
        id=uuid4(),
        name=f"Test Resource {uuid4()}",
        resource_type=ResourceType.LABOR,
        description="Test resource"
    )
    db_session.add(resource)
    
    db_session.commit()
    
    return {
        "portfolio": portfolio,
        "program": program,
        "project": project,
        "resource": resource
    }


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestAssignmentAPIWithoutAllocationPercentage:
    """Test Assignment API endpoints without allocation_percentage field."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_assignment_without_allocation_percentage(
        self, client: TestClient, test_data
    ):
        """Test creating assignment without allocation_percentage succeeds."""
        assignment_data = {
            "resource_id": str(test_data["resource"].id),
            "project_id": str(test_data["project"].id),
            "assignment_date": "2024-03-15",
            "capital_percentage": "60.00",
            "expense_percentage": "30.00"
        }
        
        response = client.post(
            "/api/v1/assignments/",
            json=assignment_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["capital_percentage"] == "60.00"
        assert data["expense_percentage"] == "30.00"
        assert "allocation_percentage" not in data
        assert "id" in data
        assert "created_at" in data
    
    def test_create_assignment_ignores_allocation_percentage_if_provided(
        self, client: TestClient, test_data
    ):
        """Test that allocation_percentage is ignored if provided in request."""
        assignment_data = {
            "resource_id": str(test_data["resource"].id),
            "project_id": str(test_data["project"].id),
            "assignment_date": "2024-03-16",
            "allocation_percentage": "90.00",  # Should be ignored
            "capital_percentage": "50.00",
            "expense_percentage": "40.00"
        }
        
        response = client.post(
            "/api/v1/assignments/",
            json=assignment_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should succeed and ignore allocation_percentage
        assert response.status_code == 201
        data = response.json()
        assert data["capital_percentage"] == "50.00"
        assert data["expense_percentage"] == "40.00"
        assert "allocation_percentage" not in data

    
    def test_update_assignment_without_allocation_percentage(
        self, client: TestClient, test_data, db_session
    ):
        """Test updating assignment without allocation_percentage succeeds."""
        # Create assignment directly in database
        assignment = ResourceAssignment(
            id=uuid4(),
            resource_id=test_data["resource"].id,
            project_id=test_data["project"].id,
            assignment_date=date(2024, 3, 17),
            capital_percentage=Decimal("40.00"),
            expense_percentage=Decimal("30.00")
        )
        db_session.add(assignment)
        db_session.commit()
        
        # Update the assignment
        update_data = {
            "capital_percentage": "50.00",
            "expense_percentage": "40.00"
        }
        
        update_response = client.put(
            f"/api/v1/assignments/{assignment.id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["capital_percentage"] == "50.00"
        assert data["expense_percentage"] == "40.00"
        assert "allocation_percentage" not in data
    
    def test_response_does_not_include_allocation_percentage(
        self, client: TestClient, test_data, db_session
    ):
        """Test that API responses don't include allocation_percentage."""
        # Create assignment directly in database
        assignment = ResourceAssignment(
            id=uuid4(),
            resource_id=test_data["resource"].id,
            project_id=test_data["project"].id,
            assignment_date=date(2024, 3, 18),
            capital_percentage=Decimal("70.00"),
            expense_percentage=Decimal("20.00")
        )
        db_session.add(assignment)
        db_session.commit()
        
        # Test GET by ID
        get_response = client.get(
            f"/api/v1/assignments/{assignment.id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert get_response.status_code == 200
        assert "allocation_percentage" not in get_response.json()
        
        # Test LIST
        list_response = client.get(
            "/api/v1/assignments/",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert list_response.status_code == 200
        for item in list_response.json()["items"]:
            assert "allocation_percentage" not in item



class TestAssignmentAPICrossProjectValidation:
    """Test cross-project allocation validation in API endpoints."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_assignment_validates_cross_project_allocation(
        self, client: TestClient, test_data, db_session
    ):
        """Test that cross-project validation errors are returned correctly."""
        # Create a second project
        project2 = Project(
            id=uuid4(),
            program_id=test_data["program"].id,
            name=f"Project 2 {uuid4()}",
            business_sponsor="Alice",
            project_manager="Bob",
            technical_lead="Charlie",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30),
            cost_center_code=f"CC2-{uuid4().hex[:8]}"
        )
        db_session.add(project2)
        db_session.commit()
        
        # Create first assignment (70% total)
        assignment1_data = {
            "resource_id": str(test_data["resource"].id),
            "project_id": str(test_data["project"].id),
            "assignment_date": "2024-03-20",
            "capital_percentage": "40.00",
            "expense_percentage": "30.00"
        }
        
        response1 = client.post(
            "/api/v1/assignments/",
            json=assignment1_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response1.status_code == 201
        
        # Try to create second assignment that would exceed 100% (70% + 50% = 120%)
        assignment2_data = {
            "resource_id": str(test_data["resource"].id),
            "project_id": str(project2.id),
            "assignment_date": "2024-03-20",
            "capital_percentage": "30.00",
            "expense_percentage": "20.00"
        }
        
        response2 = client.post(
            "/api/v1/assignments/",
            json=assignment2_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail with descriptive error
        assert response2.status_code == 400
        error_detail = response2.json()["detail"]
        assert "exceed" in error_detail.lower() or "allocation" in error_detail.lower()

    
    def test_update_assignment_validates_cross_project_allocation(
        self, client: TestClient, test_data, db_session
    ):
        """Test that update validates cross-project allocation."""
        # Create a second project
        project2 = Project(
            id=uuid4(),
            program_id=test_data["program"].id,
            name=f"Project 2 {uuid4()}",
            business_sponsor="Alice",
            project_manager="Bob",
            technical_lead="Charlie",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30),
            cost_center_code=f"CC2-{uuid4().hex[:8]}"
        )
        db_session.add(project2)
        
        # Create two assignments directly in database
        assignment1 = ResourceAssignment(
            id=uuid4(),
            resource_id=test_data["resource"].id,
            project_id=test_data["project"].id,
            assignment_date=date(2024, 3, 21),
            capital_percentage=Decimal("30.00"),
            expense_percentage=Decimal("20.00")
        )
        db_session.add(assignment1)
        
        assignment2 = ResourceAssignment(
            id=uuid4(),
            resource_id=test_data["resource"].id,
            project_id=project2.id,
            assignment_date=date(2024, 3, 21),
            capital_percentage=Decimal("20.00"),
            expense_percentage=Decimal("10.00")
        )
        db_session.add(assignment2)
        db_session.commit()
        
        # Try to update first assignment to exceed 100% total
        update_data = {
            "capital_percentage": "60.00",
            "expense_percentage": "30.00"
        }
        
        update_response = client.put(
            f"/api/v1/assignments/{assignment1.id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail with descriptive error
        assert update_response.status_code == 400
        error_detail = update_response.json()["detail"]
        assert "exceed" in error_detail.lower() or "allocation" in error_detail.lower()
    
    def test_error_messages_are_descriptive(
        self, client: TestClient, test_data
    ):
        """Test that validation error messages are descriptive."""
        # Create assignment with invalid percentages (sum > 100)
        assignment_data = {
            "resource_id": str(test_data["resource"].id),
            "project_id": str(test_data["project"].id),
            "assignment_date": "2024-03-22",
            "capital_percentage": "70.00",
            "expense_percentage": "50.00"
        }
        
        response = client.post(
            "/api/v1/assignments/",
            json=assignment_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail with descriptive error
        assert response.status_code == 400
        error_detail = response.json()["detail"]
        # Error should mention the constraint violation
        assert "100" in error_detail or "exceed" in error_detail.lower()



class TestAssignmentAPI:
    """Test Assignment API endpoints."""
    
    def test_create_assignment(self, client: TestClient):
        """Test creating a resource assignment."""
        assignment_data = {
            "resource_id": str(uuid4()),
            "project_id": str(uuid4()),
            "project_phase_id": str(uuid4()),
            "assignment_date": "2024-01-15",
            "allocation_percentage": "75.00",
            "capital_percentage": "60.00",
            "expense_percentage": "40.00"
        }
        
        response = client.post(
            "/api/v1/assignments/",
            json=assignment_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_list_assignments(self, client: TestClient):
        """Test listing assignments."""
        response = client.get(
            "/api/v1/assignments/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_assignment(self, client: TestClient):
        """Test getting an assignment by ID."""
        assignment_id = uuid4()
        response = client.get(
            f"/api/v1/assignments/{assignment_id}",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_update_assignment(self, client: TestClient):
        """Test updating an assignment."""
        assignment_id = uuid4()
        update_data = {
            "allocation_percentage": "80.00"
        }
        
        response = client.put(
            f"/api/v1/assignments/{assignment_id}",
            json=update_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_delete_assignment(self, client: TestClient):
        """Test deleting an assignment."""
        assignment_id = uuid4()
        response = client.delete(
            f"/api/v1/assignments/{assignment_id}",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_assignments_by_project(self, client: TestClient):
        """Test getting assignments by project."""
        project_id = uuid4()
        response = client.get(
            f"/api/v1/assignments/project/{project_id}/list",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_assignments_by_resource(self, client: TestClient):
        """Test getting assignments by resource."""
        resource_id = uuid4()
        response = client.get(
            f"/api/v1/assignments/resource/{resource_id}/list",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_assignments_by_date(self, client: TestClient):
        """Test getting assignments by resource and date."""
        resource_id = uuid4()
        assignment_date = "2024-01-15"
        response = client.get(
            f"/api/v1/assignments/resource/{resource_id}/date/{assignment_date}",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_resource_allocation(self, client: TestClient):
        """Test getting resource allocation for a date."""
        resource_id = uuid4()
        assignment_date = "2024-01-15"
        response = client.get(
            f"/api/v1/assignments/resource/{resource_id}/allocation/{assignment_date}",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_check_allocation_conflicts(self, client: TestClient):
        """Test checking for allocation conflicts."""
        resource_id = uuid4()
        response = client.post(
            "/api/v1/assignments/check-conflicts",
            params={
                "resource_id": str(resource_id),
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            },
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401


class TestAPIInfo:
    """Test API info endpoint."""
    
    def test_api_info(self, client: TestClient):
        """Test API info endpoint includes assignments route."""
        response = client.get("/api/v1/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "available_routes" in data
        assert "assignments" in data["available_routes"]
        assert data["available_routes"]["assignments"] == "/api/v1/assignments"
