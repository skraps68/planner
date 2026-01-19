"""
User, UserRole, and ScopeAssignment models for authentication and authorization.
"""
from enum import Enum
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Column, String, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.program import Program
    from app.models.project import Project
    from app.models.audit import AuditLog


class RoleType(str, Enum):
    """User role types."""
    ADMIN = "admin"
    PROGRAM_MANAGER = "program_manager"
    PROJECT_MANAGER = "project_manager"
    FINANCE_MANAGER = "finance_manager"
    RESOURCE_MANAGER = "resource_manager"
    VIEWER = "viewer"


class ScopeType(str, Enum):
    """Permission scope types."""
    GLOBAL = "global"
    PROGRAM = "program"
    PROJECT = "project"


class User(BaseModel):
    """User model for authentication."""
    
    __tablename__ = "users"
    
    # Required fields
    username = Column(String(100), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


class UserRole(BaseModel):
    """User role assignment model."""
    
    __tablename__ = "user_roles"
    
    # Foreign keys
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Required fields
    role_type = Column(SQLEnum(RoleType), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="user_roles")
    scope_assignments = relationship("ScopeAssignment", back_populates="user_role", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<UserRole(id={self.id}, user_id={self.user_id}, role={self.role_type}, active={self.is_active})>"


class ScopeAssignment(BaseModel):
    """Scope assignment model for program/project-level permissions."""
    
    __tablename__ = "scope_assignments"
    
    # Foreign keys
    user_role_id = Column(PGUUID(as_uuid=True), ForeignKey("user_roles.id"), nullable=False, index=True)
    program_id = Column(PGUUID(as_uuid=True), ForeignKey("programs.id"), nullable=True, index=True)
    project_id = Column(PGUUID(as_uuid=True), ForeignKey("projects.id"), nullable=True, index=True)
    
    # Required fields
    scope_type = Column(SQLEnum(ScopeType), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    user_role = relationship("UserRole", back_populates="scope_assignments")
    program = relationship("Program")
    project = relationship("Project")
    
    def __repr__(self) -> str:
        scope_id = self.program_id if self.scope_type == ScopeType.PROGRAM else self.project_id
        return f"<ScopeAssignment(id={self.id}, user_role_id={self.user_role_id}, scope={self.scope_type}, scope_id={scope_id})>"