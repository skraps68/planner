"""
API dependencies for authentication and database sessions.
"""
from typing import Generator, List
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User
from app.services.authorization import Permission
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ScopeAccessDeniedError,
    InvalidUUIDError,
)
from app.core.validators import input_validator

# Security scheme for JWT tokens
security = HTTPBearer()


def get_db() -> Generator:
    """
    Dependency for getting database session.
    
    Yields:
        Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency for getting current authenticated user.
    
    Args:
        credentials: JWT token from Authorization header
        db: Database session
        
    Returns:
        Current authenticated user
        
    Raises:
        AuthenticationError: If authentication fails
    """
    from app.services.authentication import authentication_service
    
    try:
        # Decode token
        token = credentials.credentials
        user = authentication_service.get_user_from_token(db, token)
        
        if user is None:
            raise AuthenticationError("Could not validate credentials")
        
        return user
        
    except AuthenticationError:
        raise
    except Exception:
        raise AuthenticationError("Could not validate credentials")


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency for getting current active user.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current active user
        
    Raises:
        AuthorizationError: If user is not active
    """
    if not current_user.is_active:
        raise AuthorizationError("User account is inactive")
    return current_user


def check_admin_permission(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency for checking admin permissions.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Current user if admin
        
    Raises:
        AuthorizationError: If user is not admin
    """
    from app.services.authorization import authorization_service
    
    if not authorization_service.is_admin(db, current_user.id):
        raise AuthorizationError("Admin permission required")
    
    return current_user


def check_permission(*permissions: Permission):
    """
    Dependency factory for checking specific permissions.
    
    Usage:
        @router.get("/programs")
        async def list_programs(
            current_user: User = Depends(check_permission(Permission.READ_PROGRAM))
        ):
            ...
    
    Args:
        *permissions: Required permissions (user needs at least one)
        
    Returns:
        Dependency function that checks permissions
    """
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        from app.services.authorization import authorization_service
        
        if not authorization_service.has_any_permission(
            db, current_user.id, list(permissions)
        ):
            raise AuthorizationError(
                f"Required permissions: {', '.join(p.value for p in permissions)}",
                required_permissions=[p.value for p in permissions]
            )
        
        return current_user
    
    return permission_checker


def check_all_permissions(*permissions: Permission):
    """
    Dependency factory for checking that user has ALL specified permissions.
    
    Usage:
        @router.post("/programs")
        async def create_program(
            current_user: User = Depends(check_all_permissions(
                Permission.CREATE_PROGRAM,
                Permission.UPDATE_BUDGET
            ))
        ):
            ...
    
    Args:
        *permissions: Required permissions (user needs all of them)
        
    Returns:
        Dependency function that checks permissions
    """
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        from app.services.authorization import authorization_service
        
        if not authorization_service.has_all_permissions(
            db, current_user.id, list(permissions)
        ):
            raise AuthorizationError(
                f"Required permissions: {', '.join(p.value for p in permissions)}",
                required_permissions=[p.value for p in permissions]
            )
        
        return current_user
    
    return permission_checker


def check_program_access(
    program_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency for checking program-level access.
    
    Args:
        program_id: Program ID to check access for
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Current user if has access
        
    Raises:
        InvalidUUIDError: If program ID format is invalid
        ScopeAccessDeniedError: If user doesn't have access
    """
    from app.services.scope_validator import scope_validator_service
    
    # Validate UUID format
    program_uuid = input_validator.validate_uuid(program_id, "program_id")
    
    # Check scope access
    if not scope_validator_service.can_access_program(db, current_user.id, program_uuid):
        raise ScopeAccessDeniedError("Program", program_uuid)
    
    return current_user


def check_project_access(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency for checking project-level access.
    
    Args:
        project_id: Project ID to check access for
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Current user if has access
        
    Raises:
        InvalidUUIDError: If project ID format is invalid
        ScopeAccessDeniedError: If user doesn't have access
    """
    from app.services.scope_validator import scope_validator_service
    
    # Validate UUID format
    project_uuid = input_validator.validate_uuid(project_id, "project_id")
    
    # Check scope access
    if not scope_validator_service.can_access_project(db, current_user.id, project_uuid):
        raise ScopeAccessDeniedError("Project", project_uuid)
    
    return current_user


def get_accessible_programs(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[UUID]:
    """
    Dependency for getting list of accessible program IDs for current user.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of accessible program IDs
    """
    from app.services.scope_validator import scope_validator_service
    
    return scope_validator_service.get_user_accessible_programs(db, current_user.id)


def get_accessible_projects(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[UUID]:
    """
    Dependency for getting list of accessible project IDs for current user.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of accessible project IDs
    """
    from app.services.scope_validator import scope_validator_service
    
    return scope_validator_service.get_user_accessible_projects(db, current_user.id)
