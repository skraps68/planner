"""
Property-based tests for optimistic locking conflict detection.

Feature: optimistic-locking
Property 5: Conflict Detection on Version Mismatch
Validates: Requirements 2.3, 2.4, 4.1, 7.1, 7.2
"""
import pytest
from datetime import date
from hypothesis import given, strategies as st, settings
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.models.resource_assignment import ResourceAssignment
from tests.conftest import engine


# Create a session factory for property tests
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Feature: optimistic-locking, Property 5: Conflict Detection on Version Mismatch
@given(
    name1=st.text(min_size=1, max_size=50),
    name2=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_portfolio_version_conflict_detection(name1, name2, db):
    """
    For any portfolio, when an update request is sent with a version number
    that does not match the current database version, the system should raise
    a StaleDataError.
    
    Validates: Requirements 2.3, 2.4, 4.1, 7.1, 7.2
    """
    session1 = TestSession()
    session2 = TestSession()
    try:
        # Create a portfolio in session 1
        portfolio_id = uuid4()
        portfolio = Portfolio(
            id=portfolio_id,
            name="Original Name",
            description="Test portfolio",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        original_version = portfolio.version
        assert original_version == 1, "New portfolio should have version 1"
        
        # Both sessions read the same portfolio (simulating two users)
        portfolio_user1 = session1.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        portfolio_user2 = session2.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        
        assert portfolio_user1.version == portfolio_user2.version == 1
        
        # User 1 updates successfully (increments version to 2)
        portfolio_user1.name = name1
        session1.commit()
        session1.refresh(portfolio_user1)
        
        assert portfolio_user1.version == 2, "Version should increment after update"
        
        # User 2 tries to update with stale version (still thinks version is 1)
        # This should raise StaleDataError because the WHERE clause will be:
        # WHERE id = ? AND version = 1, but version is now 2 in the database
        portfolio_user2.name = name2
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
    finally:
        session1.close()
        session2.close()


@given(
    name1=st.text(min_size=1, max_size=50),
    name2=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_program_version_conflict_detection(name1, name2, db):
    """
    For any program, when an update request is sent with a version number
    that does not match the current database version, the system should raise
    a StaleDataError.
    """
    session1 = TestSession()
    session2 = TestSession()
    try:
        # Create portfolio first
        portfolio_id = uuid4()
        portfolio = Portfolio(
            id=portfolio_id,
            name="Test Portfolio",
            description="Test",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        # Create a program
        program_id = uuid4()
        program = Program(
            id=program_id,
            portfolio_id=portfolio_id,
            name="Original Name",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session1.add(program)
        session1.commit()
        
        original_version = program.version
        
        # Both sessions read the same program
        program_user1 = session1.query(Program).filter(Program.id == program_id).first()
        program_user2 = session2.query(Program).filter(Program.id == program_id).first()
        
        # User 1 updates successfully
        program_user1.name = name1
        session1.commit()
        session1.refresh(program_user1)
        
        assert program_user1.version == original_version + 1
        
        # User 2 tries to update with stale version
        program_user2.name = name2
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
    finally:
        session1.close()
        session2.close()


@given(
    name1=st.text(min_size=1, max_size=50),
    name2=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_project_version_conflict_detection(name1, name2, db):
    """
    For any project, when an update request is sent with a version number
    that does not match the current database version, the system should raise
    a StaleDataError.
    """
    session1 = TestSession()
    session2 = TestSession()
    try:
        # Create portfolio and program first
        portfolio_id = uuid4()
        portfolio = Portfolio(
            id=portfolio_id,
            name="Test Portfolio",
            description="Test",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        program_id = uuid4()
        program = Program(
            id=program_id,
            portfolio_id=portfolio_id,
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session1.add(program)
        session1.commit()
        
        # Create a project
        project_id = uuid4()
        project = Project(
            id=project_id,
            program_id=program_id,
            name="Original Name",
            business_sponsor="Sponsor",
            project_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}"
        )
        session1.add(project)
        session1.commit()
        
        original_version = project.version
        
        # Both sessions read the same project
        project_user1 = session1.query(Project).filter(Project.id == project_id).first()
        project_user2 = session2.query(Project).filter(Project.id == project_id).first()
        
        # User 1 updates successfully
        project_user1.name = name1
        session1.commit()
        session1.refresh(project_user1)
        
        assert project_user1.version == original_version + 1
        
        # User 2 tries to update with stale version
        project_user2.name = name2
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
    finally:
        session1.close()
        session2.close()


@given(
    name1=st.text(min_size=1, max_size=50),
    name2=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_resource_version_conflict_detection(name1, name2, db):
    """
    For any resource, when an update request is sent with a version number
    that does not match the current database version, the system should raise
    a StaleDataError.
    """
    session1 = TestSession()
    session2 = TestSession()
    try:
        # Create a resource
        resource_id = uuid4()
        resource = Resource(
            id=resource_id,
            name="Original Name",
            resource_type=ResourceType.LABOR,
            description="Test resource"
        )
        session1.add(resource)
        session1.commit()
        
        original_version = resource.version
        
        # Both sessions read the same resource
        resource_user1 = session1.query(Resource).filter(Resource.id == resource_id).first()
        resource_user2 = session2.query(Resource).filter(Resource.id == resource_id).first()
        
        # User 1 updates successfully
        resource_user1.name = name1
        session1.commit()
        session1.refresh(resource_user1)
        
        assert resource_user1.version == original_version + 1
        
        # User 2 tries to update with stale version
        resource_user2.name = name2
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
    finally:
        session1.close()
        session2.close()


@given(
    percentage1=st.decimals(min_value=0, max_value=50, places=2),
    percentage2=st.decimals(min_value=0, max_value=50, places=2)
)
@settings(max_examples=100, deadline=None)
def test_resource_assignment_version_conflict_detection(percentage1, percentage2, db):
    """
    For any resource assignment, when an update request is sent with a version number
    that does not match the current database version, the system should raise
    a StaleDataError.
    
    This is especially important for high-concurrency entities like resource assignments.
    """
    session1 = TestSession()
    session2 = TestSession()
    try:
        # Create necessary entities
        portfolio_id = uuid4()
        portfolio = Portfolio(
            id=portfolio_id,
            name="Test Portfolio",
            description="Test",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        program_id = uuid4()
        program = Program(
            id=program_id,
            portfolio_id=portfolio_id,
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session1.add(program)
        session1.commit()
        
        project_id = uuid4()
        project = Project(
            id=project_id,
            program_id=program_id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}"
        )
        session1.add(project)
        session1.commit()
        
        resource_id = uuid4()
        resource = Resource(
            id=resource_id,
            name="Test Resource",
            resource_type=ResourceType.LABOR,
            description="Test"
        )
        session1.add(resource)
        session1.commit()
        
        # Create a resource assignment with initial values that allow updates
        assignment_id = uuid4()
        assignment = ResourceAssignment(
            id=assignment_id,
            resource_id=resource_id,
            project_id=project_id,
            assignment_date=date(2024, 6, 1),
            capital_percentage=25.0,
            expense_percentage=25.0
        )
        session1.add(assignment)
        session1.commit()
        
        original_version = assignment.version
        
        # Both sessions read the same assignment
        assignment_user1 = session1.query(ResourceAssignment).filter(
            ResourceAssignment.id == assignment_id
        ).first()
        assignment_user2 = session2.query(ResourceAssignment).filter(
            ResourceAssignment.id == assignment_id
        ).first()
        
        # User 1 updates successfully (ensure it's different from initial value)
        new_capital = float(percentage1)
        # If the new value equals the old value, skip this test case
        if new_capital == 25.0:
            new_capital = 30.0
        
        assignment_user1.capital_percentage = new_capital
        session1.commit()
        session1.refresh(assignment_user1)
        
        assert assignment_user1.version == original_version + 1
        
        # User 2 tries to update with stale version
        new_expense = float(percentage2)
        # Ensure it's different from initial value
        if new_expense == 25.0:
            new_expense = 30.0
            
        assignment_user2.expense_percentage = new_expense
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
    finally:
        session1.close()
        session2.close()
