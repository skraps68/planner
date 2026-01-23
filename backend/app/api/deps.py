"""
API dependencies for authentication and database sessions.
"""
from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User

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
    # TODO: Implement JWT token validation and user retrieval
    # For now, this is a placeholder that will be implemented with authentication service
    
    # This will be replaced with actual JWT validation:
    # from app.services.authentication import authentication_service
    # try:
    #     token_data = authentication_service.verify_token(credentials.credentials)
    #     user = authentication_service.get_user_by_id(db, token_data.user_id)
    #     if not user or not user.is_active:
    #         raise HTTPException(
    #             status_code=status.HTTP_401_UNAUTHORIZED,
    #             detail="User not found or inactive"
    #         )
    #     return user
    # except Exception as e:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Could not validate credentials"
    #     )
    
    # Placeholder: Return a mock user for development
    # This should be removed once authentication is implemented
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Authentication not yet implemented. This endpoint requires authentication."
    )


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
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency for checking admin permissions.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current user if admin
        
    Raises:
        HTTPException: If user is not admin
    """
    # TODO: Implement role checking with authorization service
    # from app.models.user import RoleType
    # from app.services.authorization import authorization_service
    # 
    # if not authorization_service.has_role(current_user, RoleType.ADMIN):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin permission required"
    #     )
    
    return current_user


def check_program_access(
    program_id: str,
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency for checking program-level access.
    
    Args:
        program_id: Program ID to check access for
        current_user: Current authenticated user
        
    Returns:
        Current user if has access
        
    Raises:
        HTTPException: If user doesn't have access
    """
    # TODO: Implement scope-based access checking
    # from app.services.scope_validator import scope_validator_service
    # 
    # if not scope_validator_service.has_program_access(current_user, program_id):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied to this program"
    #     )
    
    return current_user


def check_project_access(
    project_id: str,
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency for checking project-level access.
    
    Args:
        project_id: Project ID to check access for
        current_user: Current authenticated user
        
    Returns:
        Current user if has access
        
    Raises:
        HTTPException: If user doesn't have access
    """
    # TODO: Implement scope-based access checking
    # from app.services.scope_validator import scope_validator_service
    # 
    # if not scope_validator_service.has_project_access(current_user, project_id):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied to this project"
    #     )
    
    return current_user