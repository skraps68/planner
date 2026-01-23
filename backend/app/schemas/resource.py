"""
Resource-related Pydantic schemas.
"""
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.models.resource import ResourceType
from .base import BaseSchema, TimestampMixin, PaginatedResponse


class ResourceBase(BaseSchema):
    """Base resource schema with common fields."""
    
    name: str = Field(min_length=1, max_length=255, description="Resource name")
    resource_type: ResourceType = Field(description="Resource type (labor or non_labor)")
    description: Optional[str] = Field(default=None, max_length=1000, description="Resource description")


class ResourceCreate(ResourceBase):
    """Schema for creating a new resource."""
    pass


class ResourceUpdate(BaseSchema):
    """Schema for updating an existing resource."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Resource name")
    resource_type: Optional[ResourceType] = Field(default=None, description="Resource type (labor or non_labor)")
    description: Optional[str] = Field(default=None, max_length=1000, description="Resource description")


class ResourceResponse(ResourceBase, TimestampMixin):
    """Schema for resource response."""
    
    assignment_count: Optional[int] = Field(default=0, description="Number of assignments for this resource")


class ResourceListResponse(PaginatedResponse[ResourceResponse]):
    """Schema for paginated resource list response."""
    pass


class WorkerTypeBase(BaseSchema):
    """Base worker type schema with common fields."""
    
    type: str = Field(min_length=1, max_length=100, description="Worker type name")
    description: str = Field(min_length=1, max_length=1000, description="Worker type description")


class WorkerTypeCreate(WorkerTypeBase):
    """Schema for creating a new worker type."""
    pass


class WorkerTypeUpdate(BaseSchema):
    """Schema for updating an existing worker type."""
    
    type: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Worker type name")
    description: Optional[str] = Field(default=None, min_length=1, max_length=1000, description="Worker type description")


class WorkerTypeResponse(WorkerTypeBase, TimestampMixin):
    """Schema for worker type response."""
    
    worker_count: Optional[int] = Field(default=0, description="Number of workers of this type")
    current_rate: Optional[str] = Field(default=None, description="Current rate for this worker type")


class WorkerBase(BaseSchema):
    """Base worker schema with common fields."""
    
    worker_type_id: UUID = Field(description="Worker type ID")
    external_id: str = Field(min_length=1, max_length=100, description="External worker ID")
    name: str = Field(min_length=1, max_length=255, description="Worker name")


class WorkerCreate(WorkerBase):
    """Schema for creating a new worker."""
    pass


class WorkerUpdate(BaseSchema):
    """Schema for updating an existing worker."""
    
    worker_type_id: Optional[UUID] = Field(default=None, description="Worker type ID")
    external_id: Optional[str] = Field(default=None, min_length=1, max_length=100, description="External worker ID")
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Worker name")


class WorkerResponse(WorkerBase, TimestampMixin):
    """Schema for worker response."""
    
    worker_type_name: Optional[str] = Field(default=None, description="Worker type name")
    current_rate: Optional[str] = Field(default=None, description="Current rate for this worker")


class WorkerListResponse(PaginatedResponse[WorkerResponse]):
    """Schema for paginated worker list response."""
    pass


class ResourceSummary(BaseSchema):
    """Summary schema for resource with basic info."""
    
    id: UUID
    name: str
    resource_type: ResourceType


class WorkerSummary(BaseSchema):
    """Summary schema for worker with basic info."""
    
    id: UUID
    external_id: str
    name: str
    worker_type_id: UUID
    worker_type_name: str