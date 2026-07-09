"""
Portfolio model for managing organizational portfolios.
"""
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, String, CheckConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.program import Program


class Portfolio(BaseModel):
    """Portfolio model for organizing related programs."""
    
    __tablename__ = "portfolios"
    
    # Required fields
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=False)
    owner = Column(String(255), nullable=False)
    reporting_start_date = Column(Date, nullable=False)
    reporting_end_date = Column(Date, nullable=False)

    # Human-friendly 9-digit typed ID (server-generated; leading zeros meaningful).
    # Nullable in the model so SQLite test fixtures that predate business IDs
    # still work; Postgres enforces NOT NULL via migration.
    business_id = Column(String(9), nullable=True, unique=True, index=True)
    
    # Relationships
    programs = relationship("Program", back_populates="portfolio", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('reporting_start_date < reporting_end_date', name='check_portfolio_dates'),
    )
    
    def __repr__(self) -> str:
        return f"<Portfolio(id={self.id}, name='{self.name}')>"
