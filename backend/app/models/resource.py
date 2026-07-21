"""
Resource, Worker, and WorkerType models for resource management.
"""
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Column, String, ForeignKey, Enum as SQLEnum, CheckConstraint, text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID

if TYPE_CHECKING:
    from app.models.resource_assignment import ResourceAssignment


class ResourceType(str, Enum):
    """Resource types. Values equal names so DB storage (SQLEnum stores
    names), API serialization (Pydantic emits values), and the frontend's
    'LABOR' | 'NON_LABOR' literals all agree."""
    LABOR = "LABOR"
    NON_LABOR = "NON_LABOR"


class Resource(BaseModel):
    """Resource model for both labor and non-labor resources."""
    
    __tablename__ = "resources"
    
    __table_args__ = (
        CheckConstraint(
            "(resource_type = 'LABOR' AND worker_id IS NOT NULL) OR "
            "(resource_type = 'NON_LABOR' AND worker_id IS NULL)",
            name="ck_resources_labor_worker",
        ),
        CheckConstraint(
            "(resource_type = 'LABOR' AND resource_role_id IS NOT NULL) OR "
            "(resource_type = 'NON_LABOR' AND resource_role_id IS NULL)",
            name="ck_resources_labor_role",
        ),
    )

    # Required fields
    name = Column(String(255), nullable=False, index=True)
    resource_type = Column(SQLEnum(ResourceType), nullable=False, index=True)
    description = Column(String(1000), nullable=True)

    # Strict linkage: LABOR resources must reference a worker; NON_LABOR must not.
    # Column-nullable only because non-labor rows share this table — the CHECK
    # constraint makes NULL impossible for labor rows at the database level.
    worker_id = Column(GUID(), ForeignKey("workers.id"), nullable=True, unique=True, index=True)

    # Resource role: LABOR resources must have a role; NON_LABOR must not.
    resource_role_id = Column(GUID(), ForeignKey("resource_roles.id"), nullable=True, index=True)

    # Relationships
    resource_assignments = relationship("ResourceAssignment", back_populates="resource", cascade="all, delete-orphan")
    worker = relationship("Worker")
    resource_role = relationship("ResourceRole", back_populates="resources")
    
    def __repr__(self) -> str:
        return f"<Resource(id={self.id}, name='{self.name}', type={self.resource_type})>"


class ResourceRole(BaseModel):
    """Job-role classification for a (labor) resource. Admin-managed reference data."""
    __tablename__ = "resource_roles"

    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(String(1000), nullable=True)

    resources = relationship("Resource", back_populates="resource_role")

    def __repr__(self) -> str:
        return f"<ResourceRole(id={self.id}, name='{self.name}')>"


class WorkerType(BaseModel):
    """Worker type model for categorizing workers."""

    __tablename__ = "worker_types"
    
    # Required fields
    type = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(String(1000), nullable=False)
    
    # Relationships
    workers = relationship("Worker", back_populates="worker_type")
    rates = relationship("Rate", back_populates="worker_type", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<WorkerType(id={self.id}, type='{self.type}')>"


class Worker(BaseModel):
    """Worker model for labor resources."""
    
    __tablename__ = "workers"
    
    # Foreign keys
    worker_type_id = Column(GUID(), ForeignKey("worker_types.id"), nullable=False, index=True)
    
    # Required fields
    external_id = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    cost_center_code = Column(String(50), nullable=False, server_default=text("'CC-0000'"), index=True)

    # Relationships
    worker_type = relationship("WorkerType", back_populates="workers")
    
    def __repr__(self) -> str:
        return f"<Worker(id={self.id}, external_id='{self.external_id}', name='{self.name}')>"