"""
Rate model for managing historical worker type rates.
"""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.resource import WorkerType


class Rate(BaseModel):
    """Rate model for historical rate information with temporal validity."""
    
    __tablename__ = "rates"
    
    # Foreign keys
    worker_type_id = Column(UUID(as_uuid=True), ForeignKey("worker_types.id"), nullable=False, index=True)
    
    # Required fields
    rate_amount = Column(Numeric(15, 2), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=True, index=True)  # NULL represents infinity
    
    # Relationships
    worker_type = relationship("WorkerType", back_populates="rates")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('rate_amount > 0', name='check_rate_positive'),
        CheckConstraint('end_date IS NULL OR start_date < end_date', name='check_rate_dates'),
    )
    
    def __repr__(self) -> str:
        return f"<Rate(id={self.id}, worker_type_id={self.worker_type_id}, amount={self.rate_amount}, start={self.start_date}, end={self.end_date})>"
    
    def is_active_on(self, check_date: date) -> bool:
        """Check if rate is active on a given date."""
        if check_date < self.start_date:
            return False
        if self.end_date is None:
            return True
        return check_date <= self.end_date