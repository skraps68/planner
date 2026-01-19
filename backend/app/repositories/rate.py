"""
Rate repository for data access operations with temporal queries.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.rate import Rate
from app.repositories.base import BaseRepository


class RateRepository(BaseRepository[Rate]):
    """Repository for Rate model operations with temporal validity support."""
    
    def __init__(self):
        super().__init__(Rate)
    
    def get_by_worker_type(self, db: Session, worker_type_id: UUID) -> List[Rate]:
        """Get all rates for a worker type."""
        return db.query(Rate).filter(
            Rate.worker_type_id == worker_type_id
        ).order_by(Rate.start_date.desc()).all()
    
    def get_active_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        as_of_date: Optional[date] = None
    ) -> Optional[Rate]:
        """Get the active rate for a worker type on a given date (default: today)."""
        if as_of_date is None:
            as_of_date = date.today()
        
        return db.query(Rate).filter(
            and_(
                Rate.worker_type_id == worker_type_id,
                Rate.start_date <= as_of_date,
                or_(
                    Rate.end_date.is_(None),
                    Rate.end_date >= as_of_date
                )
            )
        ).first()
    
    def get_current_rate(self, db: Session, worker_type_id: UUID) -> Optional[Rate]:
        """Get the current active rate for a worker type (end_date is NULL)."""
        return db.query(Rate).filter(
            and_(
                Rate.worker_type_id == worker_type_id,
                Rate.end_date.is_(None)
            )
        ).first()
    
    def get_rates_in_date_range(
        self,
        db: Session,
        worker_type_id: UUID,
        start_date: date,
        end_date: date
    ) -> List[Rate]:
        """Get all rates that overlap with a date range."""
        return db.query(Rate).filter(
            and_(
                Rate.worker_type_id == worker_type_id,
                Rate.start_date <= end_date,
                or_(
                    Rate.end_date.is_(None),
                    Rate.end_date >= start_date
                )
            )
        ).order_by(Rate.start_date).all()
    
    def close_current_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        end_date: date
    ) -> Optional[Rate]:
        """Close the current rate by setting its end_date."""
        current_rate = self.get_current_rate(db, worker_type_id)
        if current_rate:
            current_rate.end_date = end_date
            db.add(current_rate)
            db.commit()
            db.refresh(current_rate)
        return current_rate
    
    def create_new_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        rate_amount: Decimal,
        start_date: date,
        close_previous: bool = True
    ) -> Rate:
        """
        Create a new rate, optionally closing the previous rate.
        
        If close_previous is True, the current rate (with end_date=NULL) will be
        closed with end_date set to the day before the new rate's start_date.
        """
        if close_previous:
            # Close the current rate
            previous_end_date = date.fromordinal(start_date.toordinal() - 1)
            self.close_current_rate(db, worker_type_id, previous_end_date)
        
        # Create new rate
        new_rate = Rate(
            worker_type_id=worker_type_id,
            rate_amount=rate_amount,
            start_date=start_date,
            end_date=None  # New rate is open-ended
        )
        db.add(new_rate)
        db.commit()
        db.refresh(new_rate)
        return new_rate
    
    def validate_no_overlap(
        self,
        db: Session,
        worker_type_id: UUID,
        start_date: date,
        end_date: Optional[date],
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Validate that a new rate doesn't overlap with existing rates."""
        query = db.query(Rate).filter(
            Rate.worker_type_id == worker_type_id,
            Rate.start_date <= (end_date if end_date else date.max),
            or_(
                Rate.end_date.is_(None),
                Rate.end_date >= start_date
            )
        )
        
        if exclude_id:
            query = query.filter(Rate.id != exclude_id)
        
        return query.first() is None


# Create repository instance
rate_repository = RateRepository()