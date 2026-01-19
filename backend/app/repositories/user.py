"""
User, UserRole, and ScopeAssignment repositories for data access operations.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model operations."""
    
    def __init__(self):
        super().__init__(User)
    
    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        """Get user by username."""
        return db.query(User).filter(User.username == username).first()
    
    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        """Get user by email."""
        return db.query(User).filter(User.email == email).first()
    
    def get_active_users(self, db: Session) -> List[User]:
        """Get all active users."""
        return db.query(User).filter(User.is_active == True).all()
    
    def validate_username_unique(self, db: Session, username: str, exclude_id: Optional[UUID] = None) -> bool:
        """Validate that username is unique."""
        query = db.query(User).filter(User.username == username)
        if exclude_id:
            query = query.filter(User.id != exclude_id)
        return query.first() is None
    
    def validate_email_unique(self, db: Session, email: str, exclude_id: Optional[UUID] = None) -> bool:
        """Validate that email is unique."""
        query = db.query(User).filter(User.email == email)
        if exclude_id:
            query = query.filter(User.id != exclude_id)
        return query.first() is None


class UserRoleRepository(BaseRepository[UserRole]):
    """Repository for UserRole model operations."""
    
    def __init__(self):
        super().__init__(UserRole)
    
    def get_by_user(self, db: Session, user_id: UUID) -> List[UserRole]:
        """Get all roles for a user."""
        return db.query(UserRole).filter(UserRole.user_id == user_id).all()
    
    def get_active_roles_by_user(self, db: Session, user_id: UUID) -> List[UserRole]:
        """Get active roles for a user."""
        return db.query(UserRole).filter(
            and_(
                UserRole.user_id == user_id,
                UserRole.is_active == True
            )
        ).all()
    
    def get_by_role_type(self, db: Session, role_type: RoleType) -> List[UserRole]:
        """Get all user roles of a specific type."""
        return db.query(UserRole).filter(UserRole.role_type == role_type).all()
    
    def has_role(self, db: Session, user_id: UUID, role_type: RoleType) -> bool:
        """Check if user has a specific role."""
        return db.query(UserRole).filter(
            and_(
                UserRole.user_id == user_id,
                UserRole.role_type == role_type,
                UserRole.is_active == True
            )
        ).first() is not None


class ScopeAssignmentRepository(BaseRepository[ScopeAssignment]):
    """Repository for ScopeAssignment model operations."""
    
    def __init__(self):
        super().__init__(ScopeAssignment)
    
    def get_by_user_role(self, db: Session, user_role_id: UUID) -> List[ScopeAssignment]:
        """Get all scope assignments for a user role."""
        return db.query(ScopeAssignment).filter(
            ScopeAssignment.user_role_id == user_role_id
        ).all()
    
    def get_active_by_user_role(self, db: Session, user_role_id: UUID) -> List[ScopeAssignment]:
        """Get active scope assignments for a user role."""
        return db.query(ScopeAssignment).filter(
            and_(
                ScopeAssignment.user_role_id == user_role_id,
                ScopeAssignment.is_active == True
            )
        ).all()
    
    def get_program_scopes(self, db: Session, user_role_id: UUID) -> List[ScopeAssignment]:
        """Get program-level scope assignments for a user role."""
        return db.query(ScopeAssignment).filter(
            and_(
                ScopeAssignment.user_role_id == user_role_id,
                ScopeAssignment.scope_type == ScopeType.PROGRAM,
                ScopeAssignment.is_active == True
            )
        ).all()
    
    def get_project_scopes(self, db: Session, user_role_id: UUID) -> List[ScopeAssignment]:
        """Get project-level scope assignments for a user role."""
        return db.query(ScopeAssignment).filter(
            and_(
                ScopeAssignment.user_role_id == user_role_id,
                ScopeAssignment.scope_type == ScopeType.PROJECT,
                ScopeAssignment.is_active == True
            )
        ).all()
    
    def has_program_access(self, db: Session, user_role_id: UUID, program_id: UUID) -> bool:
        """Check if user role has access to a specific program."""
        return db.query(ScopeAssignment).filter(
            and_(
                ScopeAssignment.user_role_id == user_role_id,
                ScopeAssignment.scope_type == ScopeType.PROGRAM,
                ScopeAssignment.program_id == program_id,
                ScopeAssignment.is_active == True
            )
        ).first() is not None
    
    def has_project_access(self, db: Session, user_role_id: UUID, project_id: UUID) -> bool:
        """Check if user role has access to a specific project."""
        return db.query(ScopeAssignment).filter(
            and_(
                ScopeAssignment.user_role_id == user_role_id,
                ScopeAssignment.scope_type == ScopeType.PROJECT,
                ScopeAssignment.project_id == project_id,
                ScopeAssignment.is_active == True
            )
        ).first() is not None


# Create repository instances
user_repository = UserRepository()
user_role_repository = UserRoleRepository()
scope_assignment_repository = ScopeAssignmentRepository()