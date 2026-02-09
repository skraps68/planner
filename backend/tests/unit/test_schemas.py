"""
Unit tests for Pydantic schemas.
"""
import pytest
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4
from pydantic import ValidationError

from app.schemas.base import PaginationParams, PaginatedResponse, ErrorResponse
from app.schemas.program import ProgramCreate, ProgramUpdate, ProgramResponse
from app.schemas.project import ProjectCreate, ProjectPhaseCreate, ProjectUpdate
from app.schemas.resource import ResourceCreate, WorkerCreate, WorkerTypeCreate
from app.schemas.user import UserCreate, UserRoleCreate, ScopeAssignmentCreate
from app.schemas.assignment import ResourceAssignmentCreate, ResourceAssignmentUpdate, AssignmentImportRow
from app.schemas.actual import ActualCreate, ActualBase, ActualImportRow
from app.schemas.rate import RateCreate
from app.schemas.auth import LoginRequest, RoleSwitchRequest
from app.models.resource import ResourceType
from app.models.user import RoleType, ScopeType


class TestBaseSchemas:
    """Test base schema functionality."""
    
    def test_pagination_params_valid(self):
        """Test valid pagination parameters."""
        params = PaginationParams(page=1, size=20, sort_by="name", sort_order="asc")
        assert params.page == 1
        assert params.size == 20
        assert params.sort_by == "name"
        assert params.sort_order == "asc"
    
    def test_pagination_params_invalid_page(self):
        """Test invalid page number."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationParams(page=0)
        assert "greater than or equal to 1" in str(exc_info.value)
    
    def test_pagination_params_invalid_size(self):
        """Test invalid page size."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationParams(size=0)
        assert "greater than or equal to 1" in str(exc_info.value)
        
        with pytest.raises(ValidationError) as exc_info:
            PaginationParams(size=101)
        assert "less than or equal to 100" in str(exc_info.value)
    
    def test_pagination_params_invalid_sort_order(self):
        """Test invalid sort order."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationParams(sort_order="invalid")
        assert "String should match pattern" in str(exc_info.value)


class TestProgramSchemas:
    """Test program-related schemas."""
    
    def test_program_create_valid(self):
        """Test valid program creation."""
        program_data = {
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31),
            "description": "Test program description"
        }
        program = ProgramCreate(**program_data)
        assert program.name == "Test Program"
        assert program.start_date == date(2024, 1, 1)
        assert program.end_date == date(2024, 12, 31)
    
    def test_program_create_invalid_dates(self):
        """Test program creation with invalid dates."""
        program_data = {
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 12, 31),
            "end_date": date(2024, 1, 1),  # End before start
        }
        with pytest.raises(ValidationError) as exc_info:
            ProgramCreate(**program_data)
        assert "End date must be after start date" in str(exc_info.value)
    
    def test_program_update_partial(self):
        """Test partial program update."""
        update_data = {
            "name": "Updated Program Name",
            "description": "Updated description"
        }
        program_update = ProgramUpdate(**update_data)
        assert program_update.name == "Updated Program Name"
        assert program_update.description == "Updated description"
        assert program_update.business_sponsor is None


class TestProjectSchemas:
    """Test project-related schemas."""
    
    def test_project_create_valid(self):
        """Test valid project creation."""
        project_data = {
            "program_id": uuid4(),
            "name": "Test Project",
            "business_sponsor": "John Doe",
            "project_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 6, 30),
            "cost_center_code": "CC001",
            "description": "Test project"
        }
        project = ProjectCreate(**project_data)
        assert project.name == "Test Project"
        assert project.cost_center_code == "CC001"
    
    def test_project_phase_create_valid(self):
        """Test valid project phase creation."""
        from datetime import date
        phase_data = {
            "project_id": uuid4(),
            "name": "Planning Phase",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 6, 30),
            "capital_budget": Decimal("50000.00"),
            "expense_budget": Decimal("30000.00"),
            "total_budget": Decimal("80000.00")
        }
        phase = ProjectPhaseCreate(**phase_data)
        assert phase.name == "Planning Phase"
        assert phase.total_budget == Decimal("80000.00")
    
    def test_project_phase_invalid_budget_sum(self):
        """Test project phase with invalid budget sum."""
        from datetime import date
        phase_data = {
            "project_id": uuid4(),
            "name": "Planning Phase",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 6, 30),
            "capital_budget": Decimal("50000.00"),
            "expense_budget": Decimal("30000.00"),
            "total_budget": Decimal("90000.00")  # Wrong total
        }
        with pytest.raises(ValidationError) as exc_info:
            ProjectPhaseCreate(**phase_data)
        assert "Total budget must equal capital" in str(exc_info.value)


class TestResourceSchemas:
    """Test resource-related schemas."""
    
    def test_resource_create_valid(self):
        """Test valid resource creation."""
        resource_data = {
            "name": "Senior Developer",
            "resource_type": ResourceType.LABOR,
            "description": "Senior software developer"
        }
        resource = ResourceCreate(**resource_data)
        assert resource.name == "Senior Developer"
        assert resource.resource_type == ResourceType.LABOR
    
    def test_worker_type_create_valid(self):
        """Test valid worker type creation."""
        worker_type_data = {
            "type": "Software Engineer",
            "description": "Software engineering role"
        }
        worker_type = WorkerTypeCreate(**worker_type_data)
        assert worker_type.type == "Software Engineer"
    
    def test_worker_create_valid(self):
        """Test valid worker creation."""
        worker_data = {
            "worker_type_id": uuid4(),
            "external_id": "EMP001",
            "name": "John Developer"
        }
        worker = WorkerCreate(**worker_data)
        assert worker.external_id == "EMP001"
        assert worker.name == "John Developer"


class TestUserSchemas:
    """Test user-related schemas."""
    
    def test_user_create_valid(self):
        """Test valid user creation."""
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "securepassword123",
            "is_active": True
        }
        user = UserCreate(**user_data)
        assert user.username == "testuser"
        assert user.email == "test@example.com"
    
    def test_user_create_invalid_email(self):
        """Test user creation with invalid email."""
        user_data = {
            "username": "testuser",
            "email": "invalid-email",
            "password": "securepassword123"
        }
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)
        assert "value is not a valid email address" in str(exc_info.value)
    
    def test_user_role_create_valid(self):
        """Test valid user role creation."""
        role_data = {
            "user_id": uuid4(),
            "role_type": RoleType.PROJECT_MANAGER,
            "is_active": True
        }
        user_role = UserRoleCreate(**role_data)
        assert user_role.role_type == RoleType.PROJECT_MANAGER
    
    def test_scope_assignment_create_valid(self):
        """Test valid scope assignment creation."""
        scope_data = {
            "user_role_id": uuid4(),
            "scope_type": ScopeType.PROJECT,
            "project_id": uuid4(),
            "is_active": True
        }
        scope = ScopeAssignmentCreate(**scope_data)
        assert scope.scope_type == ScopeType.PROJECT


class TestAssignmentSchemas:
    """Test assignment-related schemas."""
    
    def test_resource_assignment_create_valid(self):
        """Test valid resource assignment creation."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("60.00"),
            "expense_percentage": Decimal("40.00")
        }
        assignment = ResourceAssignmentCreate(**assignment_data)
        assert assignment.capital_percentage == Decimal("60.00")
        assert assignment.expense_percentage == Decimal("40.00")
    
    def test_resource_assignment_allocation_percentage_not_accepted(self):
        """Test that allocation_percentage is not accepted in requests (ignored)."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "allocation_percentage": Decimal("75.00"),  # Should be ignored
            "capital_percentage": Decimal("60.00"),
            "expense_percentage": Decimal("40.00")
        }
        # Pydantic v2 ignores extra fields by default
        assignment = ResourceAssignmentCreate(**assignment_data)
        # Verify allocation_percentage is not in the model
        assert not hasattr(assignment, 'allocation_percentage')
        assert assignment.capital_percentage == Decimal("60.00")
        assert assignment.expense_percentage == Decimal("40.00")
    
    def test_resource_assignment_sum_exceeds_100(self):
        """Test that capital + expense > 100 is rejected."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("60.00"),
            "expense_percentage": Decimal("50.00")  # Total = 110%
        }
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(**assignment_data)
        assert "cannot exceed 100" in str(exc_info.value)
    
    def test_resource_assignment_negative_capital_percentage(self):
        """Test that negative capital percentage is rejected."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("-10.00"),
            "expense_percentage": Decimal("50.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(**assignment_data)
        assert "capital_percentage" in str(exc_info.value).lower()
    
    def test_resource_assignment_negative_expense_percentage(self):
        """Test that negative expense percentage is rejected."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("50.00"),
            "expense_percentage": Decimal("-10.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(**assignment_data)
        assert "expense_percentage" in str(exc_info.value).lower()
    
    def test_resource_assignment_capital_percentage_exceeds_100(self):
        """Test that capital percentage > 100 is rejected."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("150.00"),
            "expense_percentage": Decimal("10.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(**assignment_data)
        assert "capital_percentage" in str(exc_info.value).lower()
    
    def test_resource_assignment_expense_percentage_exceeds_100(self):
        """Test that expense percentage > 100 is rejected."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("10.00"),
            "expense_percentage": Decimal("150.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(**assignment_data)
        assert "expense_percentage" in str(exc_info.value).lower()
    
    def test_resource_assignment_sum_equals_100_valid(self):
        """Test that capital + expense = 100 is valid."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("100.00"),
            "expense_percentage": Decimal("0.00")
        }
        assignment = ResourceAssignmentCreate(**assignment_data)
        assert assignment.capital_percentage == Decimal("100.00")
        assert assignment.expense_percentage == Decimal("0.00")
    
    def test_resource_assignment_sum_less_than_100_valid(self):
        """Test that capital + expense < 100 is valid."""
        assignment_data = {
            "resource_id": uuid4(),
            "project_id": uuid4(),
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("30.00"),
            "expense_percentage": Decimal("20.00")  # Total = 50%
        }
        assignment = ResourceAssignmentCreate(**assignment_data)
        assert assignment.capital_percentage == Decimal("30.00")
        assert assignment.expense_percentage == Decimal("20.00")
    
    def test_resource_assignment_update_allocation_percentage_not_accepted(self):
        """Test that allocation_percentage is not accepted in update requests (ignored)."""
        update_data = {
            "allocation_percentage": Decimal("75.00"),
            "capital_percentage": Decimal("60.00"),
            "expense_percentage": Decimal("40.00")
        }
        # Pydantic v2 ignores extra fields by default
        update = ResourceAssignmentUpdate(**update_data)
        # Verify allocation_percentage is not in the model
        assert not hasattr(update, 'allocation_percentage')
        assert update.capital_percentage == Decimal("60.00")
        assert update.expense_percentage == Decimal("40.00")
    
    def test_resource_assignment_update_sum_exceeds_100(self):
        """Test that capital + expense > 100 is rejected in updates."""
        update_data = {
            "capital_percentage": Decimal("70.00"),
            "expense_percentage": Decimal("40.00")  # Total = 110%
        }
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentUpdate(**update_data)
        assert "cannot exceed 100" in str(exc_info.value)
    
    def test_assignment_import_row_valid(self):
        """Test valid assignment import row."""
        import_data = {
            "resource_name": "Senior Developer",
            "project_cost_center": "CC001",
            "phase_name": "Planning Phase",
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("70.00"),
            "expense_percentage": Decimal("30.00")
        }
        import_row = AssignmentImportRow(**import_data)
        assert import_row.resource_name == "Senior Developer"
        assert import_row.project_cost_center == "CC001"
    
    def test_assignment_import_row_allocation_percentage_not_accepted(self):
        """Test that allocation_percentage is not accepted in import rows (ignored)."""
        import_data = {
            "resource_name": "Senior Developer",
            "project_cost_center": "CC001",
            "phase_name": "Planning Phase",
            "assignment_date": date(2024, 1, 15),
            "allocation_percentage": Decimal("50.00"),
            "capital_percentage": Decimal("70.00"),
            "expense_percentage": Decimal("30.00")
        }
        # Pydantic v2 ignores extra fields by default
        import_row = AssignmentImportRow(**import_data)
        # Verify allocation_percentage is not in the model
        assert not hasattr(import_row, 'allocation_percentage')
        assert import_row.capital_percentage == Decimal("70.00")
        assert import_row.expense_percentage == Decimal("30.00")
    
    def test_assignment_import_row_sum_exceeds_100(self):
        """Test that capital + expense > 100 is rejected in import rows."""
        import_data = {
            "resource_name": "Senior Developer",
            "project_cost_center": "CC001",
            "phase_name": "Planning Phase",
            "assignment_date": date(2024, 1, 15),
            "capital_percentage": Decimal("80.00"),
            "expense_percentage": Decimal("30.00")  # Total = 110%
        }
        with pytest.raises(ValidationError) as exc_info:
            AssignmentImportRow(**import_data)
        assert "cannot exceed 100" in str(exc_info.value)



class TestActualSchemas:
    """Test actual-related schemas."""
    
    def test_actual_create_valid(self):
        """Test valid actual creation."""
        actual_data = {
            "project_id": uuid4(),
            "external_worker_id": "EMP001",
            "worker_name": "John Developer",
            "actual_date": date(2024, 1, 15),
            "allocation_percentage": Decimal("100.00")
        }
        actual = ActualCreate(**actual_data)
        assert actual.external_worker_id == "EMP001"
        assert actual.allocation_percentage == Decimal("100.00")
    
    def test_actual_create_invalid_cost_split(self):
        """Test actual base schema with invalid cost split."""
        actual_data = {
            "project_id": uuid4(),
            "external_worker_id": "EMP001",
            "worker_name": "John Developer",
            "actual_date": date(2024, 1, 15),
            "allocation_percentage": Decimal("100.00"),
            "actual_cost": Decimal("800.00"),
            "capital_amount": Decimal("500.00"),
            "expense_amount": Decimal("400.00")  # Total = 900, not 800
        }
        with pytest.raises(ValidationError) as exc_info:
            ActualBase(**actual_data)
        assert "Capital amount + expense amount must equal actual cost" in str(exc_info.value)
    
    def test_actual_import_row_valid(self):
        """Test valid actual import row."""
        import_data = {
            "project_cost_center": "CC001",
            "external_worker_id": "EMP001",
            "worker_name": "John Developer",
            "actual_date": date(2024, 1, 15),
            "allocation_percentage": Decimal("100.00"),
            "actual_cost": Decimal("800.00"),
            "capital_amount": Decimal("480.00"),
            "expense_amount": Decimal("320.00")
        }
        import_row = ActualImportRow(**import_data)
        assert import_row.project_cost_center == "CC001"
        assert import_row.external_worker_id == "EMP001"


class TestRateSchemas:
    """Test rate-related schemas."""
    
    def test_rate_create_valid(self):
        """Test valid rate creation."""
        rate_data = {
            "worker_type_id": uuid4(),
            "rate_amount": Decimal("150.00"),
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        }
        rate = RateCreate(**rate_data)
        assert rate.rate_amount == Decimal("150.00")
        assert rate.start_date == date(2024, 1, 1)
    
    def test_rate_create_invalid_dates(self):
        """Test rate creation with invalid dates."""
        rate_data = {
            "worker_type_id": uuid4(),
            "rate_amount": Decimal("150.00"),
            "start_date": date(2024, 12, 31),
            "end_date": date(2024, 1, 1)  # End before start
        }
        with pytest.raises(ValidationError) as exc_info:
            RateCreate(**rate_data)
        assert "End date must be after start date" in str(exc_info.value)
    
    def test_rate_create_zero_amount(self):
        """Test rate creation with zero amount."""
        rate_data = {
            "worker_type_id": uuid4(),
            "rate_amount": Decimal("0.00"),
            "start_date": date(2024, 1, 1)
        }
        with pytest.raises(ValidationError) as exc_info:
            RateCreate(**rate_data)
        assert "greater than 0" in str(exc_info.value)


class TestAuthSchemas:
    """Test authentication-related schemas."""
    
    def test_login_request_valid(self):
        """Test valid login request."""
        login_data = {
            "username": "testuser",
            "password": "securepassword"
        }
        login = LoginRequest(**login_data)
        assert login.username == "testuser"
        assert login.password == "securepassword"
    
    def test_login_request_empty_fields(self):
        """Test login request with empty fields."""
        with pytest.raises(ValidationError) as exc_info:
            LoginRequest(username="", password="test")
        assert "at least 1 character" in str(exc_info.value)
    
    def test_role_switch_request_valid(self):
        """Test valid role switch request."""
        switch_data = {
            "role_type": RoleType.PROJECT_MANAGER,
            "scope_type": ScopeType.PROJECT,
            "scope_id": uuid4()
        }
        switch = RoleSwitchRequest(**switch_data)
        assert switch.role_type == RoleType.PROJECT_MANAGER
        assert switch.scope_type == ScopeType.PROJECT


class TestValidationEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_string_length_limits(self):
        """Test string field length validation."""
        # Test maximum length
        long_name = "x" * 256  # Over 255 character limit
        with pytest.raises(ValidationError) as exc_info:
            ProgramCreate(
                name=long_name,
                business_sponsor="Test",
                program_manager="Test",
                technical_lead="Test",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31)
            )
        assert "at most 255 characters" in str(exc_info.value)
    
    def test_percentage_boundaries(self):
        """Test percentage field boundaries."""
        # Test negative capital percentage
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(
                resource_id=uuid4(),
                project_id=uuid4(),
                project_phase_id=uuid4(),
                assignment_date=date(2024, 1, 15),
                capital_percentage=Decimal("-10.00"),
                expense_percentage=Decimal("40.00")
            )
        assert "greater than or equal to 0" in str(exc_info.value)
        
        # Test capital percentage over 100%
        with pytest.raises(ValidationError) as exc_info:
            ResourceAssignmentCreate(
                resource_id=uuid4(),
                project_id=uuid4(),
                project_phase_id=uuid4(),
                assignment_date=date(2024, 1, 15),
                capital_percentage=Decimal("150.00"),
                expense_percentage=Decimal("40.00")
            )
        assert "less than or equal to 100" in str(exc_info.value)