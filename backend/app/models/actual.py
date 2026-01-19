"""
Actual model for tracking actual work performed.
"""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, String, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.resource_assignment import ResourceAssignment


class Actual(BaseModel):
    """Actual model for tracking actual work performed on projects."""
    
    __tablename__ = "actuals"
    
    # Foreign keys
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False, index=True)
    resource_assignment_id = Column(GUID(), ForeignKey("resource_assignments.id"), nullable=True, index=True)
    
    # Required fields
    external_worker_id = Column(String(100), nullable=False, index=True)
    worker_name = Column(String(255), nullable=False)
    actual_date = Column(Date, nullable=False, index=True)
    allocation_percentage = Column(Numeric(5, 2), nullable=False)  # 0.00 to 100.00
    actual_cost = Column(Numeric(15, 2), nullable=False)
    capital_amount = Column(Numeric(15, 2), nullable=False)
    expense_amount = Column(Numeric(15, 2), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="actuals")
    resource_assignment = relationship("ResourceAssignment", back_populates="actuals")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('allocation_percentage >= 0 AND allocation_percentage <= 100', name='check_actual_allocation_percentage'),
        CheckConstraint('actual_cost >= 0', name='check_actual_cost_positive'),
        CheckConstraint('capital_amount >= 0', name='check_capital_amount_positive'),
        CheckConstraint('expense_amount >= 0', name='check_expense_amount_positive'),
        CheckConstraint('capital_amount + expense_amount = actual_cost', name='check_actual_cost_split'),
    )
    
    def __repr__(self) -> str:
        return f"<Actual(id={self.id}, project_id={self.project_id}, worker='{self.worker_name}', date={self.actual_date}, allocation={self.allocation_percentage}%)>"