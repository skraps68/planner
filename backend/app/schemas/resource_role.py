"""
ResourceRole-related Pydantic schemas.
"""
from typing import Optional
from uuid import UUID

from pydantic import Field

from .base import BaseSchema, TimestampMixin, VersionedSchema


class ResourceRoleBase(BaseSchema):
    """Base resource role schema with common fields."""

    name: str = Field(min_length=1, max_length=100, description="Resource role name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Resource role description")


class ResourceRoleCreate(ResourceRoleBase):
    """Schema for creating a new resource role."""
    pass


class ResourceRoleUpdate(VersionedSchema):
    """Schema for updating an existing resource role."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Resource role name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Resource role description")


class ResourceRoleResponse(ResourceRoleBase, TimestampMixin, VersionedSchema):
    """Schema for resource role response."""

    id: UUID
    resource_count: Optional[int] = Field(default=0, description="Number of resources with this role")
