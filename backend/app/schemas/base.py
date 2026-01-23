"""
Base Pydantic schemas with common patterns.
"""
from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    """Base schema with common configuration."""
    
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
        str_strip_whitespace=True,
    )


class TimestampMixin(BaseSchema):
    """Mixin for models with timestamps."""
    
    id: UUID
    created_at: datetime
    updated_at: datetime


class PaginationParams(BaseSchema):
    """Pagination parameters for list endpoints."""
    
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    size: int = Field(default=20, ge=1, le=100, description="Items per page")
    sort_by: Optional[str] = Field(default=None, description="Field to sort by")
    sort_order: Optional[str] = Field(default="asc", pattern="^(asc|desc)$", description="Sort order")


T = TypeVar('T')


class PaginatedResponse(BaseSchema, Generic[T]):
    """Generic paginated response."""
    
    items: List[T]
    total: int = Field(description="Total number of items")
    page: int = Field(description="Current page number")
    size: int = Field(description="Items per page")
    pages: int = Field(description="Total number of pages")
    has_next: bool = Field(description="Whether there are more pages")
    has_prev: bool = Field(description="Whether there are previous pages")


class ErrorDetail(BaseSchema):
    """Error detail schema."""
    
    field: Optional[str] = Field(default=None, description="Field that caused the error")
    message: str = Field(description="Error message")
    code: Optional[str] = Field(default=None, description="Error code")


class ErrorResponse(BaseSchema):
    """Standard error response schema."""
    
    success: bool = Field(default=False, description="Success status")
    message: str = Field(description="Error message")
    details: Optional[List[ErrorDetail]] = Field(default=None, description="Detailed error information")
    request_id: Optional[str] = Field(default=None, description="Request ID for tracking")


class SuccessResponse(BaseSchema):
    """Standard success response schema."""
    
    success: bool = Field(default=True, description="Success status")
    message: str = Field(description="Success message")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Additional response data")


class FilterParams(BaseSchema):
    """Base filter parameters."""
    
    search: Optional[str] = Field(default=None, description="Search term")
    is_active: Optional[bool] = Field(default=None, description="Filter by active status")


class DateRangeFilter(BaseSchema):
    """Date range filter parameters."""
    
    start_date: Optional[datetime] = Field(default=None, description="Start date for filtering")
    end_date: Optional[datetime] = Field(default=None, description="End date for filtering")


class ScopeFilter(BaseSchema):
    """Scope-based filter parameters."""
    
    program_ids: Optional[List[UUID]] = Field(default=None, description="Filter by program IDs")
    project_ids: Optional[List[UUID]] = Field(default=None, description="Filter by project IDs")