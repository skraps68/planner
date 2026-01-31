"""
End-to-end integration tests for complete phase lifecycle.

These tests verify the complete phase lifecycle from project creation through
phase management, assignment association, and reporting.

Test Coverage:
- Task 17.1: Complete phase lifecycle (create, split, update, delete)
- Task 17.2: Phase-based reporting with assignments and cost calculations
"""
import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

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
    """Override authentication dependency for tests."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def test_program(client, override_auth_dependency):
    """Create a test program."""
    program_data = {
        "name": f"E2E Test Program {uuid4()}",
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


@pytest.fixture
def test_project(client, test_program, override_auth_dependency):
    """Create a test project."""
    project_data = {
        "program_id": test_program["id"],
        "name": f"E2E Test Project {uuid4()}",
        "business_sponsor": "Alice Brown",
        "project_manager": "Bob White",
        "technical_lead": "Charlie Green",
        "start_date": "2024-03-01",
        "end_date": "2024-11-30",
        "cost_center_code": f"CC-{uuid4().hex[:8]}"
    }
    
    response = client.post(
        "/api/v1/projects/",
        json=project_data,
        headers={"Authorization": "Bearer fake-token"}
    )
    assert response.status_code == 201
    return response.json()


class TestPhaseLifecycleE2E:
    """
    End-to-end test for complete phase lifecycle.
    
    Requirements tested: 2.1, 5.1, 5.3, 5.4, 6.2
    
    Test flow:
    1. Create project (verify default phase)
    2. Split default phase into multiple phases
    3. Update phase dates and budgets
    4. Delete a phase (verify continuity maintained)
    5. Verify assignments are correctly associated with phases
    """
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_complete_phase_lifecycle(self, client, test_project):
        """Test complete phase lifecycle from creation to deletion."""
        project_id = test_project["id"]
        
        # Step 1: Verify project has default phase (Requirement 2.1)
        list_response = client.get(
            f"/api/v1/projects/{project_id}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert list_response.status_code == 200
        phases = list_response.json()
        
        assert len(phases) == 1, "New project should have exactly one default phase"
        default_phase = phases[0]
        assert default_phase["name"] == "Default Phase"
        assert default_phase["start_date"] == "2024-03-01"
        assert default_phase["end_date"] == "2024-11-30"
        assert default_phase["capital_budget"] == "0.00"
        assert default_phase["expense_budget"] == "0.00"
        assert default_phase["total_budget"] == "0.00"
        
        # Step 2: Split default phase into multiple phases (Requirement 5.1)
        split_phases = {
            "phases": [
                {
                    "id": None,
                    "name": "Planning",
                    "start_date": "2024-03-01",
                    "end_date": "2024-05-31",
                    "description": "Planning phase",
                    "capital_budget": "50000.00",
                    "expense_budget": "25000.00",
                    "total_budget": "75000.00"
                },
                {
                    "id": None,
                    "name": "Development",
                    "start_date": "2024-06-01",
                    "end_date": "2024-09-30",
                    "description": "Development phase",
                    "capital_budget": "100000.00",
                    "expense_budget": "50000.00",
                    "total_budget": "150000.00"
                },
                {
                    "id": None,
                    "name": "Deployment",
                    "start_date": "2024-10-01",
                    "end_date": "2024-11-30",
                    "description": "Deployment phase",
                    "capital_budget": "30000.00",
                    "expense_budget": "15000.00",
                    "total_budget": "45000.00"
                }
            ]
        }
        
        batch_response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=split_phases,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert batch_response.status_code == 200
        created_phases = batch_response.json()
        assert len(created_phases) == 3
        
        # Verify phases were created correctly
        assert created_phases[0]["name"] == "Planning"
        assert created_phases[1]["name"] == "Development"
        assert created_phases[2]["name"] == "Deployment"
        
        # Store phase IDs for later use
        planning_id = created_phases[0]["id"]
        development_id = created_phases[1]["id"]
        deployment_id = created_phases[2]["id"]
        
        # Step 3: Update phase dates and budgets (Requirement 5.3)
        # Extend development phase by one month, shrink deployment
        updated_phases = {
            "phases": [
                {
                    "id": planning_id,
                    "name": "Planning",
                    "start_date": "2024-03-01",
                    "end_date": "2024-05-31",
                    "description": "Planning phase - updated",
                    "capital_budget": "60000.00",  # Increased budget
                    "expense_budget": "30000.00",
                    "total_budget": "90000.00"
                },
                {
                    "id": development_id,
                    "name": "Development",
                    "start_date": "2024-06-01",
                    "end_date": "2024-10-31",  # Extended by one month
                    "description": "Development phase - extended",
                    "capital_budget": "120000.00",
                    "expense_budget": "60000.00",
                    "total_budget": "180000.00"
                },
                {
                    "id": deployment_id,
                    "name": "Deployment",
                    "start_date": "2024-11-01",  # Adjusted start
                    "end_date": "2024-11-30",
                    "description": "Deployment phase - shortened",
                    "capital_budget": "20000.00",  # Reduced budget
                    "expense_budget": "10000.00",
                    "total_budget": "30000.00"
                }
            ]
        }
        
        update_response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=updated_phases,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert update_response.status_code == 200
        updated_phases_result = update_response.json()
        
        # Verify updates were applied
        assert updated_phases_result[0]["capital_budget"] == "60000.00"
        assert updated_phases_result[1]["end_date"] == "2024-10-31"
        assert updated_phases_result[2]["start_date"] == "2024-11-01"
        
        # Step 4: Delete a phase while maintaining continuity (Requirement 5.4)
        # We'll merge Planning and Development into one phase
        merged_phases = {
            "phases": [
                {
                    "id": None,
                    "name": "Planning & Development",
                    "start_date": "2024-03-01",
                    "end_date": "2024-10-31",
                    "description": "Merged planning and development",
                    "capital_budget": "180000.00",
                    "expense_budget": "90000.00",
                    "total_budget": "270000.00"
                },
                {
                    "id": deployment_id,  # Keep deployment phase
                    "name": "Deployment",
                    "start_date": "2024-11-01",
                    "end_date": "2024-11-30",
                    "description": "Deployment phase",
                    "capital_budget": "20000.00",
                    "expense_budget": "10000.00",
                    "total_budget": "30000.00"
                }
            ]
        }
        
        merge_response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=merged_phases,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert merge_response.status_code == 200
        final_phases = merge_response.json()
        
        # Verify we now have 2 phases
        assert len(final_phases) == 2
        assert final_phases[0]["name"] == "Planning & Development"
        assert final_phases[1]["name"] == "Deployment"
        
        # Verify timeline continuity is maintained
        assert final_phases[0]["start_date"] == "2024-03-01"
        assert final_phases[0]["end_date"] == "2024-10-31"
        assert final_phases[1]["start_date"] == "2024-11-01"
        assert final_phases[1]["end_date"] == "2024-11-30"
        
        # Step 5: Verify phase assignment query capability (Requirement 6.2)
        # Test that we can query assignments for each phase
        phase1_id = final_phases[0]["id"]
        phase2_id = final_phases[1]["id"]
        
        phase1_assignments_response = client.get(
            f"/api/v1/phases/{phase1_id}/assignments",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert phase1_assignments_response.status_code == 200
        phase1_assignments = phase1_assignments_response.json()
        
        phase2_assignments_response = client.get(
            f"/api/v1/phases/{phase2_id}/assignments",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert phase2_assignments_response.status_code == 200
        phase2_assignments = phase2_assignments_response.json()
        
        # Verify the endpoint returns a list (may be empty if no assignments exist)
        assert isinstance(phase1_assignments, list)
        assert isinstance(phase2_assignments, list)
        
        # The key requirement is that the API supports date-based phase association
        # Actual assignment creation and verification is tested in other integration tests


class TestPhaseBasedReportingE2E:
    """
    End-to-end test for phase-based reporting.
    
    Requirements tested: 8.2, 8.3, 8.4, 8.5
    
    Test flow:
    1. Create project with multiple phases
    2. Verify phase budget aggregations
    3. Verify phase-level reporting endpoints exist
    4. Verify budget calculations across phases
    """
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_phase_based_reporting(self, client, test_project):
        """Test phase-based reporting with budget aggregations."""
        project_id = test_project["id"]
        
        # Step 1: Create project with multiple phases
        phases_data = {
            "phases": [
                {
                    "id": None,
                    "name": "Q1 Phase",
                    "start_date": "2024-03-01",
                    "end_date": "2024-05-31",
                    "description": "Q1 work",
                    "capital_budget": "100000.00",
                    "expense_budget": "50000.00",
                    "total_budget": "150000.00"
                },
                {
                    "id": None,
                    "name": "Q2 Phase",
                    "start_date": "2024-06-01",
                    "end_date": "2024-08-31",
                    "description": "Q2 work",
                    "capital_budget": "150000.00",
                    "expense_budget": "75000.00",
                    "total_budget": "225000.00"
                },
                {
                    "id": None,
                    "name": "Q3 Phase",
                    "start_date": "2024-09-01",
                    "end_date": "2024-11-30",
                    "description": "Q3 work",
                    "capital_budget": "80000.00",
                    "expense_budget": "40000.00",
                    "total_budget": "120000.00"
                }
            ]
        }
        
        batch_response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert batch_response.status_code == 200
        phases = batch_response.json()
        assert len(phases) == 3
        
        # Step 2: Verify budget aggregations (Requirement 8.5)
        # Get all phases and verify budget aggregation
        phases_response = client.get(
            f"/api/v1/projects/{project_id}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert phases_response.status_code == 200
        all_phases = phases_response.json()
        
        # Calculate total budgets across all phases
        total_capital = sum(Decimal(p["capital_budget"]) for p in all_phases)
        total_expense = sum(Decimal(p["expense_budget"]) for p in all_phases)
        total_budget = sum(Decimal(p["total_budget"]) for p in all_phases)
        
        # Verify aggregation
        assert total_capital == Decimal("330000.00")  # 100k + 150k + 80k
        assert total_expense == Decimal("165000.00")  # 50k + 75k + 40k
        assert total_budget == Decimal("495000.00")  # 150k + 225k + 120k
        
        # Verify budget sum consistency
        assert total_capital + total_expense == total_budget
        
        # Step 3: Verify phase-level data is accessible (Requirements 8.2, 8.3, 8.4)
        # Get each phase individually
        for phase in all_phases:
            phase_response = client.get(
                f"/api/v1/phases/{phase['id']}",
                headers={"Authorization": "Bearer fake-token"}
            )
            assert phase_response.status_code == 200
            phase_data = phase_response.json()
            
            # Verify phase has budget information
            assert "capital_budget" in phase_data
            assert "expense_budget" in phase_data
            assert "total_budget" in phase_data
            assert "start_date" in phase_data
            assert "end_date" in phase_data
        
        # Step 4: Verify assignment query endpoints exist for each phase
        # This verifies the infrastructure for phase-based cost calculations (Requirement 8.2)
        for phase in all_phases:
            assignments_response = client.get(
                f"/api/v1/phases/{phase['id']}/assignments",
                headers={"Authorization": "Bearer fake-token"}
            )
            assert assignments_response.status_code == 200
            assignments = assignments_response.json()
            assert isinstance(assignments, list)
        
        # Step 5: Verify project-level aggregation
        # Get project details which should be consistent with phase budgets
        project_response = client.get(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert project_response.status_code == 200
        project_data = project_response.json()
        
        # Verify project exists and has expected structure
        assert project_data["id"] == project_id
        assert "start_date" in project_data
        assert "end_date" in project_data
        
        # The phase budgets should be independently managed from project-level budgets
        # This test verifies that phase-level budget tracking is functional
