"""
Resource, Worker, and WorkerType models for resource management.
"""
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Column, String, ForeignKey, Enum as SQLEnum, CheckConstraint
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
    )

    # Required fields
    name = Column(String(255), nullable=False, index=True)
    resource_type = Column(SQLEnum(ResourceType), nullable=False, index=True)
    description = Column(String(1000), nullable=True)

    # Strict linkage: LABOR resources must reference a worker; NON_LABOR must not.
    # Column-nullable only because non-labor rows share this table — the CHECK
    # constraint makes NULL impossible for labor rows at the database level.
    worker_id = Column(GUID(), ForeignKey("workers.id"), nullable=True, unique=True, index=True)

    # Relationships
    resource_assignments = relationship("ResourceAssignment", back_populates="resource", cascade="all, delete-orphan")
    worker = relationship("Worker")
    
    def __repr__(self) -> str:
        return f"<Resource(id={self.id}, name='{self.name}', type={self.resource_type})>"


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
    
    # Relationships
    worker_type = relationship("WorkerType", back_populates="workers")
    
    def __repr__(self) -> str:
        return f"<Worker(id={self.id}, external_id='{self.external_id}', name='{self.name}')>"