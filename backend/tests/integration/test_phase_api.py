"""
Integration tests for Phase API endpoints.

These tests verify end-to-end functionality of phase management APIs,
including batch updates, validation, and assignment queries.
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
    """Override authentication dependency for tests that need it."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def test_program(client, override_auth_dependency):
    """Create a test program for phase tests."""
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


@pytest.fixture
def test_project(client, test_program, override_auth_dependency):
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
        "/api/v1/projects/",
        json=project_data,
        headers={"Authorization": "Bearer fake-token"}
    )
    assert response.status_code == 201
    return response.json()


class TestPhaseAPIBasic:
    """Test basic phase API endpoints."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_list_phases(self, client, test_project):
        """Test listing phases for a project."""
        project_id = test_project["id"]
        
        response = client.get(
            f"/api/v1/projects/{project_id}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default phase
        assert len(data) >= 1
        assert data[0]["name"] == "Default Phase"
    
    def test_get_phase(self, client, test_project):
        """Test getting a specific phase."""
        project_id = test_project["id"]
        
        # First get the list of phases
        list_response = client.get(
            f"/api/v1/projects/{project_id}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert list_response.status_code == 200
        phases = list_response.json()
        assert len(phases) > 0
        
        phase_id = phases[0]["id"]
        
        # Get specific phase
        response = client.get(
            f"/api/v1/phases/{phase_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == phase_id
        assert "name" in data
        assert "start_date" in data
        assert "end_date" in data
    
    def test_get_nonexistent_phase(self, client):
        """Test getting a non-existent phase returns 404."""
        fake_id = str(uuid4())
        
        response = client.get(
            f"/api/v1/phases/{fake_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404


class TestPhaseBatchUpdate:
    """Test batch phase update operations."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_batch_update_split_default_phase(self, client, test_project):
        """Test splitting default phase into multiple phases."""
        project_id = test_project["id"]
        
        # Define two phases covering the project timeline
        phases_data = {
            "phases": [
                {
                    "id": None,
                    "name": "Phase 1",
                    "start_date": "2024-02-01",
                    "end_date": "2024-06-30",
                    "description": "First phase",
                    "capital_budget": "10000.00",
                    "expense_budget": "5000.00",
                    "total_budget": "15000.00"
                },
                {
                    "id": None,
                    "name": "Phase 2",
                    "start_date": "2024-07-01",
                    "end_date": "2024-11-30",
                    "description": "Second phase",
                    "capital_budget": "20000.00",
                    "expense_budget": "10000.00",
                    "total_budget": "30000.00"
                }
            ]
        }
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Phase 1"
        assert data[1]["name"] == "Phase 2"
        assert data[0]["start_date"] == "2024-02-01"
        assert data[1]["end_date"] == "2024-11-30"
    
    def test_batch_update_modify_existing_phases(self, client, test_project):
        """Test modifying existing phases via batch update."""
        project_id = test_project["id"]
        
        # First create two phases
        initial_phases = {
            "phases": [
                {
                    "id": None,
                    "name": "Phase 1",
                    "start_date": "2024-02-01",
                    "end_date": "2024-06-30",
                    "capital_budget": "0",
                    "expense_budget": "0",
                    "total_budget": "0"
                },
                {
                    "id": None,
                    "name": "Phase 2",
                    "start_date": "2024-07-01",
                    "end_date": "2024-11-30",
                    "capital_budget": "0",
                    "expense_budget": "0",
                    "total_budget": "0"
                }
            ]
        }
        
        create_response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=initial_phases,
            headers={"Authorization": "Bearer fake-token"}
        )
        assert create_response.status_code == 200
        created_phases = create_response.json()
        
        # Now update them
        updated_phases = {
            "phases": [
                {
                    "id": created_phases[0]["id"],
                    "name": "Updated Phase 1",
                    "start_date": "2024-02-01",
                    "end_date": "2024-05-31",
                    "description": "Updated description",
                    "capital_budget": "15000.00",
                    "expense_budget": "7500.00",
                    "total_budget": "22500.00"
                },
                {
                    "id": created_phases[1]["id"],
                    "name": "Updated Phase 2",
                    "start_date": "2024-06-01",
                    "end_date": "2024-11-30",
                    "capital_budget": "25000.00",
                    "expense_budget": "12500.00",
                    "total_budget": "37500.00"
                }
            ]
        }
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=updated_phases,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Updated Phase 1"
        assert data[0]["capital_budget"] == "15000.00"
        assert data[1]["name"] == "Updated Phase 2"
    
    def test_batch_update_invalid_timeline_fails(self, client, test_project):
        """Test that batch update with invalid timeline fails."""
        project_id = test_project["id"]
        
        # Create phases with a gap
        phases_data = {
            "phases": [
                {
                    "id": None,
                    "name": "Phase 1",
                    "start_date": "2024-02-01",
                    "end_date": "2024-06-30",
                    "capital_budget": "0",
                    "expense_budget": "0",
                    "total_budget": "0"
                }
                # Missing phase to cover July-November
            ]
        }
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422
        assert "validation" in response.json()["detail"].lower()
    
    def test_batch_update_empty_list_fails(self, client, test_project):
        """Test that batch update with empty list fails."""
        project_id = test_project["id"]
        
        phases_data = {"phases": []}
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422
    
    def test_batch_update_invalid_budget_fails(self, client, test_project):
        """Test that batch update with invalid budget fails."""
        project_id = test_project["id"]
        
        phases_data = {
            "phases": [
                {
                    "id": None,
                    "name": "Phase 1",
                    "start_date": "2024-02-01",
                    "end_date": "2024-11-30",
                    "capital_budget": "10000.00",
                    "expense_budget": "5000.00",
                    "total_budget": "20000.00"  # Wrong total
                }
            ]
        }
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/batch",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 422


class TestPhaseValidation:
    """Test phase validation endpoint."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_validate_valid_phases(self, client, test_project):
        """Test validating a valid set of phases."""
        project_id = test_project["id"]
        
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": "2024-02-01",
                "end_date": "2024-06-30"
            },
            {
                "id": None,
                "name": "Phase 2",
                "start_date": "2024-07-01",
                "end_date": "2024-11-30"
            }
        ]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/validate",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True
        assert len(data["errors"]) == 0
    
    def test_validate_invalid_phases(self, client, test_project):
        """Test validating an invalid set of phases."""
        project_id = test_project["id"]
        
        # Phases with a gap
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": "2024-02-01",
                "end_date": "2024-06-30"
            }
            # Missing phase to cover July-November
        ]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/phases/validate",
            json=phases_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False
        assert len(data["errors"]) > 0


class TestPhaseAssignments:
    """Test phase assignment queries."""
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_get_phase_assignments(self, client, test_project):
        """Test getting assignments for a phase."""
        project_id = test_project["id"]
        
        # Get the default phase
        list_response = client.get(
            f"/api/v1/projects/{project_id}/phases",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert list_response.status_code == 200
        phases = list_response.json()
        phase_id = phases[0]["id"]
        
        # Get assignments for the phase
        response = client.get(
            f"/api/v1/phases/{phase_id}/assignments",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # May be empty if no assignments exist
    
    def test_get_assignments_nonexistent_phase(self, client):
        """Test getting assignments for non-existent phase returns 404."""
        fake_id = str(uuid4())
        
        response = client.get(
            f"/api/v1/phases/{fake_id}/assignments",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert response.status_code == 404
