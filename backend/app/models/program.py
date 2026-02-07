"""
Program model for managing organizational programs.
"""
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Column, Date, String, CheckConstraint, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.portfolio import Portfolio


class Program(BaseModel):
    """Program model for organizing related projects."""
    
    __tablename__ = "programs"
    
    # Foreign keys
    portfolio_id = Column(GUID(), ForeignKey("portfolios.id"), nullable=False, index=True)
    
    # Required fields
    name = Column(String(255), nullable=False, index=True)
    business_sponsor = Column(String(255), nullable=False)
    program_manager = Column(String(255), nullable=False)
    technical_lead = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Optional fields
    description = Column(String(1000), nullable=True)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="programs")
    projects = relationship("Project", back_populates="program", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('start_date < end_date', name='check_program_dates'),
    )
    
    def __repr__(self) -> str:
        return f"<Program(id={self.id}, name='{self.name}')>"