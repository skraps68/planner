"""
Audit-related Pydantic schemas.
"""
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import Field

from .base import BaseSchema, TimestampMixin, PaginatedResponse


class AuditLogResponse(TimestampMixin):
    """Schema for audit log response."""
    
    user_id: UUID = Field(description="User ID who performed the action")
    username: Optional[str] = Field(default=None, description="Username who performed the action")
    entity_type: str = Field(description="Type of entity that was modified")
    entity_id: UUID = Field(description="ID of the entity that was modified")
    operation: str = Field(description="Operation performed (CREATE, UPDATE, DELETE)")
    before_values: Optional[Dict[str, Any]] = Field(default=None, description="Values before the change")
    after_values: Optional[Dict[str, Any]] = Field(default=None, description="Values after the change")


class AuditLogListResponse(PaginatedResponse[AuditLogResponse]):
    """Schema for paginated audit log list response."""
    pass


class AuditLogFilters(BaseSchema):
    """Schema for audit log filtering parameters."""
    
    user_id: Optional[UUID] = Field(default=None, description="Filter by user ID")
    entity_type: Optional[str] = Field(default=None, description="Filter by entity type")
    entity_id: Optional[UUID] = Field(default=None, description="Filter by entity ID")
    operation: Optional[str] = Field(default=None, description="Filter by operation type")
    start_date: Optional[str] = Field(default=None, description="Filter by start date (ISO format)")
    end_date: Optional[str] = Field(default=None, description="Filter by end date (ISO format)")


class EntityChangesSummary(BaseSchema):
    """Schema for entity changes summary."""
    
    entity_type: str = Field(description="Type of entity")
    entity_id: UUID = Field(description="ID of the entity")
    total_changes: int = Field(description="Total number of changes")
    first_change: str = Field(description="Date of first change")
    last_change: str = Field(description="Date of last change")
    operations: Dict[str, int] = Field(description="Count of each operation type")


class UserActivitySummary(BaseSchema):
    """Schema for user activity summary."""
    
    user_id: UUID = Field(description="User ID")
    username: str = Field(description="Username")
    total_actions: int = Field(description="Total number of actions")
    first_action: str = Field(description="Date of first action")
    last_action: str = Field(description="Date of last action")
    operations: Dict[str, int] = Field(description="Count of each operation type")
    entities_modified: Dict[str, int] = Field(description="Count of entities modified by type")