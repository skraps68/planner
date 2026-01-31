"""
Project and ProjectPhase models for managing projects.
"""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Column, Date, String, Numeric, ForeignKey,
    CheckConstraint
)
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID

if TYPE_CHECKING:
    from app.models.program import Program
    from app.models.resource_assignment import ResourceAssignment
    from app.models.actual import Actual


class Project(BaseModel):
    """Project model for managing individual projects."""
    
    __tablename__ = "projects"
    
    # Foreign keys
    program_id = Column(GUID(), ForeignKey("programs.id"), nullable=False, index=True)
    
    # Required fields
    name = Column(String(255), nullable=False, index=True)
    business_sponsor = Column(String(255), nullable=False)
    project_manager = Column(String(255), nullable=False)
    technical_lead = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    cost_center_code = Column(String(50), nullable=False, unique=True, index=True)
    
    # Optional fields
    description = Column(String(1000), nullable=True)
    
    # Relationships
    program = relationship("Program", back_populates="projects")
    phases = relationship("ProjectPhase", back_populates="project", cascade="all, delete-orphan")
    resource_assignments = relationship("ResourceAssignment", back_populates="project", cascade="all, delete-orphan")
    actuals = relationship("Actual", back_populates="project", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('start_date < end_date', name='check_project_dates'),
    )
    
    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}')>"


class ProjectPhase(BaseModel):
    """Project phase model with user-definable date ranges."""
    
    __tablename__ = "project_phases"
    
    # Foreign keys
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False, index=True)
    
    # Required fields
    name = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    capital_budget = Column(Numeric(15, 2), nullable=False, default=0)
    expense_budget = Column(Numeric(15, 2), nullable=False, default=0)
    total_budget = Column(Numeric(15, 2), nullable=False, default=0)
    
    # Optional fields
    description = Column(String(500), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="phases")
    # Note: resource_assignments relationship removed (now implicit via dates)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('start_date <= end_date', name='check_phase_dates'),
        CheckConstraint('capital_budget >= 0', name='check_capital_budget_positive'),
        CheckConstraint('expense_budget >= 0', name='check_expense_budget_positive'),
        CheckConstraint('total_budget >= 0', name='check_total_budget_positive'),
        CheckConstraint('capital_budget + expense_budget = total_budget', name='check_budget_sum'),
    )
    
    def __repr__(self) -> str:
        return f"<ProjectPhase(id={self.id}, project_id={self.project_id}, name='{self.name}')>"