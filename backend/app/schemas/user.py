"""
User-related Pydantic schemas.
"""
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.user import RoleType, ScopeType
from .base import BaseSchema, TimestampMixin, PaginatedResponse


class UserBase(BaseSchema):
    """Base user schema with common fields."""
    
    username: str = Field(min_length=1, max_length=100, description="Username")
    email: EmailStr = Field(description="Email address")
    is_active: bool = Field(default=True, description="Whether the user is active")


class UserCreate(UserBase):
    """Schema for creating a new user."""
    
    password: str = Field(min_length=8, max_length=255, description="Password")


class UserUpdate(BaseSchema):
    """Schema for updating an existing user."""
    
    username: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Username")
    email: Optional[EmailStr] = Field(default=None, description="Email address")
    is_active: Optional[bool] = Field(default=None, description="Whether the user is active")


class UserRoleBase(BaseSchema):
    """Base user role schema with common fields."""
    
    user_id: UUID = Field(description="User ID")
    role_type: RoleType = Field(description="Role type")
    is_active: bool = Field(default=True, description="Whether the role is active")


class UserRoleCreate(UserRoleBase):
    """Schema for creating a new user role."""
    pass


class UserRoleUpdate(BaseSchema):
    """Schema for updating an existing user role."""
    
    role_type: Optional[RoleType] = Field(default=None, description="Role type")
    is_active: Optional[bool] = Field(default=None, description="Whether the role is active")


class ScopeAssignmentBase(BaseSchema):
    """Base scope assignment schema with common fields."""
    
    user_role_id: UUID = Field(description="User role ID")
    scope_type: ScopeType = Field(description="Scope type")
    program_id: Optional[UUID] = Field(default=None, description="Program ID (for program scope)")
    project_id: Optional[UUID] = Field(default=None, description="Project ID (for project scope)")
    is_active: bool = Field(default=True, description="Whether the scope assignment is active")


class ScopeAssignmentCreate(ScopeAssignmentBase):
    """Schema for creating a new scope assignment."""
    pass


class ScopeAssignmentUpdate(BaseSchema):
    """Schema for updating an existing scope assignment."""
    
    scope_type: Optional[ScopeType] = Field(default=None, description="Scope type")
    program_id: Optional[UUID] = Field(default=None, description="Program ID (for program scope)")
    project_id: Optional[UUID] = Field(default=None, description="Project ID (for project scope)")
    is_active: Optional[bool] = Field(default=None, description="Whether the scope assignment is active")


class ScopeAssignmentResponse(ScopeAssignmentBase, TimestampMixin):
    """Schema for scope assignment response."""
    
    program_name: Optional[str] = Field(default=None, description="Program name")
    project_name: Optional[str] = Field(default=None, description="Project name")


class UserRoleResponse(UserRoleBase, TimestampMixin):
    """Schema for user role response."""
    
    scope_assignments: Optional[List[ScopeAssignmentResponse]] = Field(default=None, description="Scope assignments")


class UserResponse(UserBase, TimestampMixin):
    """Schema for user response."""
    
    user_roles: Optional[List[UserRoleResponse]] = Field(default=None, description="User roles")


class UserListResponse(PaginatedResponse[UserResponse]):
    """Schema for paginated user list response."""
    pass


class UserSummary(BaseSchema):
    """Summary schema for user with basic info."""
    
    id: UUID
    username: str
    email: str
    is_active: bool


class CurrentUserResponse(BaseSchema):
    """Schema for current user information."""
    
    id: UUID
    username: str
    email: str
    is_active: bool
    active_roles: List[RoleType] = Field(description="Currently active roles")
    available_scopes: List[dict] = Field(description="Available scopes for the user")
    current_scope: Optional[dict] = Field(default=None, description="Currently selected scope")