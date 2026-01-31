"""
ResourceAssignment model for assigning resources to projects.
"""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID

if TYPE_CHECKING:
    from app.models.resource import Resource
    from app.models.project import Project
    from app.models.actual import Actual


class ResourceAssignment(BaseModel):
    """
    Resource assignment model for allocating resources to projects.
    
    Phase association is now implicit based on assignment_date falling within
    a phase's date range, rather than an explicit foreign key relationship.
    """
    
    __tablename__ = "resource_assignments"
    
    # Foreign keys
    resource_id = Column(GUID(), ForeignKey("resources.id"), nullable=False, index=True)
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False, index=True)
    # Note: project_phase_id removed - phase association now determined by date
    
    # Required fields
    assignment_date = Column(Date, nullable=False, index=True)
    allocation_percentage = Column(Numeric(5, 2), nullable=False)  # 0.00 to 100.00
    capital_percentage = Column(Numeric(5, 2), nullable=False)  # 0.00 to 100.00
    expense_percentage = Column(Numeric(5, 2), nullable=False)  # 0.00 to 100.00
    
    # Relationships
    resource = relationship("Resource", back_populates="resource_assignments")
    project = relationship("Project", back_populates="resource_assignments")
    # Note: project_phase relationship removed (now implicit via dates)
    actuals = relationship("Actual", back_populates="resource_assignment", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('allocation_percentage >= 0 AND allocation_percentage <= 100', name='check_allocation_percentage'),
        CheckConstraint('capital_percentage >= 0 AND capital_percentage <= 100', name='check_capital_percentage'),
        CheckConstraint('expense_percentage >= 0 AND expense_percentage <= 100', name='check_expense_percentage'),
        CheckConstraint('capital_percentage + expense_percentage = 100', name='check_accounting_split'),
    )
    
    def __repr__(self) -> str:
        return f"<ResourceAssignment(id={self.id}, resource_id={self.resource_id}, project_id={self.project_id}, date={self.assignment_date}, allocation={self.allocation_percentage}%)>"