"""
Program repository for data access operations.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.models.program import Program
from app.repositories.base import BaseRepository


class ProgramRepository(BaseRepository[Program]):
    """Repository for Program model operations."""
    
    def __init__(self):
        super().__init__(Program)
    
    def get(self, db: Session, id: UUID) -> Optional[Program]:
        """Get program by ID with portfolio relationship loaded."""
        return db.query(Program).options(joinedload(Program.portfolio)).filter(Program.id == id).first()
    
    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Program]:
        """Get multiple programs with portfolio relationship loaded."""
        return db.query(Program).options(joinedload(Program.portfolio)).offset(skip).limit(limit).all()
    
    def get_by_name(self, db: Session, name: str) -> Optional[Program]:
        """Get program by name with portfolio relationship loaded."""
        return db.query(Program).options(joinedload(Program.portfolio)).filter(Program.name == name).first()
    
    def get_by_manager(self, db: Session, manager: str) -> List[Program]:
        """Get programs by program manager with portfolio relationship loaded."""
        return db.query(Program).options(joinedload(Program.portfolio)).filter(Program.program_manager == manager).all()
    
    def get_by_sponsor(self, db: Session, sponsor: str) -> List[Program]:
        """Get programs by business sponsor with portfolio relationship loaded."""
        return db.query(Program).options(joinedload(Program.portfolio)).filter(Program.business_sponsor == sponsor).all()
    
    def get_active_programs(self, db: Session, as_of_date: Optional[date] = None) -> List[Program]:
        """Get programs that are active on a given date (default: today) with portfolio relationship loaded."""
        if as_of_date is None:
            as_of_date = date.today()
        
        return db.query(Program).options(joinedload(Program.portfolio)).filter(
            and_(
                Program.start_date <= as_of_date,
                Program.end_date >= as_of_date
            )
        ).all()
    
    def get_by_date_range(
        self,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Program]:
        """Get programs that overlap with a date range with portfolio relationship loaded."""
        filters = []
        
        if start_date:
            filters.append(Program.end_date >= start_date)
        if end_date:
            filters.append(Program.start_date <= end_date)
        
        if filters:
            return db.query(Program).options(joinedload(Program.portfolio)).filter(and_(*filters)).all()
        else:
            return self.get_multi(db)
    
    def search_by_name(self, db: Session, search_term: str) -> List[Program]:
        """Search programs by name (case-insensitive partial match) with portfolio relationship loaded."""
        return db.query(Program).options(joinedload(Program.portfolio)).filter(
            Program.name.ilike(f"%{search_term}%")
        ).all()
    
    def validate_date_constraints(self, start_date: date, end_date: date) -> bool:
        """Validate that start_date is before end_date."""
        return start_date < end_date


# Create repository instance
program_repository = ProgramRepository()