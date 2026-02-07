"""
End-to-end integration tests for Portfolio CRUD operations.

These tests verify complete user workflows for Portfolio management including:
- Portfolio creation flow
- Portfolio view and edit flow
- Portfolio deletion with and without programs
- Program creation with portfolio selection

Test Coverage:
- Task 19.1: Portfolio creation flow
- Task 19.2: Portfolio view and edit flow
- Task 19.3: Portfolio deletion
- Task 19.4: Program creation with Portfolio
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
    # Check if user already exists
    existing_user = db_session.query(User).filter(User.username == "test_admin_portfolio_e2e").first()
    if existing_user:
        return existing_user
    
    user = User(
        id=uuid4(),
        username="test_admin_portfolio_e2e",
        email="admin_portfolio_e2e@test.com",
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
    """Override authentication dependency for tests."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user_factory(admin_user)
    app.dependency_overrides[deps.get_current_active_user] = mock_get_current_user_factory(admin_user)
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)
    app.dependency_overrides.pop(deps.get_current_active_user, None)


class TestPortfolioCreationFlowE2E:
    """
    End-to-end test for Portfolio creation flow.
    
    Requirements tested: 11.8
    
    Test flow:
    1. Navigate to create page (POST /api/v1/portfolios)
    2. Fill form with valid data
    3. Submit form
    4. Verify portfolio appears in list (GET /api/v1/portfolios)
    """
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_complete_portfolio_creation_flow(self, client):
        """Test complete flow: create portfolio → verify in list."""
        # Step 1: Create portfolio with valid data
        portfolio_data = {
            "name": f"E2E Test Portfolio {uuid4()}",
            "description": "Portfolio created via E2E test",
            "owner": "John Doe",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        create_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Verify creation was successful
        assert create_response.status_code == 201, f"Expected 201, got {create_response.status_code}: {create_response.text}"
        created_portfolio = create_response.json()
        
        # Verify response contains all expected fields
        assert created_portfolio["name"] == portfolio_data["name"]
        assert created_portfolio["description"] == portfolio_data["description"]
        assert created_portfolio["owner"] == portfolio_data["owner"]
        assert created_portfolio["reporting_start_date"] == portfolio_data["reporting_start_date"]
        assert created_portfolio["reporting_end_date"] == portfolio_data["reporting_end_date"]
        assert "id" in created_portfolio
        assert "created_at" in created_portfolio
        assert "updated_at" in created_portfolio
        
        portfolio_id = created_portfolio["id"]
        
        # Step 2: Verify portfolio appears in list
        list_response = client.get(
            "/api/v1/portfolios/",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert list_response.status_code == 200
        portfolios_list = list_response.json()
        
        # Find our created portfolio in the list
        found_portfolio = None
        if isinstance(portfolios_list, dict) and "items" in portfolios_list:
            # Paginated response
            for portfolio in portfolios_list["items"]:
                if portfolio["id"] == portfolio_id:
                    found_portfolio = portfolio
                    break
        elif isinstance(portfolios_list, list):
            # Direct list response
            for portfolio in portfolios_list:
                if portfolio["id"] == portfolio_id:
                    found_portfolio = portfolio
                    break
        
        assert found_portfolio is not None, "Created portfolio not found in list"
        assert found_portfolio["name"] == portfolio_data["name"]
        assert found_portfolio["owner"] == portfolio_data["owner"]
        
        # Step 3: Verify portfolio can be retrieved by ID
        get_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_response.status_code == 200
        retrieved_portfolio = get_response.json()
        assert retrieved_portfolio["id"] == portfolio_id
        assert retrieved_portfolio["name"] == portfolio_data["name"]
        assert retrieved_portfolio["description"] == portfolio_data["description"]


class TestPortfolioViewAndEditFlowE2E:
    """
    End-to-end test for Portfolio view and edit flow.
    
    Requirements tested: 11.8
    
    Test flow:
    1. Create a portfolio
    2. View portfolio details (GET /api/v1/portfolios/{id})
    3. Edit portfolio (PUT /api/v1/portfolios/{id})
    4. Save changes
    5. Verify changes were applied
    """
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_complete_portfolio_view_and_edit_flow(self, client):
        """Test complete flow: create → view → edit → verify changes."""
        # Step 1: Create a portfolio
        portfolio_data = {
            "name": f"E2E Edit Test Portfolio {uuid4()}",
            "description": "Original description",
            "owner": "Jane Smith",
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
        
        # Step 2: View portfolio details
        view_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert view_response.status_code == 200
        viewed_portfolio = view_response.json()
        assert viewed_portfolio["name"] == portfolio_data["name"]
        assert viewed_portfolio["description"] == "Original description"
        assert viewed_portfolio["owner"] == "Jane Smith"
        
        # Step 3: Edit portfolio
        update_data = {
            "name": f"E2E Updated Portfolio {uuid4()}",
            "description": "Updated description after edit",
            "owner": "John Doe",
            "reporting_start_date": "2024-02-01",
            "reporting_end_date": "2025-01-31"
        }
        
        edit_response = client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert edit_response.status_code == 200
        updated_portfolio = edit_response.json()
        
        # Step 4: Verify changes were applied
        assert updated_portfolio["id"] == portfolio_id
        assert updated_portfolio["name"] == update_data["name"]
        assert updated_portfolio["description"] == update_data["description"]
        assert updated_portfolio["owner"] == update_data["owner"]
        assert updated_portfolio["reporting_start_date"] == update_data["reporting_start_date"]
        assert updated_portfolio["reporting_end_date"] == update_data["reporting_end_date"]
        
        # Step 5: Verify changes persist when retrieving again
        verify_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert verify_response.status_code == 200
        verified_portfolio = verify_response.json()
        assert verified_portfolio["name"] == update_data["name"]
        assert verified_portfolio["description"] == update_data["description"]
        assert verified_portfolio["owner"] == update_data["owner"]
    
    def test_partial_portfolio_update(self, client):
        """Test partial update of portfolio fields."""
        # Create a portfolio
        portfolio_data = {
            "name": f"E2E Partial Update Portfolio {uuid4()}",
            "description": "Original description",
            "owner": "Original Owner",
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
        
        # Update only the description
        partial_update = {
            "description": "Updated description only"
        }
        
        update_response = client.put(
            f"/api/v1/portfolios/{portfolio_id}",
            json=partial_update,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert update_response.status_code == 200
        updated_portfolio = update_response.json()
        
        # Verify only description changed
        assert updated_portfolio["description"] == "Updated description only"
        assert updated_portfolio["name"] == portfolio_data["name"]
        assert updated_portfolio["owner"] == portfolio_data["owner"]


class TestPortfolioDeletionE2E:
    """
    End-to-end test for Portfolio deletion.
    
    Requirements tested: 11.8
    
    Test flow:
    1. Test delete portfolio without programs succeeds
    2. Test delete portfolio with programs fails with error message
    """
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_delete_portfolio_without_programs_succeeds(self, client):
        """Test that deleting a portfolio without programs succeeds."""
        # Step 1: Create a portfolio
        portfolio_data = {
            "name": f"E2E Delete Test Portfolio {uuid4()}",
            "description": "Portfolio to be deleted",
            "owner": "Test Owner",
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
        
        # Step 2: Verify portfolio exists
        get_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert get_response.status_code == 200
        
        # Step 3: Delete the portfolio
        delete_response = client.delete(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert delete_response.status_code == 200
        
        # Step 4: Verify portfolio no longer exists
        verify_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert verify_response.status_code == 404
    
    def test_delete_portfolio_with_programs_fails(self, client):
        """Test that deleting a portfolio with programs fails with error message."""
        # Step 1: Create a portfolio
        portfolio_data = {
            "name": f"E2E Delete Protected Portfolio {uuid4()}",
            "description": "Portfolio with programs",
            "owner": "Test Owner",
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
        
        # Step 2: Create a program associated with this portfolio
        program_data = {
            "portfolio_id": portfolio_id,
            "name": f"E2E Test Program {uuid4()}",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": "2024-03-01",
            "end_date": "2024-11-30"
        }
        
        program_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert program_response.status_code == 201
        program_id = program_response.json()["id"]
        
        # Step 3: Attempt to delete the portfolio
        delete_response = client.delete(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Step 4: Verify deletion fails with 409 Conflict
        assert delete_response.status_code == 409
        error_data = delete_response.json()
        assert "detail" in error_data
        # Verify error message mentions programs
        assert "program" in error_data["detail"].lower() or "cannot" in error_data["detail"].lower()
        
        # Step 5: Verify portfolio still exists
        verify_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert verify_response.status_code == 200
        
        # Cleanup: Delete the program first, then the portfolio
        client.delete(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )


class TestProgramCreationWithPortfolioE2E:
    """
    End-to-end test for Program creation with Portfolio selection.
    
    Requirements tested: 11.8
    
    Test flow:
    1. Create a portfolio
    2. Navigate to create program
    3. Select portfolio
    4. Submit program
    5. Verify program is associated with portfolio
    """
    
    @pytest.fixture(autouse=True)
    def _override_auth(self, override_auth_dependency):
        """Use auth override for this test class."""
        pass
    
    def test_complete_program_creation_with_portfolio_flow(self, client):
        """Test complete flow: create portfolio → create program → verify association."""
        # Step 1: Create a portfolio
        portfolio_data = {
            "name": f"E2E Program Test Portfolio {uuid4()}",
            "description": "Portfolio for program creation test",
            "owner": "Portfolio Owner",
            "reporting_start_date": "2024-01-01",
            "reporting_end_date": "2024-12-31"
        }
        
        portfolio_response = client.post(
            "/api/v1/portfolios/",
            json=portfolio_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert portfolio_response.status_code == 201
        portfolio_id = portfolio_response.json()["id"]
        
        # Step 2: Create a program with portfolio selection
        program_data = {
            "portfolio_id": portfolio_id,
            "name": f"E2E Test Program {uuid4()}",
            "business_sponsor": "Alice Brown",
            "program_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-03-01",
            "end_date": "2024-11-30"
        }
        
        program_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert program_response.status_code == 201
        created_program = program_response.json()
        program_id = created_program["id"]
        
        # Step 3: Verify program has portfolio_id
        assert created_program["portfolio_id"] == portfolio_id
        
        # Step 4: Retrieve program and verify portfolio relationship
        get_program_response = client.get(
            f"/api/v1/programs/{program_id}",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert get_program_response.status_code == 200
        retrieved_program = get_program_response.json()
        assert retrieved_program["portfolio_id"] == portfolio_id
        
        # Step 5: Verify portfolio shows the program in its programs list
        portfolio_programs_response = client.get(
            f"/api/v1/portfolios/{portfolio_id}/programs",
            headers={"Authorization": "Bearer fake-token"}
        )
        
        assert portfolio_programs_response.status_code == 200
        portfolio_programs = portfolio_programs_response.json()
        
        # Find our program in the portfolio's programs
        found_program = None
        for program in portfolio_programs:
            if program["id"] == program_id:
                found_program = program
                break
        
        assert found_program is not None, "Program not found in portfolio's programs list"
        assert found_program["name"] == program_data["name"]
    
    def test_program_creation_without_portfolio_fails(self, client):
        """Test that creating a program without portfolio_id fails."""
        # Attempt to create program without portfolio_id
        program_data = {
            "name": f"E2E Invalid Program {uuid4()}",
            "business_sponsor": "Alice Brown",
            "program_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-03-01",
            "end_date": "2024-11-30"
        }
        
        program_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail with 400 or 422 validation error
        assert program_response.status_code in [400, 422]
        error_data = program_response.json()
        # Check for either standard error format or custom error format
        assert "detail" in error_data or "error" in error_data
    
    def test_program_creation_with_invalid_portfolio_fails(self, client):
        """Test that creating a program with non-existent portfolio_id fails."""
        # Use a random UUID that doesn't exist
        invalid_portfolio_id = str(uuid4())
        
        program_data = {
            "portfolio_id": invalid_portfolio_id,
            "name": f"E2E Invalid Portfolio Program {uuid4()}",
            "business_sponsor": "Alice Brown",
            "program_manager": "Bob White",
            "technical_lead": "Charlie Green",
            "start_date": "2024-03-01",
            "end_date": "2024-11-30"
        }
        
        program_response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers={"Authorization": "Bearer fake-token"}
        )
        
        # Should fail with 400 or 404
        assert program_response.status_code in [400, 404]
        error_data = program_response.json()
        assert "detail" in error_data
