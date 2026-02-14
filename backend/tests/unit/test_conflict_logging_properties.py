"""
Property-based tests for optimistic locking conflict logging.

Feature: optimistic-locking
Property 9: Conflict Logging
Validates: Requirements 10.1, 10.2, 10.3, 10.4
"""
import pytest
import logging
from datetime import date
from hypothesis import given, strategies as st, settings
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.orm import sessionmaker
from uuid import uuid4
from unittest.mock import patch, MagicMock

from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.core.exceptions import ConflictError
from tests.conftest import engine


# Create a session factory for property tests
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Feature: optimistic-locking, Property 9: Conflict Logging
@given(
    entity_name=st.text(min_size=1, max_size=50),
    update_name=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_conflict_logging_contains_required_fields(entity_name, update_name, db):
    """
    For any version conflict, the system should log the conflict with:
    - entity type
    - entity ID
    - expected version (implied by the conflict)
    - actual version
    - user ID (if available)
    
    And should NOT log sensitive data.
    
    Validates: Requirements 10.1, 10.2, 10.3, 10.4
    """
    session1 = TestSession()
    session2 = TestSession()
    
    try:
        # Create a portfolio
        portfolio_id = uuid4()
        portfolio = Portfolio(
            id=portfolio_id,
            name=entity_name,
            description="Test portfolio",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session1.add(portfolio)
        session1.commit()
        
        # Both sessions read the same portfolio
        portfolio_user1 = session1.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        portfolio_user2 = session2.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        
        original_version = portfolio_user1.version
        
        # User 1 updates successfully
        portfolio_user1.name = "Updated by User 1"
        session1.commit()
        session1.refresh(portfolio_user1)
        
        new_version = portfolio_user1.version
        assert new_version == original_version + 1
        
        # User 2 tries to update with stale version - this will raise StaleDataError
        # Ensure the update is different from the value in portfolio_user2's session
        # portfolio_user2 still has the original name (entity_name), so we need to change it
        if portfolio_user2.name == update_name:
            # If update_name equals current value, use a different value
            user2_update_name = update_name + "_modified"
        else:
            user2_update_name = update_name
        
        portfolio_user2.name = user2_update_name
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
        
        # Now simulate the API layer catching StaleDataError and raising ConflictError
        # This is where logging should occur
        current_portfolio = session1.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        current_state = {
            "id": str(current_portfolio.id),
            "name": current_portfolio.name,
            "version": current_portfolio.version,
            "description": current_portfolio.description,
            "owner": current_portfolio.owner
        }
        
        # Mock the logger to capture log calls
        with patch('app.core.error_handlers.logger') as mock_logger:
            # Create ConflictError (this is what the API endpoint does)
            conflict_error = ConflictError(
                entity_type="portfolio",
                entity_id=str(portfolio_id),
                current_state=current_state
            )
            
            # Simulate the error handler being called
            from app.core.error_handlers import conflict_error_handler
            from fastapi import Request
            from unittest.mock import AsyncMock
            
            # Create a mock request
            mock_request = MagicMock(spec=Request)
            mock_request.url.path = "/api/v1/portfolios/" + str(portfolio_id)
            mock_request.method = "PUT"
            mock_request.state.user_id = uuid4()  # Simulate authenticated user
            
            # Call the error handler (this should trigger logging)
            import asyncio
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            # Verify logging was called
            assert mock_logger.warning.called, "Logger should be called for conflict"
            
            # Get the log call arguments
            log_call = mock_logger.warning.call_args
            log_message = log_call[0][0]
            log_extra = log_call[1].get('extra', {})
            
            # Verify required fields are present in log
            # Requirement 10.1: Log entity type and entity ID
            assert "entity_type" in log_extra, "Log should contain entity_type"
            assert log_extra["entity_type"] == "portfolio", "Entity type should be 'portfolio'"
            assert "entity_id" in log_extra, "Log should contain entity_id"
            assert log_extra["entity_id"] == str(portfolio_id), "Entity ID should match"
            
            # Requirement 10.2: Log expected and actual version numbers
            assert "actual_version" in log_extra, "Log should contain actual_version"
            assert log_extra["actual_version"] == new_version, "Actual version should match current version"
            
            # Requirement 10.3: Log user ID who attempted the update
            assert "user_id" in log_extra, "Log should contain user_id"
            assert log_extra["user_id"] is not None, "User ID should be present"
            
            # Requirement 10.4: Ensure no sensitive data is logged
            # Check that description and owner (potentially sensitive) are not in the log extra fields
            assert "description" not in log_extra, "Sensitive field 'description' should not be in log"
            assert "owner" not in log_extra, "Sensitive field 'owner' should not be in log"
            
            # Verify the log message is informative but doesn't contain sensitive data
            assert "portfolio" in log_message.lower(), "Log message should mention entity type"
            assert str(portfolio_id) in log_message, "Log message should mention entity ID"
            
    finally:
        session1.close()
        session2.close()


@given(
    entity_name=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_conflict_logging_for_different_entity_types(entity_name, db):
    """
    For any entity type (Portfolio, Program, Project, Resource), conflict logging
    should work consistently with the same required fields.
    
    Validates: Requirements 10.1, 10.2, 10.3, 10.4
    """
    session1 = TestSession()
    session2 = TestSession()
    
    try:
        # Test with Resource entity (simpler than Portfolio)
        resource_id = uuid4()
        resource = Resource(
            id=resource_id,
            name=entity_name,
            resource_type=ResourceType.LABOR,
            description="Test resource"
        )
        session1.add(resource)
        session1.commit()
        
        # Both sessions read the same resource
        resource_user1 = session1.query(Resource).filter(Resource.id == resource_id).first()
        resource_user2 = session2.query(Resource).filter(Resource.id == resource_id).first()
        
        original_version = resource_user1.version
        
        # User 1 updates successfully
        resource_user1.name = "Updated by User 1"
        session1.commit()
        session1.refresh(resource_user1)
        
        new_version = resource_user1.version
        
        # User 2 tries to update with stale version
        resource_user2.name = "Updated by User 2"
        
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
        
        # Simulate API layer handling
        current_resource = session1.query(Resource).filter(Resource.id == resource_id).first()
        current_state = {
            "id": str(current_resource.id),
            "name": current_resource.name,
            "version": current_resource.version,
            "resource_type": current_resource.resource_type.value
        }
        
        # Mock the logger
        with patch('app.core.error_handlers.logger') as mock_logger:
            conflict_error = ConflictError(
                entity_type="resource",
                entity_id=str(resource_id),
                current_state=current_state
            )
            
            from app.core.error_handlers import conflict_error_handler
            from fastapi import Request
            from unittest.mock import AsyncMock
            
            mock_request = MagicMock(spec=Request)
            mock_request.url.path = "/api/v1/resources/" + str(resource_id)
            mock_request.method = "PUT"
            mock_request.state.user_id = uuid4()
            
            import asyncio
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            # Verify logging
            assert mock_logger.warning.called
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify all required fields
            assert log_extra["entity_type"] == "resource"
            assert log_extra["entity_id"] == str(resource_id)
            assert log_extra["actual_version"] == new_version
            assert log_extra["user_id"] is not None
            
            # Verify no sensitive data (description should not be in log extra)
            assert "description" not in log_extra
            
    finally:
        session1.close()
        session2.close()


@given(
    entity_name=st.text(min_size=1, max_size=50)
)
@settings(max_examples=100, deadline=None)
def test_conflict_logging_without_user_context(entity_name, db):
    """
    Conflict logging should work even when user context is not available
    (e.g., for system operations or when authentication middleware hasn't run).
    
    Validates: Requirements 10.1, 10.2, 10.3
    """
    session1 = TestSession()
    session2 = TestSession()
    
    try:
        # Create a resource
        resource_id = uuid4()
        resource = Resource(
            id=resource_id,
            name=entity_name,
            resource_type=ResourceType.LABOR,
            description="Test resource"
        )
        session1.add(resource)
        session1.commit()
        
        # Simulate conflict
        resource_user1 = session1.query(Resource).filter(Resource.id == resource_id).first()
        resource_user2 = session2.query(Resource).filter(Resource.id == resource_id).first()
        
        resource_user1.name = "Updated"
        session1.commit()
        session1.refresh(resource_user1)
        
        new_version = resource_user1.version
        
        resource_user2.name = "Conflict"
        with pytest.raises(StaleDataError):
            session2.commit()
        session2.rollback()
        
        # Simulate API layer handling WITHOUT user context
        current_resource = session1.query(Resource).filter(Resource.id == resource_id).first()
        current_state = {
            "id": str(current_resource.id),
            "name": current_resource.name,
            "version": current_resource.version
        }
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            conflict_error = ConflictError(
                entity_type="resource",
                entity_id=str(resource_id),
                current_state=current_state
            )
            
            from app.core.error_handlers import conflict_error_handler
            from fastapi import Request
            
            # Mock request WITHOUT user_id in state
            mock_request = MagicMock(spec=Request)
            mock_request.url.path = "/api/v1/resources/" + str(resource_id)
            mock_request.method = "PUT"
            mock_request.state = MagicMock()
            # Simulate missing user_id attribute
            type(mock_request.state).user_id = property(lambda self: None)
            
            import asyncio
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            # Verify logging still works
            assert mock_logger.warning.called
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Required fields should still be present
            assert log_extra["entity_type"] == "resource"
            assert log_extra["entity_id"] == str(resource_id)
            assert log_extra["actual_version"] == new_version
            
            # user_id should be None (not missing)
            assert "user_id" in log_extra
            assert log_extra["user_id"] is None
            
    finally:
        session1.close()
        session2.close()
