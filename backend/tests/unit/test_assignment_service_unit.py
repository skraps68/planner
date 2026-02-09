"""
Unit tests for AssignmentService.

Tests specific scenarios for cross-project validation and error messages.
"""
from datetime import date
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.services.assignment import assignment_service
from app.services.program import program_service
from app.services.project import project_service
from app.services.resource import resource_service
from app.services.portfolio import portfolio_service
from app.models.resource import ResourceType


# Test database setup
@pytest.fixture(scope="module")
def engine():
    """Create test database engine."""
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="module")
def SessionLocal(engine):
    """Create session factory."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db(SessionLocal):
    """Create database session for each test."""
    session = SessionLocal()
    # Clean tables before each test
    from app.models.resource_assignment import ResourceAssignment
    from app.models.project import Project
    from app.models.program import Program
    from app.models.portfolio import Portfolio
    from app.models.resource import Resource
    
    session.query(ResourceAssignment).delete()
    session.query(Project).delete()
    session.query(Program).delete()
    session.query(Portfolio).delete()
    session.query(Resource).delete()
    session.commit()
    
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def test_data(db):
    """Create test data."""
    # Create portfolio
    portfolio = portfolio_service.create_portfolio(
        db,
        name="Test Portfolio",
        description="A test portfolio",
        owner="Test Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    
    # Create program
    program = program_service.create_program(
        db,
        portfolio_id=portfolio.id,
        name="Test Program",
        business_sponsor="John Doe",
        program_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31)
    )
    
    # Create projects
    project1 = project_service.create_project(
        db,
        program_id=program.id,
        name="Project 1",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="CC001",
        execution_capital_budget=Decimal("100000"),
        execution_expense_budget=Decimal("50000")
    )
    
    project2 = project_service.create_project(
        db,
        program_id=program.id,
        name="Project 2",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="CC002",
        execution_capital_budget=Decimal("100000"),
        execution_expense_budget=Decimal("50000")
    )
    
    project3 = project_service.create_project(
        db,
        program_id=program.id,
        name="Project 3",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="CC003",
        execution_capital_budget=Decimal("100000"),
        execution_expense_budget=Decimal("50000")
    )
    
    # Create resource
    resource = resource_service.create_resource(
        db,
        name="Test Resource",
        resource_type=ResourceType.LABOR,
        description="A test resource"
    )
    
    return {
        "portfolio": portfolio,
        "program": program,
        "project1": project1,
        "project2": project2,
        "project3": project3,
        "resource": resource
    }


class TestCrossProjectValidation:
    """Test cross-project allocation validation."""
    
    def test_create_assignment_within_single_project_limit(self, db, test_data):
        """Test creating assignment with capital + expense <= 100 succeeds."""
        assignment = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("60"),
            expense_percentage=Decimal("40")
        )
        
        assert assignment is not None
        assert assignment.capital_percentage == Decimal("60")
        assert assignment.expense_percentage == Decimal("40")
    
    def test_create_assignment_exceeding_single_project_limit_fails(self, db, test_data):
        """Test creating assignment with capital + expense > 100 fails."""
        with pytest.raises(ValueError, match="cannot exceed 100%"):
            assignment_service.create_assignment(
                db,
                resource_id=test_data["resource"].id,
                project_id=test_data["project1"].id,
                assignment_date=date(2024, 6, 15),
                capital_percentage=Decimal("60"),
                expense_percentage=Decimal("50")
            )
    
    def test_create_assignment_across_two_projects_within_limit(self, db, test_data):
        """Test creating assignments across two projects within 100% limit."""
        # Create first assignment
        assignment1 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("30"),
            expense_percentage=Decimal("20")
        )
        
        # Create second assignment
        assignment2 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project2"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("25"),
            expense_percentage=Decimal("25")
        )
        
        assert assignment1 is not None
        assert assignment2 is not None
        
        # Verify total is 100%
        total = (assignment1.capital_percentage + assignment1.expense_percentage +
                assignment2.capital_percentage + assignment2.expense_percentage)
        assert total == Decimal("100")
    
    def test_create_assignment_across_two_projects_exceeding_limit_fails(self, db, test_data):
        """Test creating assignments across two projects exceeding 100% fails."""
        # Create first assignment
        assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("40"),
            expense_percentage=Decimal("30")
        )
        
        # Try to create second assignment that would exceed 100%
        with pytest.raises(ValueError, match="would exceed 100% allocation"):
            assignment_service.create_assignment(
                db,
                resource_id=test_data["resource"].id,
                project_id=test_data["project2"].id,
                assignment_date=date(2024, 6, 15),
                capital_percentage=Decimal("20"),
                expense_percentage=Decimal("15")
            )
    
    def test_create_assignment_across_three_projects(self, db, test_data):
        """Test creating assignments across three projects."""
        # Create three assignments totaling 100%
        assignment1 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("20"),
            expense_percentage=Decimal("10")
        )
        
        assignment2 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project2"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("30"),
            expense_percentage=Decimal("10")
        )
        
        assignment3 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project3"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("15"),
            expense_percentage=Decimal("15")
        )
        
        assert assignment1 is not None
        assert assignment2 is not None
        assert assignment3 is not None
        
        # Verify total is 100%
        total = (assignment1.capital_percentage + assignment1.expense_percentage +
                assignment2.capital_percentage + assignment2.expense_percentage +
                assignment3.capital_percentage + assignment3.expense_percentage)
        assert total == Decimal("100")
    
    def test_error_message_contains_allocation_details(self, db, test_data):
        """Test that error message contains current and attempted allocation details."""
        # Create first assignment
        assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("30")
        )
        
        # Try to create second assignment that would exceed 100%
        with pytest.raises(ValueError) as exc_info:
            assignment_service.create_assignment(
                db,
                resource_id=test_data["resource"].id,
                project_id=test_data["project2"].id,
                assignment_date=date(2024, 6, 15),
                capital_percentage=Decimal("15"),
                expense_percentage=Decimal("10")
            )
        
        error_message = str(exc_info.value)
        assert "would exceed 100% allocation" in error_message
        assert "Current total across other projects: 80" in error_message
        assert "This assignment: 25" in error_message
        assert "Would result in: 105" in error_message


class TestUpdateExclusion:
    """Test that update validation excludes current assignment."""
    
    def test_update_assignment_excludes_current_values(self, db, test_data):
        """Test that updating an assignment excludes its current values from validation."""
        # Create assignment
        assignment = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("30")
        )
        
        # Update to different values (should not count old values)
        updated = assignment_service.update_assignment(
            db,
            assignment_id=assignment.id,
            capital_percentage=Decimal("40"),
            expense_percentage=Decimal("35")
        )
        
        assert updated.capital_percentage == Decimal("40")
        assert updated.expense_percentage == Decimal("35")
    
    def test_update_assignment_considers_other_projects(self, db, test_data):
        """Test that update validation considers other projects' allocations."""
        # Create two assignments
        assignment1 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("30"),
            expense_percentage=Decimal("20")
        )
        
        assignment2 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project2"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("25"),
            expense_percentage=Decimal("25")
        )
        
        # Try to update first assignment to exceed 100% total
        with pytest.raises(ValueError, match="would exceed 100% allocation"):
            assignment_service.update_assignment(
                db,
                assignment_id=assignment1.id,
                capital_percentage=Decimal("40"),
                expense_percentage=Decimal("20")
            )
    
    def test_update_error_message_excludes_current_assignment(self, db, test_data):
        """Test that error message shows correct totals excluding current assignment."""
        # Create two assignments
        assignment1 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("30"),
            expense_percentage=Decimal("20")
        )
        
        assignment2 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project2"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("25"),
            expense_percentage=Decimal("25")
        )
        
        # Try to update first assignment
        with pytest.raises(ValueError) as exc_info:
            assignment_service.update_assignment(
                db,
                assignment_id=assignment1.id,
                capital_percentage=Decimal("35"),
                expense_percentage=Decimal("25")
            )
        
        error_message = str(exc_info.value)
        # Should show assignment2's total (50%) as "other projects"
        assert "Current total across other projects: 50" in error_message
        assert "This assignment: 60" in error_message
        assert "Would result in: 110" in error_message


class TestDifferentDates:
    """Test that validation is date-specific."""
    
    def test_assignments_on_different_dates_dont_interfere(self, db, test_data):
        """Test that assignments on different dates don't affect each other."""
        # Create assignment on date 1
        assignment1 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("80"),
            expense_percentage=Decimal("20")
        )
        
        # Create assignment on date 2 (should not be affected by date 1)
        assignment2 = assignment_service.create_assignment(
            db,
            resource_id=test_data["resource"].id,
            project_id=test_data["project1"].id,
            assignment_date=date(2024, 6, 16),
            capital_percentage=Decimal("90"),
            expense_percentage=Decimal("10")
        )
        
        assert assignment1 is not None
        assert assignment2 is not None
