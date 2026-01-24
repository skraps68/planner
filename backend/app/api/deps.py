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
        HTTPException: If authentication fails
    """
    from app.services.authentication import authentication_service
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode token
        token = credentials.credentials
        user = authentication_service.get_user_from_token(db, token)
        
        if user is None:
            raise credentials_exception
        
        return user
        
    except Exception:
        raise credentials_exception


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
        HTTPException: If user is not active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
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
        HTTPException: If user is not admin
    """
    from app.services.authorization import authorization_service
    
    if not authorization_service.is_admin(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required"
        )
    
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required permissions: {', '.join(p.value for p in permissions)}"
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required permissions: {', '.join(p.value for p in permissions)}"
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
        HTTPException: If user doesn't have access
    """
    from uuid import UUID
    from app.services.scope_validator import scope_validator_service
    
    try:
        program_uuid = UUID(program_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid program ID format"
        )
    
    if not scope_validator_service.can_access_program(db, current_user.id, program_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this program"
        )
    
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
        HTTPException: If user doesn't have access
    """
    from uuid import UUID
    from app.services.scope_validator import scope_validator_service
    
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID format"
        )
    
    if not scope_validator_service.can_access_project(db, current_user.id, project_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )
    
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
