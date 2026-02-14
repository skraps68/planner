"""
Unit tests for optimistic locking error handling.

Tests the ConflictError exception and its usage in API endpoints.
Validates: Requirements 4.1, 4.2, 4.4, 4.5
"""
import pytest
from uuid import uuid4

from app.core.exceptions import ConflictError


def test_conflict_error_structure():
    """
    Test that ConflictError has the correct structure with all required fields.
    
    Validates: Requirements 4.1, 4.2, 4.4, 4.5
    """
    entity_type = "portfolio"
    entity_id = str(uuid4())
    current_state = {
        "id": entity_id,
        "name": "Test Portfolio",
        "version": 2,
        "description": "Test description"
    }
    
    error = ConflictError(entity_type, entity_id, current_state)
    
    # Check status code
    assert error.status_code == 409, "ConflictError should have status code 409"
    
    # Check error code
    assert error.error_code == "CONFLICT", "ConflictError should have error code 'CONFLICT'"
    
    # Check message
    assert error.message is not None, "ConflictError should have a message"
    assert len(error.message) > 0, "Message should not be empty"
    assert entity_type in error.message.lower(), "Message should mention entity type"
    
    # Check details structure
    assert error.details is not None, "ConflictError should have details"
    assert "error" in error.details, "Details should have 'error' field"
    assert error.details["error"] == "conflict", "Error field should be 'conflict'"
    
    assert "entity_type" in error.details, "Details should have 'entity_type' field"
    assert error.details["entity_type"] == entity_type, "Entity type should match"
    
    assert "entity_id" in error.details, "Details should have 'entity_id' field"
    assert error.details["entity_id"] == entity_id, "Entity ID should match"
    
    assert "current_state" in error.details, "Details should have 'current_state' field"
    assert error.details["current_state"] == current_state, "Current state should match"


def test_conflict_error_custom_message():
    """
    Test that ConflictError accepts a custom message.
    """
    entity_type = "program"
    entity_id = str(uuid4())
    current_state = {"id": entity_id, "version": 3}
    custom_message = "Custom conflict message"
    
    error = ConflictError(entity_type, entity_id, current_state, message=custom_message)
    
    assert error.message == custom_message, "Should use custom message when provided"


def test_conflict_error_default_message():
    """
    Test that ConflictError generates a default message when none is provided.
    """
    entity_type = "project"
    entity_id = str(uuid4())
    current_state = {"id": entity_id, "version": 1}
    
    error = ConflictError(entity_type, entity_id, current_state)
    
    # Default message should mention the entity type and suggest refreshing
    assert "project" in error.message.lower(), "Default message should mention entity type"
    assert "modified" in error.message.lower(), "Default message should mention modification"
    assert "refresh" in error.message.lower(), "Default message should suggest refreshing"


def test_conflict_error_current_state_included():
    """
    Test that the current state is included in the error details.
    
    Validates: Requirement 4.2 - Current state included in response
    """
    entity_type = "resource"
    entity_id = str(uuid4())
    current_state = {
        "id": entity_id,
        "name": "Updated Resource Name",
        "version": 5,
        "description": "Updated description",
        "resource_type": "WORKER"
    }
    
    error = ConflictError(entity_type, entity_id, current_state)
    
    # Verify all fields from current state are preserved
    returned_state = error.details["current_state"]
    assert returned_state["id"] == current_state["id"]
    assert returned_state["name"] == current_state["name"]
    assert returned_state["version"] == current_state["version"]
    assert returned_state["description"] == current_state["description"]
    assert returned_state["resource_type"] == current_state["resource_type"]


def test_conflict_error_message_clarity():
    """
    Test that the error message is user-friendly and clear.
    
    Validates: Requirement 4.5 - User-friendly error message
    """
    entity_type = "resource_assignment"
    entity_id = str(uuid4())
    current_state = {"id": entity_id, "version": 2}
    
    error = ConflictError(entity_type, entity_id, current_state)
    
    # Message should be clear and actionable
    message = error.message.lower()
    
    # Should explain what happened
    assert "modified" in message or "changed" in message, "Should explain the entity was modified"
    
    # Should suggest an action
    assert "refresh" in message or "reload" in message, "Should suggest refreshing"
    
    # Should not contain technical jargon
    assert "staledata" not in message, "Should not contain technical exception names"
    assert "version_id_col" not in message, "Should not contain SQLAlchemy internals"


def test_conflict_error_different_entity_types():
    """
    Test that ConflictError works correctly for all entity types.
    """
    entity_types = [
        "portfolio", "program", "project", "project_phase",
        "resource", "worker_type", "worker", "resource_assignment",
        "rate", "actual", "user", "user_role", "scope_assignment"
    ]
    
    for entity_type in entity_types:
        entity_id = str(uuid4())
        current_state = {"id": entity_id, "version": 1}
        
        error = ConflictError(entity_type, entity_id, current_state)
        
        assert error.status_code == 409
        assert error.details["entity_type"] == entity_type
        assert error.details["entity_id"] == entity_id
        assert entity_type in error.message.lower()


def test_conflict_error_response_format():
    """
    Test that ConflictError produces a consistent response format.
    
    Validates: Requirement 4.4 - Consistent JSON structure
    """
    entity_type = "portfolio"
    entity_id = str(uuid4())
    current_state = {
        "id": entity_id,
        "name": "Test",
        "version": 3
    }
    
    error = ConflictError(entity_type, entity_id, current_state)
    
    # The details dict should be suitable for JSON serialization
    details = error.details
    
    # All required fields present
    required_fields = ["error", "entity_type", "entity_id", "current_state"]
    for field in required_fields:
        assert field in details, f"Required field '{field}' missing from details"
    
    # All values should be JSON-serializable types
    assert isinstance(details["error"], str)
    assert isinstance(details["entity_type"], str)
    assert isinstance(details["entity_id"], str)
    assert isinstance(details["current_state"], dict)
