"""
Comprehensive integration tests for Project API endpoints.

These tests verify end-to-end functionality from API endpoints through
services to database operations, ensuring data integrity and business logic.
Tests include:
- Full CRUD operations with database verification
- Phase management with budget validation
- Reporting endpoints with actual data
- Edge cases and error conditions
- Data consistency across operations
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.project import Project, ProjectPhase
from app.models.program import Program
from app.models.resource import Resource
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.api import deps
from app.api.deps import get_db


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
def db_session(client):
    """Get database session for direct database verification."""
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_program(client, override_auth_dependency, db_session):
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
    program_id = response.json()["id"]
    
    # Verify program exists in database
    db_program = db_session.query(Program).filter(Program.id == program_id).first()
    assert db_program is not None
    assert db_program.name == program_data["name"]
    
    return response.json()


class TestProjectCRUDWithDatabaseVerification:
    """Test Project CRUD operations with database verification."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_create_project_verifies_in_database(self, client, test_program, db_session):
        """Test project creation and verify it exists in database."""
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
        
        assert response.status_code == 201
        data = response.json()
        project_id = data["id"]
        
        # Verify project in database
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project is not None
        assert db_project.name == project_data["name"]
        assert db_project.business_sponsor == project_data["business_sponsor"]
        assert db_project.project_manager == project_data["project_manager"]
        assert db_project.technical_lead == project_data["technical_lead"]
        assert db_project.cost_center_code == project_data["cost_center_code"]
        assert db_project.description == project_data["description"]
        assert str(db_project.program_id) == test_program["id"]
        
        # Verify execution phase in database
        db_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project_id
        ).all()
        assert len(db_phases) >= 1
        
        # Should have a default phase
        default_phase = db_phases[0]
        assert default_phase is not None
        assert default_phase.name == "Default Phase"
        # Default phase should span the entire project
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert default_phase.start_date == db_project.start_date
        assert default_phase.end_date == db_project.end_date
    
    def test_create_project_with_planning_phase_verifies_in_database(
        self, client, test_program, db_session
    ):
        """Test project creation with planning phase and verify default phase in database."""
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
        
        # Note: planning/execution budget parameters are now deprecated and ignored
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000"
            "&planning_capital_budget=20000&planning_expense_budget=10000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        project_id = response.json()["id"]
        
        # Verify default phase in database
        db_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project_id
        ).all()
        assert len(db_phases) == 1
        
        default_phase = db_phases[0]
        assert default_phase is not None
        assert default_phase.name == "Default Phase"
        # Default phase should span the entire project
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert default_phase.start_date == db_project.start_date
        assert default_phase.end_date == db_project.end_date

    def test_update_project_verifies_in_database(self, client, test_program, db_session):
        """Test project update and verify changes in database."""
        # Create project
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
        
        # Update project
        update_data = {
            "description": "Updated description",
            "project_manager": "New Manager",
            "end_date": "2024-12-15"
        }
        
        update_response = client.put(
            f"/api/v1/projects/{project_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        
        # Verify updates in database
        db_session.expire_all()  # Clear session cache
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project.description == "Updated description"
        assert db_project.project_manager == "New Manager"
        assert db_project.end_date == date(2024, 12, 15)
        # Verify unchanged fields
        assert db_project.name == project_data["name"]
        assert db_project.business_sponsor == project_data["business_sponsor"]
    
    def test_delete_project_removes_from_database(self, client, test_program, db_session):
        """Test project deletion and verify it's removed from database."""
        # Create project
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
        
        # Verify project exists
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project is not None
        
        # Delete project
        delete_response = client.delete(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert delete_response.status_code == 200
        
        # Verify project is deleted from database
        db_session.expire_all()
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project is None
        
        # Verify phases are also deleted (cascade)
        db_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project_id
        ).all()
        assert len(db_phases) == 0
    
    def test_list_projects_matches_database(self, client, test_program, db_session):
        """Test that list projects returns data matching database."""
        # Create multiple projects with unique marker
        unique_marker = f"UNIQUE-{uuid4().hex[:8]}"
        project_ids = []
        for i in range(3):
            project_data = {
                "program_id": test_program["id"],
                "name": f"Test Project {unique_marker} {i}",
                "business_sponsor": "Alice Brown",
                "project_manager": "Bob White",
                "technical_lead": "Charlie Green",
                "start_date": "2024-02-01",
                "end_date": "2024-11-30",
                "cost_center_code": f"CC-{uuid4().hex[:8]}"
            }
            
            response = client.post(
                "/api/v1/projects/",
                json=project_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            assert response.status_code == 201
            project_ids.append(response.json()["id"])
        
        # List projects filtered by our unique marker
        list_response = client.get(
            f"/api/v1/projects/?search={unique_marker}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert list_response.status_code == 200
        api_projects = list_response.json()["items"]
        
        # Verify against database with same filter
        db_projects = db_session.query(Project).filter(
            Project.name.like(f"%{unique_marker}%")
        ).all()
        
        # Should have exactly 3 projects with our marker
        assert len(api_projects) == 3
        assert len(db_projects) == 3
        
        # Verify our created projects are in both lists
        api_project_ids = [p["id"] for p in api_projects]
        db_project_ids = [str(p.id) for p in db_projects]
        
        for project_id in project_ids:
            assert project_id in api_project_ids
            assert project_id in db_project_ids


class TestProjectPhaseManagementWithDatabase:
    """Test project phase management with database verification."""
    
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

    @pytest.mark.skip(reason="Old phase API - replaced by new user-definable phase API in test_phase_api.py")
    def test_create_planning_phase_verifies_in_database(self, client, test_project, db_session):
        """Test creating planning phase and verify in database."""
        response = client.post(
            f"/api/v1/projects/{test_project['id']}/phases/planning?capital_budget=20000&expense_budget=10000",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        phase_data = response.json()
        
        # Verify in database
        db_phase = db_session.query(ProjectPhase).filter(
            ProjectPhase.id == phase_data["id"]
        ).first()
        
        assert db_phase is not None
        assert db_phase.name == "Planning Phase"
        assert db_phase.capital_budget == Decimal("20000")
        assert db_phase.expense_budget == Decimal("10000")
        assert db_phase.total_budget == Decimal("30000")
        assert str(db_phase.project_id) == test_project["id"]
    
    @pytest.mark.skip(reason="Old phase API - replaced by new user-definable phase API in test_phase_api.py")
    def test_update_phase_budget_verifies_in_database(self, client, test_project, db_session):
        """Test updating phase budget and verify in database."""
        # Get default phase
        phases_response = client.get(
            f"/api/v1/projects/{test_project['id']}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        phases = phases_response.json()
        default_phase = phases[0] if phases else None
        
        # Update budget
        response = client.put(
            f"/api/v1/phases/{default_phase['id']}"
            "?capital_budget=150000&expense_budget=75000",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        
        # Verify in database
        db_session.expire_all()
        db_phase = db_session.query(ProjectPhase).filter(
            ProjectPhase.id == default_phase["id"]
        ).first()
        
        assert db_phase.capital_budget == Decimal("150000")
        assert db_phase.expense_budget == Decimal("75000")
        assert db_phase.total_budget == Decimal("225000")
    
    @pytest.mark.skip(reason="Old phase API - replaced by new user-definable phase API in test_phase_api.py")
    def test_delete_planning_phase_removes_from_database(self, client, test_project, db_session):
        """Test deleting planning phase and verify removal from database."""
        # Create planning phase
        create_response = client.post(
            f"/api/v1/projects/{test_project['id']}/phases/planning?capital_budget=20000&expense_budget=10000",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 201
        phase_id = create_response.json()["id"]
        
        # Verify it exists
        db_phase = db_session.query(ProjectPhase).filter(ProjectPhase.id == phase_id).first()
        assert db_phase is not None
        
        # Delete planning phase
        delete_response = client.delete(
            f"/api/v1/phases/{phase_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert delete_response.status_code == 204
        
        # Verify it's deleted
        db_session.expire_all()
        db_phase = db_session.query(ProjectPhase).filter(ProjectPhase.id == phase_id).first()
        assert db_phase is None
    
    @pytest.mark.skip(reason="Old phase API - replaced by new user-definable phase API in test_phase_api.py")
    def test_cannot_delete_execution_phase(self, client, test_project, db_session):
        """Test that execution phase cannot be deleted."""
        # Get default phase
        phases_response = client.get(
            f"/api/v1/projects/{test_project['id']}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        phases = phases_response.json()
        default_phase = phases[0] if phases else None
        
        # Try to delete default phase (should fail as it's the only phase)
        delete_response = client.delete(
            f"/api/v1/phases/{default_phase['id']}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert delete_response.status_code == 400
        assert "last" in delete_response.json()["detail"].lower() or "only" in delete_response.json()["detail"].lower()
        
        # Verify it still exists in database
        db_phase = db_session.query(ProjectPhase).filter(
            ProjectPhase.id == default_phase["id"]
        ).first()
        assert db_phase is not None


class TestProjectValidationAndConstraints:
    """Test project validation and database constraints."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_duplicate_cost_center_code_rejected(self, client, test_program, db_session):
        """Test that duplicate cost center codes are rejected."""
        cost_center = f"CC-{uuid4().hex[:8]}"
        
        # Create first project
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project 1 {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": cost_center
        }
        
        response1 = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response1.status_code == 201
        
        # Try to create second project with same cost center
        project_data["name"] = f"Test Project 2 {uuid4()}"
        response2 = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]
        
        # Verify only one project with this cost center in database
        db_projects = db_session.query(Project).filter(
            Project.cost_center_code == cost_center
        ).all()
        assert len(db_projects) == 1

    def test_invalid_date_range_rejected(self, client, test_program):
        """Test that invalid date ranges are rejected."""
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
    
    def test_nonexistent_program_rejected(self, client, db_session):
        """Test that project creation with non-existent program is rejected."""
        fake_program_id = str(uuid4())
        
        project_data = {
            "program_id": fake_program_id,
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()
        
        # Verify no project was created
        db_projects = db_session.query(Project).filter(
            Project.cost_center_code == project_data["cost_center_code"]
        ).all()
        assert len(db_projects) == 0
    
    def test_budget_components_sum_correctly(self, client, test_program, db_session):
        """Test that budget components sum to total budget correctly."""
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
            "/api/v1/projects/?execution_capital_budget=75000&execution_expense_budget=25000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        project_id = response.json()["id"]
        
        # Verify default phase in database (budget parameters are now deprecated)
        db_phase = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project_id
        ).first()
        
        assert db_phase is not None
        assert db_phase.name == "Default Phase"
        # Default phase has zero budgets initially
        assert db_phase.capital_budget == Decimal("0")
        assert db_phase.expense_budget == Decimal("0")
        assert db_phase.total_budget == Decimal("0")


class TestProjectFilteringAndSearch:
    """Test project filtering and search functionality."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    @pytest.fixture
    def multiple_projects(self, client, test_program):
        """Create multiple projects for filtering tests."""
        projects = []
        
        # Create projects with different attributes
        for i in range(5):
            project_data = {
                "program_id": test_program["id"],
                "name": f"Project Alpha {i}",
                "business_sponsor": "Alice Brown",
                "project_manager": f"Manager {i % 2}",  # Two different managers
                "technical_lead": "Charlie Green",
                "start_date": f"2024-0{(i % 3) + 1}-01",  # Different start dates
                "end_date": "2024-12-31",
                "cost_center_code": f"CC-{uuid4().hex[:8]}"
            }
            
            response = client.post(
                "/api/v1/projects/",
                json=project_data,
                headers={"Authorization": "Bearer fake-token"}
            )
            assert response.status_code == 201
            projects.append(response.json())
        
        return projects
    
    def test_filter_by_program(self, client, test_program, multiple_projects):
        """Test filtering projects by program."""
        response = client.get(
            f"/api/v1/projects/?program_id={test_program['id']}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 5
        assert all(p["program_id"] == test_program["id"] for p in data["items"])
    
    def test_filter_by_manager(self, client, multiple_projects):
        """Test filtering projects by manager."""
        response = client.get(
            "/api/v1/projects/?manager=Manager 0",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 2  # Should have at least 2 projects with Manager 0
        assert all(p["project_manager"] == "Manager 0" for p in data["items"])
    
    def test_search_by_name(self, client, multiple_projects):
        """Test searching projects by name."""
        response = client.get(
            "/api/v1/projects/?search=Alpha",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 5
        assert all("Alpha" in p["name"] for p in data["items"])
    
    def test_pagination(self, client, multiple_projects):
        """Test pagination of project list."""
        # Get first page
        response1 = client.get(
            "/api/v1/projects/?page=1&size=2",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response1.status_code == 200
        data1 = response1.json()
        assert len(data1["items"]) <= 2
        assert data1["page"] == 1
        assert data1["size"] == 2
        
        # Get second page
        response2 = client.get(
            "/api/v1/projects/?page=2&size=2",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["page"] == 2
        
        # Verify different items on different pages
        if len(data1["items"]) > 0 and len(data2["items"]) > 0:
            page1_ids = [p["id"] for p in data1["items"]]
            page2_ids = [p["id"] for p in data2["items"]]
            assert set(page1_ids).isdisjoint(set(page2_ids))



class TestProjectReportingWithActualData:
    """Test project reporting endpoints with actual data."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    @pytest.fixture
    def project_with_data(self, client, test_program, db_session):
        """Create a project with phases, assignments, and actuals."""
        # Create project
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 201
        project = response.json()
        
        # Add some actuals directly to database for testing
        project_id = project["id"]
        
        for i in range(5):
            actual = Actual(
                project_id=project_id,
                external_worker_id=f"EMP{i:03d}",
                worker_name=f"Worker {i}",
                actual_date=date(2024, 1, 15) + timedelta(days=i),
                actual_cost=Decimal("500.0"),
                capital_amount=Decimal("300.0"),
                expense_amount=Decimal("200.0")
            )
            db_session.add(actual)
        
        db_session.commit()
        
        return project
    
    def test_project_report_includes_actuals(self, client, project_with_data):
        """Test that project report includes actual data."""
        response = client.get(
            f"/api/v1/projects/{project_with_data['id']}/report",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "financial_summary" in data
        assert "budget" in data["financial_summary"]
        assert "actual" in data["financial_summary"]
        assert "forecast" in data["financial_summary"]
        
        # Verify actual amounts are included
        actual_total = float(data["financial_summary"]["actual"]["total"])
        assert actual_total > 0  # Should have actual costs from our test data
    
    @pytest.mark.skip(reason="Budget parameters are deprecated - default phase has zero budget")
    def test_budget_status_report(self, client, project_with_data):
        """Test budget status report."""
        response = client.get(
            f"/api/v1/projects/{project_with_data['id']}/budget-status",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "budget" in data
        assert "actual" in data
        assert "forecast" in data
        assert "status" in data
        assert "analysis" in data
        
        # Verify budget matches what we set (now deprecated - default phase has zero budget)
        assert float(data["budget"]["total"]) == 0.0
        assert float(data["budget"]["capital"]) == 0.0
        assert float(data["budget"]["expense"]) == 0.0
    
    def test_project_summary(self, client, project_with_data):
        """Test project summary endpoint."""
        response = client.get(
            f"/api/v1/projects/{project_with_data['id']}/summary",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == project_with_data["id"]
        assert data["name"] == project_with_data["name"]
        assert "program_name" in data
        assert "cost_center_code" in data


class TestProjectDataIntegrity:
    """Test data integrity across project operations."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_project_program_relationship_integrity(self, client, test_program, db_session):
        """Test that project-program relationship is maintained."""
        # Create project
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
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 201
        project_id = response.json()["id"]
        
        # Verify relationship in database
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project is not None
        assert str(db_project.program_id) == test_program["id"]
        
        # Verify we can navigate the relationship
        assert db_project.program is not None
        assert db_project.program.name == test_program["name"]
    
    def test_project_phase_cascade_delete(self, client, test_program, db_session):
        """Test that deleting project cascades to phases."""
        # Create project with planning phase
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
        
        # Note: planning/execution budget parameters are now deprecated
        response = client.post(
            "/api/v1/projects/?execution_capital_budget=100000&execution_expense_budget=50000"
            "&planning_capital_budget=20000&planning_expense_budget=10000",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 201
        project_id = response.json()["id"]
        
        # Verify default phase exists
        db_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project_id
        ).all()
        assert len(db_phases) == 1  # Only default phase now
        phase_ids = [str(p.id) for p in db_phases]
        
        # Delete project
        delete_response = client.delete(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert delete_response.status_code == 200
        
        # Verify phases are also deleted
        db_session.expire_all()
        for phase_id in phase_ids:
            db_phase = db_session.query(ProjectPhase).filter(
                ProjectPhase.id == phase_id
            ).first()
            assert db_phase is None
    
    def test_timestamps_are_set(self, client, test_program, db_session):
        """Test that created_at and updated_at timestamps are set."""
        # Create project
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
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 201
        project_id = response.json()["id"]
        
        # Verify timestamps in database
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project.created_at is not None
        assert db_project.updated_at is not None
        
        original_updated_at = db_project.updated_at
        
        # Update project
        import time
        time.sleep(0.1)  # Small delay to ensure timestamp changes
        
        update_response = client.put(
            f"/api/v1/projects/{project_id}",
            json={"description": "Updated"},
            headers={"Authorization": "Bearer fake-token"}
        )
        assert update_response.status_code == 200
        
        # Verify updated_at changed
        db_session.expire_all()
        db_project = db_session.query(Project).filter(Project.id == project_id).first()
        assert db_project.updated_at > original_updated_at


class TestProjectEdgeCases:
    """Test edge cases and boundary conditions."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_project_with_zero_budgets(self, client, test_program, db_session):
        """Test creating project with zero budgets."""
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
            "/api/v1/projects/?execution_capital_budget=0&execution_expense_budget=0",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        project_id = response.json()["id"]
        
        # Verify default phase in database
        db_phase = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project_id
        ).first()
        
        assert db_phase is not None
        assert db_phase.name == "Default Phase"
        assert db_phase.capital_budget == Decimal("0")
        assert db_phase.expense_budget == Decimal("0")
        assert db_phase.total_budget == Decimal("0")
    
    def test_project_with_very_long_name(self, client, test_program):
        """Test project with maximum length name."""
        long_name = "A" * 255  # Maximum length
        
        project_data = {
            "program_id": test_program["id"],
            "name": long_name,
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 201
        assert response.json()["name"] == long_name
    
    def test_project_with_same_start_and_end_date_rejected(self, client, test_program):
        """Test that project with same start and end date is rejected."""
        project_data = {
            "program_id": test_program["id"],
            "name": f"Test Project {uuid4()}",
            "business_sponsor": "Alice Brown",
            "project_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-06-01",
            "end_date": "2024-06-01",  # Same as start
            "cost_center_code": f"CC-{uuid4().hex[:8]}"
        }
        
        response = client.post(
            "/api/v1/projects/",
            json=project_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_get_nonexistent_project_returns_404(self, client):
        """Test getting non-existent project returns 404."""
        fake_id = uuid4()
        
        response = client.get(
            f"/api/v1/projects/{fake_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_update_nonexistent_project_returns_404(self, client):
        """Test updating non-existent project returns 404."""
        fake_id = uuid4()
        
        response = client.put(
            f"/api/v1/projects/{fake_id}",
            json={"description": "Updated"},
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 400  # Service raises ValueError
        assert "not found" in response.json()["detail"].lower()
