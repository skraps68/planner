"""
Actual repository for data access operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.actual import Actual
from app.repositories.base import BaseRepository


class ActualRepository(BaseRepository[Actual]):
    """Repository for Actual model operations."""
    
    def __init__(self):
        super().__init__(Actual)
    
    def get_by_project(self, db: Session, project_id: UUID) -> List[Actual]:
        """Get all actuals for a project."""
        return db.query(Actual).filter(
            Actual.project_id == project_id
        ).order_by(Actual.actual_date.desc()).all()
    
    def get_by_worker(self, db: Session, external_worker_id: str) -> List[Actual]:
        """Get all actuals for a worker."""
        return db.query(Actual).filter(
            Actual.external_worker_id == external_worker_id
        ).order_by(Actual.actual_date.desc()).all()
    
    def get_by_date(
        self,
        db: Session,
        external_worker_id: str,
        actual_date: date
    ) -> List[Actual]:
        """Get all actuals for a worker on a specific date."""
        return db.query(Actual).filter(
            and_(
                Actual.external_worker_id == external_worker_id,
                Actual.actual_date == actual_date
            )
        ).all()
    
    def get_total_allocation_for_date(
        self,
        db: Session,
        external_worker_id: str,
        actual_date: date
    ) -> Decimal:
        """Get total allocation percentage for a worker on a specific date."""
        result = db.query(
            func.sum(Actual.allocation_percentage)
        ).filter(
            and_(
                Actual.external_worker_id == external_worker_id,
                Actual.actual_date == actual_date
            )
        ).scalar()
        
        return result if result else Decimal('0.00')
    
    def get_by_date_range(
        self,
        db: Session,
        project_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Actual]:
        """Get actuals within a date range, optionally filtered by project."""
        query = db.query(Actual)
        
        if project_id:
            query = query.filter(Actual.project_id == project_id)
        if start_date:
            query = query.filter(Actual.actual_date >= start_date)
        if end_date:
            query = query.filter(Actual.actual_date <= end_date)
        
        return query.order_by(Actual.actual_date).all()
    
    def get_project_total_cost(
        self,
        db: Session,
        project_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Decimal:
        """Get total actual cost for a project, optionally within a date range."""
        query = db.query(func.sum(Actual.actual_cost)).filter(
            Actual.project_id == project_id
        )
        
        if start_date:
            query = query.filter(Actual.actual_date >= start_date)
        if end_date:
            query = query.filter(Actual.actual_date <= end_date)
        
        result = query.scalar()
        return result if result else Decimal('0.00')
    
    def validate_allocation_limit(
        self,
        db: Session,
        external_worker_id: str,
        actual_date: date,
        new_allocation: Decimal,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """
        Validate that adding a new actual doesn't exceed 100% allocation for the day.
        
        Returns True if the allocation is valid (total <= 100%).
        """
        query = db.query(
            func.sum(Actual.allocation_percentage)
        ).filter(
            and_(
                Actual.external_worker_id == external_worker_id,
                Actual.actual_date == actual_date
            )
        )
        
        if exclude_id:
            query = query.filter(Actual.id != exclude_id)
        
        current_total = query.scalar() or Decimal('0.00')
        return (current_total + new_allocation) <= Decimal('100.00')
    
    def validate_cost_split(
        self,
        actual_cost: Decimal,
        capital_amount: Decimal,
        expense_amount: Decimal
    ) -> bool:
        """Validate that capital + expense = actual_cost."""
        return capital_amount + expense_amount == actual_cost


# Create repository instance
actual_repository = ActualRepository()