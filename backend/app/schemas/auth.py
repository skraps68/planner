"""
Authentication-related Pydantic schemas.
"""
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.user import RoleType, ScopeType
from .base import BaseSchema


class LoginRequest(BaseSchema):
    """Schema for login request."""
    
    username: str = Field(min_length=1, description="Username or email")
    password: str = Field(min_length=1, description="Password")


class TokenData(BaseSchema):
    """Schema for token data."""
    
    access_token: str = Field(description="JWT access token")
    refresh_token: str = Field(description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(description="Token expiration time in seconds")


class UserScope(BaseSchema):
    """Schema for user scope information."""
    
    scope_type: ScopeType = Field(description="Scope type")
    scope_id: Optional[UUID] = Field(default=None, description="Scope ID (program or project)")
    scope_name: Optional[str] = Field(default=None, description="Scope name")


class LoginResponse(BaseSchema):
    """Schema for login response."""
    
    user_id: UUID = Field(description="User ID")
    username: str = Field(description="Username")
    email: str = Field(description="Email address")
    is_active: bool = Field(description="Whether the user is active")
    active_roles: List[RoleType] = Field(description="Currently active roles")
    available_scopes: List[UserScope] = Field(description="Available scopes for the user")
    tokens: TokenData = Field(description="Authentication tokens")


class TokenRefreshRequest(BaseSchema):
    """Schema for token refresh request."""
    
    refresh_token: str = Field(description="Refresh token")


class TokenRefreshResponse(BaseSchema):
    """Schema for token refresh response."""
    
    tokens: TokenData = Field(description="New authentication tokens")


class PasswordChangeRequest(BaseSchema):
    """Schema for password change request."""
    
    current_password: str = Field(min_length=1, description="Current password")
    new_password: str = Field(min_length=8, max_length=255, description="New password")


class RoleSwitchRequest(BaseSchema):
    """Schema for role switching request."""
    
    role_type: RoleType = Field(description="Role to switch to")
    scope_type: Optional[ScopeType] = Field(default=None, description="Scope type for the role")
    scope_id: Optional[UUID] = Field(default=None, description="Scope ID (program or project)")


class RoleSwitchResponse(BaseSchema):
    """Schema for role switching response."""
    
    active_role: RoleType = Field(description="Currently active role")
    current_scope: Optional[UserScope] = Field(default=None, description="Currently selected scope")
    available_scopes: List[UserScope] = Field(description="Available scopes for the role")
    tokens: TokenData = Field(description="Updated authentication tokens")


class LogoutRequest(BaseSchema):
    """Schema for logout request."""
    
    refresh_token: Optional[str] = Field(default=None, description="Refresh token to invalidate")


class ForgotPasswordRequest(BaseSchema):
    """Schema for forgot password request."""
    
    email: EmailStr = Field(description="Email address")


class ResetPasswordRequest(BaseSchema):
    """Schema for reset password request."""
    
    token: str = Field(description="Password reset token")
    new_password: str = Field(min_length=8, max_length=255, description="New password")


class VerifyTokenResponse(BaseSchema):
    """Schema for token verification response."""
    
    valid: bool = Field(description="Whether the token is valid")
    user_id: Optional[UUID] = Field(default=None, description="User ID if token is valid")
    username: Optional[str] = Field(default=None, description="Username if token is valid")
    active_roles: Optional[List[RoleType]] = Field(default=None, description="Active roles if token is valid")
    expires_at: Optional[str] = Field(default=None, description="Token expiration time")