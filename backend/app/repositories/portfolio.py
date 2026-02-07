"""
Portfolio repository for data access operations.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.repositories.base import BaseRepository


class PortfolioRepository(BaseRepository[Portfolio]):
    """Repository for Portfolio model operations."""
    
    def __init__(self):
        super().__init__(Portfolio)
    
    def get_by_name(self, db: Session, name: str) -> Optional[Portfolio]:
        """Get portfolio by name."""
        return db.query(Portfolio).filter(Portfolio.name == name).first()
    
    def get_by_owner(self, db: Session, owner: str) -> List[Portfolio]:
        """Get portfolios by owner."""
        return db.query(Portfolio).filter(Portfolio.owner == owner).all()
    
    def get_active_portfolios(self, db: Session, as_of_date: Optional[date] = None) -> List[Portfolio]:
        """Get portfolios that are active on a given date (default: today)."""
        if as_of_date is None:
            as_of_date = date.today()
        
        return db.query(Portfolio).filter(
            and_(
                Portfolio.reporting_start_date <= as_of_date,
                Portfolio.reporting_end_date >= as_of_date
            )
        ).all()
    
    def get_by_date_range(
        self,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Portfolio]:
        """Get portfolios that overlap with a date range."""
        filters = []
        
        if start_date:
            filters.append(Portfolio.reporting_end_date >= start_date)
        if end_date:
            filters.append(Portfolio.reporting_start_date <= end_date)
        
        if filters:
            return db.query(Portfolio).filter(and_(*filters)).all()
        else:
            return self.get_multi(db)
    
    def search_by_name(self, db: Session, search_term: str) -> List[Portfolio]:
        """Search portfolios by name (case-insensitive partial match)."""
        return db.query(Portfolio).filter(
            Portfolio.name.ilike(f"%{search_term}%")
        ).all()
    
    def validate_date_constraints(self, start_date: date, end_date: date) -> bool:
        """Validate that start_date is before end_date."""
        return start_date < end_date


# Create repository instance
portfolio_repository = PortfolioRepository()
