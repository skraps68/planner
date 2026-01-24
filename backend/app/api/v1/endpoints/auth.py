"""
Authentication API endpoints for login, logout, token refresh, and role switching.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user
from app.models.user import User, RoleType, ScopeType
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    PasswordChangeRequest,
    RoleSwitchRequest,
    RoleSwitchResponse,
    LogoutRequest,
    TokenData,
    UserScope
)
from app.services.authentication import authentication_service
from app.services.authorization import authorization_service
from app.services.role_management import role_management_service
from app.services.scope_validator import scope_validator_service
from app.core.config import settings

router = APIRouter()


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login endpoint - authenticate user and return tokens.
    
    Args:
        request: Login credentials
        db: Database session
        
    Returns:
        Login response with user info and tokens
        
    Raises:
        HTTPException: If authentication fails
    """
    # Authenticate user
    user = authentication_service.authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user roles
    user_roles = role_management_service.get_user_roles(db, user.id, active_only=True)
    active_roles = [role.role_type for role in user_roles]
    
    if not active_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no active roles"
        )
    
    # Get available scopes
    scope_summary = scope_validator_service.get_scope_summary(db, user.id)
    available_scopes = []
    
    for scope_info in scope_summary.get("scopes", []):
        user_scope = UserScope(
            scope_type=ScopeType(scope_info["scope_type"]),
            scope_id=UUID(scope_info["scope_id"]) if scope_info.get("scope_id") else None,
            scope_name=scope_info.get("scope_name")
        )
        available_scopes.append(user_scope)
    
    # Create tokens
    access_token = authentication_service.create_access_token(
        data={"sub": str(user.id), "username": user.username}
    )
    refresh_token = authentication_service.create_refresh_token(
        data={"sub": str(user.id), "username": user.username}
    )
    
    tokens = TokenData(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return LoginResponse(
        user_id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        active_roles=active_roles,
        available_scopes=available_scopes,
        tokens=tokens
    )


@router.post("/refresh", response_model=TokenRefreshResponse, status_code=status.HTTP_200_OK)
def refresh_token(
    request: TokenRefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    
    Args:
        request: Refresh token request
        db: Database session
        
    Returns:
        New access token
        
    Raises:
        HTTPException: If refresh token is invalid
    """
    result = authentication_service.refresh_access_token(db, request.refresh_token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = TokenData(
        access_token=result["access_token"],
        refresh_token=request.refresh_token,  # Keep the same refresh token
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return TokenRefreshResponse(tokens=tokens)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: LogoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Logout endpoint - invalidate refresh token.
    
    Note: In a production system, this would add the refresh token to a blacklist.
    For now, it's a placeholder that acknowledges the logout request.
    
    Args:
        request: Logout request with optional refresh token
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    # TODO: Implement token blacklisting in Redis
    # if request.refresh_token:
    #     # Add refresh token to blacklist
    #     pass
    
    return {"message": "Successfully logged out"}


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change user password.
    
    Args:
        request: Password change request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If current password is incorrect
    """
    success = authentication_service.change_password(
        db,
        current_user.id,
        request.current_password,
        request.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    return {"message": "Password changed successfully"}


@router.post("/switch-role", response_model=RoleSwitchResponse, status_code=status.HTTP_200_OK)
def switch_role(
    request: RoleSwitchRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Switch active role for multi-role users.
    
    Args:
        request: Role switch request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Updated role and scope information with new tokens
        
    Raises:
        HTTPException: If user doesn't have the requested role
    """
    # Verify user has the requested role
    has_role = role_management_service.switch_active_role(
        db, current_user.id, request.role_type
    )
    
    if not has_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User does not have role: {request.role_type.value}"
        )
    
    # Get available scopes for the role
    user_roles = role_management_service.get_user_roles(db, current_user.id, active_only=True)
    target_role = next((r for r in user_roles if r.role_type == request.role_type), None)
    
    if not target_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role not found: {request.role_type.value}"
        )
    
    # Get scopes for this role
    role_scopes = role_management_service.get_role_scopes(db, target_role.id, active_only=True)
    available_scopes = []
    current_scope = None
    
    for scope in role_scopes:
        scope_name = None
        scope_id = None
        
        if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
            # Get program name
            from app.repositories.program import program_repository
            program = program_repository.get(db, scope.program_id)
            scope_name = program.name if program else None
            scope_id = scope.program_id
        elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
            # Get project name
            from app.repositories.project import project_repository
            project = project_repository.get(db, scope.project_id)
            scope_name = project.name if project else None
            scope_id = scope.project_id
        
        user_scope = UserScope(
            scope_type=scope.scope_type,
            scope_id=scope_id,
            scope_name=scope_name
        )
        available_scopes.append(user_scope)
        
        # Set current scope if it matches the request
        if request.scope_type and request.scope_id:
            if scope.scope_type == request.scope_type and (
                (scope.scope_type == ScopeType.PROGRAM and scope.program_id == request.scope_id) or
                (scope.scope_type == ScopeType.PROJECT and scope.project_id == request.scope_id)
            ):
                current_scope = user_scope
    
    # Create new tokens with role information
    access_token = authentication_service.create_access_token(
        data={
            "sub": str(current_user.id),
            "username": current_user.username,
            "role": request.role_type.value
        }
    )
    refresh_token = authentication_service.create_refresh_token(
        data={
            "sub": str(current_user.id),
            "username": current_user.username,
            "role": request.role_type.value
        }
    )
    
    tokens = TokenData(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return RoleSwitchResponse(
        active_role=request.role_type,
        current_scope=current_scope,
        available_scopes=available_scopes,
        tokens=tokens
    )


@router.get("/me", status_code=status.HTTP_200_OK)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current user information including roles and scopes.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Current user information
    """
    # Get user roles
    user_roles = role_management_service.get_user_roles(db, current_user.id, active_only=True)
    active_roles = [role.role_type for role in user_roles]
    
    # Get scope summary
    scope_summary = scope_validator_service.get_scope_summary(db, current_user.id)
    
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "active_roles": active_roles,
        "scope_summary": scope_summary
    }
