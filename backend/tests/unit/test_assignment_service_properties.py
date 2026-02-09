"""
Property-based tests for AssignmentService.

Feature: resource-assignment-refactor
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
import pytest
from hypothesis import given, strategies as st, assume, settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.resource_assignment import ResourceAssignment
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource
from app.services.assignment import assignment_service
from app.services.program import program_service
from app.services.project import project_service
from app.services.resource import resource_service
from app.services.portfolio import portfolio_service
from app.models.resource import ResourceType


# Test database setup
@pytest.fixture(scope="session")
def engine():
    """Create test database engine."""
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="session")
def SessionLocal(engine):
    """Create session factory."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_fresh_db_session(SessionLocal):
    """Helper to create a fresh database session and clean up after."""
    session = SessionLocal()
    try:
        # Clean all tables before each test
        session.query(ResourceAssignment).delete()
        session.query(Project).delete()
        session.query(Program).delete()
        session.query(Portfolio).delete()
        session.query(Resource).delete()
        session.commit()
        return session
    except Exception:
        session.rollback()
        raise


# Custom strategies
@st.composite
def valid_percentage(draw):
    """Generate a valid whole number percentage between 0 and 100."""
    return Decimal(str(draw(st.integers(min_value=0, max_value=100))))


@st.composite
def valid_percentage_pair(draw):
    """Generate a pair of whole number percentages that sum to <= 100."""
    capital = draw(st.integers(min_value=0, max_value=100))
    max_expense = 100 - capital
    expense = draw(st.integers(min_value=0, max_value=max_expense))
    return Decimal(str(capital)), Decimal(str(expense))


def create_test_setup(db):
    """Create test data for property tests."""
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
    
    # Create project
    project = project_service.create_project(
        db,
        program_id=program.id,
        name="Test Project",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="CC001",
        execution_capital_budget=Decimal("100000"),
        execution_expense_budget=Decimal("50000")
    )
    
    # Create second project for cross-project tests
    project2 = project_service.create_project(
        db,
        program_id=program.id,
        name="Test Project 2",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="CC002",
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
        "program": program,
        "project": project,
        "project2": project2,
        "resource": resource
    }


class TestCrossProjectAllocationProperty:
    """
    Property 3: Cross-Project Allocation Constraint
    
    For any resource and date, when creating or updating a ResourceAssignment,
    the sum of (capital_percentage + expense_percentage) across all projects
    for that resource on that date must not exceed 100.
    
    **Validates: Requirements 3.1, 3.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        percentages1=valid_percentage_pair(),
        percentages2=valid_percentage_pair()
    )
    def test_cross_project_allocation_constraint_create(self, SessionLocal, percentages1, percentages2):
        """
        Feature: resource-assignment-refactor, Property 3: Cross-Project Allocation Constraint
        
        Test that creating assignments across multiple projects respects the 100% limit.
        """
        db = get_fresh_db_session(SessionLocal)
        try:
            test_setup = create_test_setup(db)
            
            capital1, expense1 = percentages1
            capital2, expense2 = percentages2
            
            assignment_date = date(2024, 6, 15)
            resource_id = test_setup["resource"].id
            project1_id = test_setup["project"].id
            project2_id = test_setup["project2"].id
            
            # Create first assignment
            assignment1 = assignment_service.create_assignment(
                db,
                resource_id=resource_id,
                project_id=project1_id,
                assignment_date=assignment_date,
                capital_percentage=capital1,
                expense_percentage=expense1
            )
            
            assert assignment1 is not None
            
            # Calculate total allocation
            total1 = capital1 + expense1
            total2 = capital2 + expense2
            grand_total = total1 + total2
            
            # Try to create second assignment
            if grand_total <= Decimal('100'):
                # Should succeed
                assignment2 = assignment_service.create_assignment(
                    db,
                    resource_id=resource_id,
                    project_id=project2_id,
                    assignment_date=assignment_date,
                    capital_percentage=capital2,
                    expense_percentage=expense2
                )
                assert assignment2 is not None
                
                # Verify both assignments exist
                assignments = assignment_service.get_assignments_by_date(
                    db, resource_id, assignment_date
                )
                assert len(assignments) == 2
                
                # Verify total doesn't exceed 100%
                actual_total = sum(
                    a.capital_percentage + a.expense_percentage 
                    for a in assignments
                )
                assert actual_total <= Decimal('100')
            else:
                # Should fail
                with pytest.raises(ValueError, match="would exceed 100% allocation"):
                    assignment_service.create_assignment(
                        db,
                        resource_id=resource_id,
                        project_id=project2_id,
                        assignment_date=assignment_date,
                        capital_percentage=capital2,
                        expense_percentage=expense2
                    )
        finally:
            db.close()
    
    @settings(max_examples=100, deadline=None)
    @given(
        initial_percentages=valid_percentage_pair(),
        update_percentages=valid_percentage_pair()
    )
    def test_cross_project_allocation_constraint_update(self, SessionLocal, initial_percentages, update_percentages):
        """
        Feature: resource-assignment-refactor, Property 3: Cross-Project Allocation Constraint
        
        Test that updating assignments respects cross-project allocation limits.
        """
        db = get_fresh_db_session(SessionLocal)
        try:
            test_setup = create_test_setup(db)
            
            initial_capital, initial_expense = initial_percentages
            update_capital, update_expense = update_percentages
            
            assignment_date = date(2024, 6, 15)
            resource_id = test_setup["resource"].id
            project1_id = test_setup["project"].id
            project2_id = test_setup["project2"].id
            
            # Create first assignment
            assignment1 = assignment_service.create_assignment(
                db,
                resource_id=resource_id,
                project_id=project1_id,
                assignment_date=assignment_date,
                capital_percentage=initial_capital,
                expense_percentage=initial_expense
            )
            
            # Only proceed if there's room for a second assignment
            initial_total = initial_capital + initial_expense
            if initial_total + Decimal('20') > Decimal('100'):
                # Not enough room for second assignment, skip this test case
                return
            
            # Create second assignment with small allocation to leave room
            assignment2 = assignment_service.create_assignment(
                db,
                resource_id=resource_id,
                project_id=project2_id,
                assignment_date=assignment_date,
                capital_percentage=Decimal('10'),
                expense_percentage=Decimal('10')
            )
            
            # Calculate what the total would be after update
            other_total = Decimal('20')  # assignment2's total
            update_total = update_capital + update_expense
            grand_total = other_total + update_total
            
            # Try to update first assignment
            if grand_total <= Decimal('100'):
                # Should succeed
                updated = assignment_service.update_assignment(
                    db,
                    assignment_id=assignment1.id,
                    capital_percentage=update_capital,
                    expense_percentage=update_expense
                )
                assert updated is not None
                assert updated.capital_percentage == update_capital
                assert updated.expense_percentage == update_expense
                
                # Verify total doesn't exceed 100%
                assignments = assignment_service.get_assignments_by_date(
                    db, resource_id, assignment_date
                )
                actual_total = sum(
                    a.capital_percentage + a.expense_percentage 
                    for a in assignments
                )
                assert actual_total <= Decimal('100')
            else:
                # Should fail
                with pytest.raises(ValueError, match="would exceed 100% allocation"):
                    assignment_service.update_assignment(
                        db,
                        assignment_id=assignment1.id,
                        capital_percentage=update_capital,
                        expense_percentage=update_expense
                    )
        finally:
            db.close()


class TestUpdateExclusionProperty:
    """
    Property 4: Update Exclusion
    
    For any ResourceAssignment being updated, the cross-project validation
    must exclude the current assignment's values when calculating the total allocation.
    
    **Validates: Requirements 3.4**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        initial_percentages=valid_percentage_pair(),
        new_percentages=valid_percentage_pair()
    )
    def test_update_excludes_current_assignment(self, SessionLocal, initial_percentages, new_percentages):
        """
        Feature: resource-assignment-refactor, Property 4: Update Exclusion
        
        Test that updating an assignment excludes its current values from validation.
        """
        db = get_fresh_db_session(SessionLocal)
        try:
            test_setup = create_test_setup(db)
            
            initial_capital, initial_expense = initial_percentages
            new_capital, new_expense = new_percentages
            
            assignment_date = date(2024, 6, 15)
            resource_id = test_setup["resource"].id
            project_id = test_setup["project"].id
            
            # Create assignment
            assignment = assignment_service.create_assignment(
                db,
                resource_id=resource_id,
                project_id=project_id,
                assignment_date=assignment_date,
                capital_percentage=initial_capital,
                expense_percentage=initial_expense
            )
            
            # Update should only check if new values are valid, not add to existing
            new_total = new_capital + new_expense
            
            if new_total <= Decimal('100'):
                # Should succeed - the update excludes the current assignment
                updated = assignment_service.update_assignment(
                    db,
                    assignment_id=assignment.id,
                    capital_percentage=new_capital,
                    expense_percentage=new_expense
                )
                assert updated is not None
                assert updated.capital_percentage == new_capital
                assert updated.expense_percentage == new_expense
                
                # Verify only one assignment exists
                assignments = assignment_service.get_assignments_by_date(
                    db, resource_id, assignment_date
                )
                assert len(assignments) == 1
                
                # Verify the total is just the new values
                actual_total = assignments[0].capital_percentage + assignments[0].expense_percentage
                assert actual_total == new_total
            else:
                # Should fail due to single assignment constraint
                with pytest.raises(ValueError, match="cannot exceed 100%"):
                    assignment_service.update_assignment(
                        db,
                        assignment_id=assignment.id,
                        capital_percentage=new_capital,
                        expense_percentage=new_expense
                    )
        finally:
            db.close()
    
    @settings(max_examples=100, deadline=None)
    @given(
        percentages1=valid_percentage_pair(),
        percentages2=valid_percentage_pair(),
        update_percentages=valid_percentage_pair()
    )
    def test_update_excludes_only_current_assignment(self, SessionLocal, percentages1, percentages2, update_percentages):
        """
        Feature: resource-assignment-refactor, Property 4: Update Exclusion
        
        Test that update validation excludes only the current assignment, not others.
        """
        db = get_fresh_db_session(SessionLocal)
        try:
            test_setup = create_test_setup(db)
            
            capital1, expense1 = percentages1
            capital2, expense2 = percentages2
            update_capital, update_expense = update_percentages
            
            assignment_date = date(2024, 6, 15)
            resource_id = test_setup["resource"].id
            project1_id = test_setup["project"].id
            project2_id = test_setup["project2"].id
            
            # Create two assignments
            assignment1 = assignment_service.create_assignment(
                db,
                resource_id=resource_id,
                project_id=project1_id,
                assignment_date=assignment_date,
                capital_percentage=capital1,
                expense_percentage=expense1
            )
            
            total1 = capital1 + expense1
            total2 = capital2 + expense2
            
            # Only create second assignment if it fits
            if total1 + total2 <= Decimal('100'):
                assignment2 = assignment_service.create_assignment(
                    db,
                    resource_id=resource_id,
                    project_id=project2_id,
                    assignment_date=assignment_date,
                    capital_percentage=capital2,
                    expense_percentage=expense2
                )
                
                # Try to update first assignment
                update_total = update_capital + update_expense
                # Should consider assignment2's allocation but not assignment1's
                grand_total = total2 + update_total
                
                if grand_total <= Decimal('100'):
                    # Should succeed
                    updated = assignment_service.update_assignment(
                        db,
                        assignment_id=assignment1.id,
                        capital_percentage=update_capital,
                        expense_percentage=update_expense
                    )
                    assert updated is not None
                    
                    # Verify total allocation
                    assignments = assignment_service.get_assignments_by_date(
                        db, resource_id, assignment_date
                    )
                    actual_total = sum(
                        a.capital_percentage + a.expense_percentage 
                        for a in assignments
                    )
                    assert actual_total <= Decimal('100')
                else:
                    # Should fail
                    with pytest.raises(ValueError, match="would exceed 100% allocation"):
                        assignment_service.update_assignment(
                            db,
                            assignment_id=assignment1.id,
                            capital_percentage=update_capital,
                            expense_percentage=update_expense
                        )
        finally:
            db.close()

