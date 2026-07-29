"""Actual models for imported labor and non-labor results."""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, String, Numeric, ForeignKey, CheckConstraint, Integer
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.resource import Resource


class ActualImportBatch(BaseModel):
    """One atomic actuals load and its explicit completeness boundary."""

    __tablename__ = "actual_import_batches"

    source_type = Column(String(20), nullable=False, index=True)
    actuals_through_date = Column(Date, nullable=False, index=True)
    file_name = Column(String(255), nullable=True)
    imported_by_user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    transaction_id = Column(GUID(), nullable=False, unique=True, index=True)
    record_count = Column(Integer, nullable=False, default=0)

    actuals = relationship("Actual", back_populates="import_batch")


class Actual(BaseModel):
    """Actual model for tracking actual work performed on projects."""

    __tablename__ = "actuals"

    # Foreign keys
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False, index=True)
    resource_id = Column(GUID(), ForeignKey("resources.id"), nullable=False, index=True)
    import_batch_id = Column(
        GUID(),
        ForeignKey("actual_import_batches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Labor columns (nullable for non-labor actuals)
    external_worker_id = Column(String(100), nullable=True, index=True)
    worker_name = Column(String(255), nullable=True)
    actual_date = Column(Date, nullable=False, index=True)
    allocation_percentage = Column(Numeric(5, 2), nullable=True)  # 0.00 to 100.00
    actual_cost = Column(Numeric(15, 2), nullable=False)
    capital_amount = Column(Numeric(15, 2), nullable=False)
    expense_amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="actuals")
    resource = relationship("Resource")
    import_batch = relationship("ActualImportBatch", back_populates="actuals")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('allocation_percentage IS NULL OR (allocation_percentage >= 0 AND allocation_percentage <= 100)', name='check_actual_allocation_percentage'),
        CheckConstraint('actual_cost >= 0', name='check_actual_cost_positive'),
        CheckConstraint('capital_amount >= 0', name='check_capital_amount_positive'),
        CheckConstraint('expense_amount >= 0', name='check_expense_amount_positive'),
        CheckConstraint('capital_amount + expense_amount = actual_cost', name='check_actual_cost_split'),
    )
    
    def __repr__(self) -> str:
        return f"<Actual(id={self.id}, project_id={self.project_id}, worker='{self.worker_name}', date={self.actual_date}, allocation={self.allocation_percentage}%)>"
