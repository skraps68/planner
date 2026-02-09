"""
Property-based tests for ResourceAssignment model constraints.

These tests use Hypothesis to verify universal properties across all possible
resource assignment configurations.

Feature: resource-assignment-refactor
"""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.models.base import Base
from app.models.resource_assignment import ResourceAssignment
from app.models.resource import Resource
from app.models.project import Project
from app.models.program import Program


# Test database setup - use session scope
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
        from app.models.portfolio import Portfolio
        session.query(ResourceAssignment).delete()
        session.query(Resource).delete()
        session.query(Project).delete()
        session.query(Program).delete()
        session.query(Portfolio).delete()
        session.commit()
        return session
    except Exception:
        session.rollback()
        raise


# Helper function to create test resources and projects
def create_test_resource(db_session):
    """Create a test resource."""
    resource = Resource(
        id=uuid4(),
        name=f"Test Resource {uuid4()}",
        resource_type="labor",
        description="Test resource for property tests"
    )
    db_session.add(resource)
    db_session.commit()
    return resource


def create_test_project(db_session):
    """Create a test project."""
    from app.models.portfolio import Portfolio
    
    # Create portfolio first
    portfolio = Portfolio(
        id=uuid4(),
        name=f"Test Portfolio {uuid4()}",
        description="Test portfolio for property tests",
        owner="Test Owner",
        reporting_start_date=date(2020, 1, 1),
        reporting_end_date=date(2030, 12, 31)
    )
    db_session.add(portfolio)
    db_session.commit()
    
    # Create program
    program = Program(
        id=uuid4(),
        name=f"Test Program {uuid4()}",
        portfolio_id=portfolio.id,
        business_sponsor="Test Sponsor",
        program_manager="Test Manager",
        technical_lead="Test Lead",
        start_date=date(2020, 1, 1),
        end_date=date(2030, 12, 31)
    )
    db_session.add(program)
    db_session.commit()
    
    # Create project
    project = Project(
        id=uuid4(),
        name=f"Test Project {uuid4()}",
        program_id=program.id,
        business_sponsor="Test Sponsor",
        project_manager="Test PM",
        technical_lead="Test Lead",
        cost_center_code=f"CC-{uuid4()}",
        start_date=date(2020, 1, 1),
        end_date=date(2030, 12, 31)
    )
    db_session.add(project)
    db_session.commit()
    return project


# Property Tests

@pytest.mark.property_test
class TestResourceAssignmentModelProperties:
    """Property-based tests for ResourceAssignment model."""
    
    @given(
        capital=st.decimals(min_value=Decimal('0'), max_value=Decimal('100'), places=2),
        expense=st.decimals(min_value=Decimal('0'), max_value=Decimal('100'), places=2)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_1_percentage_range_constraints(self, SessionLocal, capital, expense):
        """
        Property 1: Percentage Range Constraints
        
        For any ResourceAssignment, both capital_percentage and expense_percentage
        must be between 0 and 100 (inclusive).
        
        Validates: Requirements 2.1, 2.2
        Feature: resource-assignment-refactor, Property 1: Percentage Range Constraints
        """
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create test data
            resource = create_test_resource(db_session)
            project = create_test_project(db_session)
            
            # Create assignment
            assignment = ResourceAssignment(
                id=uuid4(),
                resource_id=resource.id,
                project_id=project.id,
                assignment_date=date(2025, 6, 15),
                capital_percentage=capital,
                expense_percentage=expense
            )
            
            # Add to session
            db_session.add(assignment)
            
            # Property: Values within 0-100 range should be accepted
            # (may fail sum constraint, but that's tested separately)
            try:
                db_session.commit()
                # If commit succeeds, verify the values are in range
                assert Decimal('0') <= assignment.capital_percentage <= Decimal('100')
                assert Decimal('0') <= assignment.expense_percentage <= Decimal('100')
            except IntegrityError as e:
                # If it fails, it should be due to sum constraint, not range constraint
                error_msg = str(e).lower()
                # Check that it's not a range constraint violation
                if 'check_capital_percentage' in error_msg or 'check_expense_percentage' in error_msg:
                    pytest.fail(f"Range constraint violated for valid values: capital={capital}, expense={expense}")
                # Otherwise, it's likely the sum constraint, which is expected
                db_session.rollback()
        finally:
            db_session.close()
    
    @given(
        capital=st.decimals(min_value=Decimal('0'), max_value=Decimal('100'), places=2),
        expense=st.decimals(min_value=Decimal('0'), max_value=Decimal('100'), places=2)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_2_single_assignment_sum_constraint(self, SessionLocal, capital, expense):
        """
        Property 2: Single Assignment Sum Constraint
        
        For any ResourceAssignment, the sum of capital_percentage + expense_percentage
        must be less than or equal to 100.
        
        Validates: Requirements 2.3
        Feature: resource-assignment-refactor, Property 2: Single Assignment Sum Constraint
        """
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create test data
            resource = create_test_resource(db_session)
            project = create_test_project(db_session)
            
            # Create assignment
            assignment = ResourceAssignment(
                id=uuid4(),
                resource_id=resource.id,
                project_id=project.id,
                assignment_date=date(2025, 6, 15),
                capital_percentage=capital,
                expense_percentage=expense
            )
            
            # Add to session
            db_session.add(assignment)
            
            # Calculate sum
            total = capital + expense
            
            if total <= Decimal('100'):
                # Property: Sum <= 100 should succeed
                try:
                    db_session.commit()
                    assert assignment.capital_percentage + assignment.expense_percentage <= Decimal('100')
                except IntegrityError as e:
                    pytest.fail(f"Valid sum constraint violated: capital={capital}, expense={expense}, sum={total}, error={e}")
            else:
                # Property: Sum > 100 should fail with constraint violation
                with pytest.raises(IntegrityError) as exc_info:
                    db_session.commit()
                
                error_msg = str(exc_info.value).lower()
                assert 'check_allocation_sum' in error_msg or 'constraint' in error_msg, \
                    f"Expected sum constraint violation, got: {error_msg}"
                
                db_session.rollback()
        finally:
            db_session.close()
