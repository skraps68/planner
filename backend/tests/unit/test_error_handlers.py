"""
Tests for error handlers and custom exceptions.
"""
import pytest
from uuid import uuid4

from app.core.exceptions import (
    AppException,
    AuthenticationError,
    AuthorizationError,
    ScopeAccessDeniedError,
    ValidationError,
    InvalidInputError,
    InvalidDateRangeError,
    InvalidPercentageError,
    InvalidUUIDError,
    BusinessRuleViolationError,
    AllocationConflictError,
    ResourceNotFoundError,
    ProjectNotFoundError,
    WorkerNotFoundError,
    ImportError as ImportException,
)


class TestCustomExceptions:
    """Test custom exception classes."""
    
    def test_app_exception_basic(self):
        """Test basic AppException."""
        exc = AppException("Test error", status_code=400, error_code="TEST_ERROR")
        assert exc.message == "Test error"
        assert exc.status_code == 400
        assert exc.error_code == "TEST_ERROR"
        assert exc.details == {}
    
    def test_app_exception_with_details(self):
        """Test AppException with details."""
        details = {"field": "test", "value": 123}
        exc = AppException("Test error", details=details)
        assert exc.details == details
    
    def test_authentication_error(self):
        """Test AuthenticationError."""
        exc = AuthenticationError("Invalid credentials")
        assert exc.message == "Invalid credentials"
        assert exc.status_code == 401
        assert exc.error_code == "AUTH_FAILED"
    
    def test_authorization_error(self):
        """Test AuthorizationError."""
        exc = AuthorizationError("Insufficient permissions", required_permissions=["read", "write"])
        assert exc.message == "Insufficient permissions"
        assert exc.status_code == 403
        assert exc.error_code == "FORBIDDEN"
        assert "required_permissions" in exc.details
        assert exc.details["required_permissions"] == ["read", "write"]
    
    def test_scope_access_denied_error(self):
        """Test ScopeAccessDeniedError."""
        resource_id = uuid4()
        exc = ScopeAccessDeniedError("Program", resource_id)
        assert exc.status_code == 403
        assert "resource_type" in exc.details
        assert exc.details["resource_type"] == "Program"
        assert exc.details["resource_id"] == str(resource_id)
    
    def test_validation_error(self):
        """Test ValidationError."""
        field_errors = [{"field": "name", "message": "Required"}]
        exc = ValidationError("Validation failed", field_errors=field_errors)
        assert exc.status_code == 422
        assert exc.error_code == "VALIDATION_ERROR"
        assert "field_errors" in exc.details
    
    def test_invalid_input_error(self):
        """Test InvalidInputError."""
        exc = InvalidInputError("email", "Invalid format", "not-an-email")
        assert exc.status_code == 422
        assert "field_errors" in exc.details
        assert len(exc.details["field_errors"]) == 1
        assert exc.details["field_errors"][0]["field"] == "email"
    
    def test_invalid_percentage_error(self):
        """Test InvalidPercentageError."""
        exc = InvalidPercentageError("allocation", 150.0)
        assert exc.status_code == 422
        assert "150" in exc.message or "150.0" in exc.message
    
    def test_invalid_uuid_error(self):
        """Test InvalidUUIDError."""
        exc = InvalidUUIDError("project_id", "not-a-uuid")
        assert exc.status_code == 422
        assert "not-a-uuid" in exc.message
    
    def test_business_rule_violation_error(self):
        """Test BusinessRuleViolationError."""
        exc = BusinessRuleViolationError("Budget exceeded", rule_code="BUDGET_LIMIT")
        assert exc.status_code == 422
        assert exc.error_code == "BUSINESS_RULE_VIOLATION"
        assert exc.details["rule_code"] == "BUDGET_LIMIT"
    
    def test_allocation_conflict_error(self):
        """Test AllocationConflictError."""
        resource_id = uuid4()
        exc = AllocationConflictError(resource_id, "2024-01-15", 120.0)
        assert exc.status_code == 422
        assert "resource_id" in exc.details
        assert exc.details["total_allocation"] == 120.0
        assert exc.details["max_allocation"] == 100.0
    
    def test_resource_not_found_error(self):
        """Test ResourceNotFoundError."""
        resource_id = uuid4()
        exc = ResourceNotFoundError("Program", resource_id=resource_id)
        assert exc.status_code == 404
        assert exc.error_code == "RESOURCE_NOT_FOUND"
        assert "Program" in exc.message
        assert str(resource_id) in exc.message
    
    def test_project_not_found_error(self):
        """Test ProjectNotFoundError."""
        project_id = uuid4()
        exc = ProjectNotFoundError(project_id)
        assert exc.status_code == 404
        assert "Project" in exc.message
        assert str(project_id) in exc.message
    
    def test_worker_not_found_error_by_id(self):
        """Test WorkerNotFoundError with ID."""
        worker_id = uuid4()
        exc = WorkerNotFoundError(worker_id=worker_id)
        assert exc.status_code == 404
        assert "Worker" in exc.message
    
    def test_worker_not_found_error_by_external_id(self):
        """Test WorkerNotFoundError with external ID."""
        exc = WorkerNotFoundError(external_id="EMP001")
        assert exc.status_code == 404
        assert "EMP001" in exc.message
    
    def test_import_error(self):
        """Test ImportError."""
        row_errors = [{"row": 1, "error": "Invalid data"}]
        exc = ImportException("Import failed", row_errors=row_errors)
        assert exc.status_code == 422
        assert exc.error_code == "IMPORT_ERROR"
        assert "row_errors" in exc.details


class TestExceptionInheritance:
    """Test exception inheritance hierarchy."""
    
    def test_authentication_error_is_app_exception(self):
        """Test AuthenticationError inherits from AppException."""
        exc = AuthenticationError()
        assert isinstance(exc, AppException)
        assert isinstance(exc, Exception)
    
    def test_authorization_error_is_app_exception(self):
        """Test AuthorizationError inherits from AppException."""
        exc = AuthorizationError()
        assert isinstance(exc, AppException)
    
    def test_scope_access_denied_is_authorization_error(self):
        """Test ScopeAccessDeniedError inherits from AuthorizationError."""
        exc = ScopeAccessDeniedError("Program", uuid4())
        assert isinstance(exc, AuthorizationError)
        assert isinstance(exc, AppException)
    
    def test_validation_error_is_app_exception(self):
        """Test ValidationError inherits from AppException."""
        exc = ValidationError()
        assert isinstance(exc, AppException)
    
    def test_business_rule_violation_is_app_exception(self):
        """Test BusinessRuleViolationError inherits from AppException."""
        exc = BusinessRuleViolationError("Test")
        assert isinstance(exc, AppException)
    
    def test_resource_not_found_is_app_exception(self):
        """Test ResourceNotFoundError inherits from AppException."""
        exc = ResourceNotFoundError("Test")
        assert isinstance(exc, AppException)



class TestConflictErrorLogging:
    """Test conflict error logging functionality."""
    
    def test_conflict_error_log_contains_entity_type(self):
        """Test that conflict log contains entity type."""
        from unittest.mock import patch, MagicMock, AsyncMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        portfolio_id = uuid4()
        current_state = {
            "id": str(portfolio_id),
            "name": "Test Portfolio",
            "version": 2
        }
        
        conflict_error = ConflictError(
            entity_type="portfolio",
            entity_id=str(portfolio_id),
            current_state=current_state
        )
        
        # Mock request
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/portfolios/{portfolio_id}"
        mock_request.method = "PUT"
        mock_request.state.user_id = uuid4()
        
        # Mock logger
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            # Verify logger was called
            assert mock_logger.warning.called
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify entity_type is in log
            assert "entity_type" in log_extra
            assert log_extra["entity_type"] == "portfolio"
    
    def test_conflict_error_log_contains_entity_id(self):
        """Test that conflict log contains entity ID."""
        from unittest.mock import patch, MagicMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        project_id = uuid4()
        current_state = {
            "id": str(project_id),
            "name": "Test Project",
            "version": 3
        }
        
        conflict_error = ConflictError(
            entity_type="project",
            entity_id=str(project_id),
            current_state=current_state
        )
        
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/projects/{project_id}"
        mock_request.method = "PUT"
        mock_request.state.user_id = uuid4()
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify entity_id is in log
            assert "entity_id" in log_extra
            assert log_extra["entity_id"] == str(project_id)
    
    def test_conflict_error_log_contains_actual_version(self):
        """Test that conflict log contains actual version number."""
        from unittest.mock import patch, MagicMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        resource_id = uuid4()
        actual_version = 5
        current_state = {
            "id": str(resource_id),
            "name": "Test Resource",
            "version": actual_version
        }
        
        conflict_error = ConflictError(
            entity_type="resource",
            entity_id=str(resource_id),
            current_state=current_state
        )
        
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/resources/{resource_id}"
        mock_request.method = "PUT"
        mock_request.state.user_id = uuid4()
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify actual_version is in log
            assert "actual_version" in log_extra
            assert log_extra["actual_version"] == actual_version
    
    def test_conflict_error_log_contains_user_id(self):
        """Test that conflict log contains user ID."""
        from unittest.mock import patch, MagicMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        program_id = uuid4()
        user_id = uuid4()
        current_state = {
            "id": str(program_id),
            "name": "Test Program",
            "version": 2
        }
        
        conflict_error = ConflictError(
            entity_type="program",
            entity_id=str(program_id),
            current_state=current_state
        )
        
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/programs/{program_id}"
        mock_request.method = "PUT"
        mock_request.state.user_id = user_id
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify user_id is in log
            assert "user_id" in log_extra
            assert log_extra["user_id"] == str(user_id)
    
    def test_conflict_error_log_excludes_sensitive_data(self):
        """Test that conflict log does not contain sensitive data."""
        from unittest.mock import patch, MagicMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        portfolio_id = uuid4()
        current_state = {
            "id": str(portfolio_id),
            "name": "Test Portfolio",
            "version": 2,
            "description": "Sensitive description",
            "owner": "Sensitive owner name",
            "budget": 1000000,
            "internal_notes": "Confidential notes"
        }
        
        conflict_error = ConflictError(
            entity_type="portfolio",
            entity_id=str(portfolio_id),
            current_state=current_state
        )
        
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/portfolios/{portfolio_id}"
        mock_request.method = "PUT"
        mock_request.state.user_id = uuid4()
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify sensitive fields are NOT in log extra
            assert "description" not in log_extra
            assert "owner" not in log_extra
            assert "budget" not in log_extra
            assert "internal_notes" not in log_extra
            
            # Verify only required fields are present
            assert "entity_type" in log_extra
            assert "entity_id" in log_extra
            assert "actual_version" in log_extra
            assert "user_id" in log_extra
            assert "request_id" in log_extra
            assert "path" in log_extra
            assert "method" in log_extra
    
    def test_conflict_error_log_handles_missing_user_id(self):
        """Test that conflict log handles missing user ID gracefully."""
        from unittest.mock import patch, MagicMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        resource_id = uuid4()
        current_state = {
            "id": str(resource_id),
            "name": "Test Resource",
            "version": 1
        }
        
        conflict_error = ConflictError(
            entity_type="resource",
            entity_id=str(resource_id),
            current_state=current_state
        )
        
        # Mock request without user_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/resources/{resource_id}"
        mock_request.method = "PUT"
        mock_request.state = MagicMock()
        # Simulate missing user_id attribute
        type(mock_request.state).user_id = property(lambda self: None)
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            log_extra = mock_logger.warning.call_args[1].get('extra', {})
            
            # Verify user_id is present but None
            assert "user_id" in log_extra
            assert log_extra["user_id"] is None
    
    def test_conflict_error_log_message_format(self):
        """Test that conflict log message has proper format."""
        from unittest.mock import patch, MagicMock
        from app.core.exceptions import ConflictError
        from app.core.error_handlers import conflict_error_handler
        from fastapi import Request
        import asyncio
        
        project_id = uuid4()
        current_state = {
            "id": str(project_id),
            "name": "Test Project",
            "version": 4
        }
        
        conflict_error = ConflictError(
            entity_type="project",
            entity_id=str(project_id),
            current_state=current_state
        )
        
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = f"/api/v1/projects/{project_id}"
        mock_request.method = "PUT"
        mock_request.state.user_id = uuid4()
        
        with patch('app.core.error_handlers.logger') as mock_logger:
            asyncio.run(conflict_error_handler(mock_request, conflict_error))
            
            # Get log message
            log_message = mock_logger.warning.call_args[0][0]
            
            # Verify message contains key information
            assert "conflict" in log_message.lower()
            assert "project" in log_message.lower()
            assert str(project_id) in log_message
