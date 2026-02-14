"""
Property-based tests for optimistic locking conflict response structure.

Feature: optimistic-locking
Property 7: Conflict Response Structure
Validates: Requirements 4.2, 4.4, 4.5
"""
import pytest
from datetime import date
from hypothesis import given, strategies as st, settings
from uuid import uuid4
from sqlalchemy.orm.exc import StaleDataError

from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.core.exceptions import ConflictError
from tests.conftest import TestingSessionLocal


# Feature: optimistic-locking, Property 7: Conflict Response Structure
@given(
    name=st.text(min_size=1, max_size=50),
    description=st.text(min_size=1, max_size=200)
)
@settings(max_examples=100, deadline=None)
def test_portfolio_conflict_error_structure(name, description, db):
    """
    For any version conflict, the ConflictError exception should contain
    a consistent structure with: error type, user-friendly message,
    entity type, entity ID, and the current state of the entity.
    
    This tests the conflict detection at the service layer, which is where
    StaleDataError is caught and ConflictError is raised.
    
    Validates: Requirements 4.2, 4.4, 4.5
    """
    # Create two separate sessions to simulate concurrent updates
    session1 = TestingSessionLocal()
    session2 = TestingSessionLocal()
    
    try:
        # Session 1: Create a portfolio
        portfolio = Portfolio(
            id=uuid4(),
            name="Original Name",
            description="Original Description",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        session1.refresh(portfolio)
        
        portfolio_id = portfolio.id
        original_version = portfolio.version
        
        # Session 1: Read the portfolio (simulating User 1)
        portfolio_user1 = session1.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        
        # Session 2: Read the same portfolio (simulating User 2)
        portfolio_user2 = session2.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        
        # Session 2: User 2 updates first
        portfolio_user2.name = "Updated by User 2"
        session2.commit()
        session2.refresh(portfolio_user2)
        new_version = portfolio_user2.version
        
        # Session 1: User 1 tries to update with stale data (should raise StaleDataError)
        portfolio_user1.name = name
        portfolio_user1.description = description
        
        try:
            session1.commit()
            # If we get here, the version check didn't work
            pytest.fail("Expected StaleDataError but update succeeded")
        except StaleDataError:
            # This is expected - now simulate the API layer's error handling
            session1.rollback()
            
            # Fetch current state (what API layer does)
            current = session1.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
            
            # Create ConflictError (what API layer does)
            error = ConflictError("portfolio", str(portfolio_id), {
                "id": str(current.id),
                "name": current.name,
                "description": current.description,
                "version": current.version,
                "owner": current.owner,
                "reporting_start_date": current.reporting_start_date.isoformat(),
                "reporting_end_date": current.reporting_end_date.isoformat()
            })
            
            # Verify ConflictError structure
            assert error.status_code == 409, "Status code should be 409"
            
            detail = error.details
            assert isinstance(detail, dict), "Details should be a dictionary"
            
            # Check required fields
            assert "error" in detail, "Details should have 'error' field"
            assert detail["error"] == "conflict", "Error type should be 'conflict'"
            
            # Check message is in the exception
            assert isinstance(error.message, str), "Message should be a string"
            assert len(error.message) > 0, "Message should not be empty"
            assert "portfolio" in error.message.lower(), "Message should mention entity type"
            
            assert "entity_type" in detail, "Details should have 'entity_type' field"
            assert detail["entity_type"] == "portfolio", "Entity type should be 'portfolio'"
            
            assert "entity_id" in detail, "Details should have 'entity_id' field"
            assert detail["entity_id"] == str(portfolio_id), "Entity ID should match"
            
            assert "current_state" in detail, "Details should have 'current_state' field"
            current_state = detail["current_state"]
            
            # Verify current state contains the entity data
            assert "id" in current_state, "Current state should have 'id'"
            assert "name" in current_state, "Current state should have 'name'"
            assert "version" in current_state, "Current state should have 'version'"
            assert current_state["version"] == new_version, "Current version should match updated version"
            assert current_state["version"] > original_version, "Current version should be greater than stale version"
        
    finally:
        session1.close()
        session2.close()


@given(
    name=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_program_conflict_error_structure(name, db):
    """
    For any program version conflict, the ConflictError should contain
    the required structure.
    """
    session1 = TestingSessionLocal()
    session2 = TestingSessionLocal()
    
    try:
        # Create portfolio first
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        # Create a program
        program = Program(
            id=uuid4(),
            portfolio_id=portfolio.id,
            name="Original Name",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session1.add(program)
        session1.commit()
        session1.refresh(program)
        
        program_id = program.id
        original_version = program.version
        
        # Session 1: Read the program (User 1)
        program_user1 = session1.query(Program).filter(Program.id == program_id).first()
        
        # Session 2: Read the same program (User 2)
        program_user2 = session2.query(Program).filter(Program.id == program_id).first()
        
        # Session 2: User 2 updates first
        program_user2.name = "Updated by User 2"
        session2.commit()
        session2.refresh(program_user2)
        new_version = program_user2.version
        
        # Session 1: User 1 tries to update with stale data
        program_user1.name = name
        
        try:
            session1.commit()
            pytest.fail("Expected StaleDataError but update succeeded")
        except StaleDataError:
            session1.rollback()
            
            # Fetch current state and create ConflictError
            current = session1.query(Program).filter(Program.id == program_id).first()
            error = ConflictError("program", str(program_id), {
                "id": str(current.id),
                "name": current.name,
                "version": current.version
            })
            
            # Verify structure
            assert error.status_code == 409
            detail = error.details
            assert detail["error"] == "conflict"
            assert isinstance(error.message, str)
            assert "program" in error.message.lower()
            assert detail["entity_type"] == "program"
            assert detail["entity_id"] == str(program_id)
            assert "current_state" in detail
            assert detail["current_state"]["version"] == new_version
        
    finally:
        session1.close()
        session2.close()


@given(
    name=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_project_conflict_error_structure(name, db):
    """
    For any project version conflict, the ConflictError should contain
    the required structure.
    """
    session1 = TestingSessionLocal()
    session2 = TestingSessionLocal()
    
    try:
        # Create portfolio and program first
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        program = Program(
            id=uuid4(),
            portfolio_id=portfolio.id,
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
        project = Project(
            id=uuid4(),
            program_id=program.id,
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
        session1.refresh(project)
        
        project_id = project.id
        original_version = project.version
        
        # Session 1: Read the project (User 1)
        project_user1 = session1.query(Project).filter(Project.id == project_id).first()
        
        # Session 2: Read the same project (User 2)
        project_user2 = session2.query(Project).filter(Project.id == project_id).first()
        
        # Session 2: User 2 updates first
        project_user2.name = "Updated by User 2"
        session2.commit()
        session2.refresh(project_user2)
        new_version = project_user2.version
        
        # Session 1: User 1 tries to update with stale data
        project_user1.name = name
        
        try:
            session1.commit()
            pytest.fail("Expected StaleDataError but update succeeded")
        except StaleDataError:
            session1.rollback()
            
            # Fetch current state and create ConflictError
            current = session1.query(Project).filter(Project.id == project_id).first()
            error = ConflictError("project", str(project_id), {
                "id": str(current.id),
                "name": current.name,
                "version": current.version
            })
            
            # Verify structure
            assert error.status_code == 409
            detail = error.details
            assert detail["error"] == "conflict"
            assert isinstance(error.message, str)
            assert "project" in error.message.lower()
            assert detail["entity_type"] == "project"
            assert detail["entity_id"] == str(project_id)
            assert "current_state" in detail
            assert detail["current_state"]["version"] == new_version
        
    finally:
        session1.close()
        session2.close()


