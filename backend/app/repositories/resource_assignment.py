"""
ResourceAssignment repository for data access operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.resource_assignment import ResourceAssignment
from app.repositories.base import BaseRepository


class ResourceAssignmentRepository(BaseRepository[ResourceAssignment]):
    """Repository for ResourceAssignment model operations."""
    
    def __init__(self):
        super().__init__(ResourceAssignment)
    
    def get_by_project(self, db: Session, project_id: UUID) -> List[ResourceAssignment]:
        """Get all assignments for a project."""
        return db.query(ResourceAssignment).filter(
            ResourceAssignment.project_id == project_id
        ).all()
    
    def get_by_resource(self, db: Session, resource_id: UUID) -> List[ResourceAssignment]:
        """Get all assignments for a resource."""
        return db.query(ResourceAssignment).filter(
            ResourceAssignment.resource_id == resource_id
        ).all()
    
    def get_by_date(
        self,
        db: Session,
        resource_id: UUID,
        assignment_date: date
    ) -> List[ResourceAssignment]:
        """Get all assignments for a resource on a specific date."""
        return db.query(ResourceAssignment).filter(
            and_(
                ResourceAssignment.resource_id == resource_id,
                ResourceAssignment.assignment_date == assignment_date
            )
        ).all()
    
    def get_total_allocation_for_date(
        self,
        db: Session,
        resource_id: UUID,
        assignment_date: date
    ) -> Decimal:
        """Get total allocation percentage for a resource on a specific date."""
        result = db.query(
            func.sum(ResourceAssignment.allocation_percentage)
        ).filter(
            and_(
                ResourceAssignment.resource_id == resource_id,
                ResourceAssignment.assignment_date == assignment_date
            )
        ).scalar()
        
        return result if result else Decimal('0.00')
    
    def get_by_date_range(
        self,
        db: Session,
        resource_id: UUID,
        start_date: date,
        end_date: date
    ) -> List[ResourceAssignment]:
        """Get assignments for a resource within a date range."""
        return db.query(ResourceAssignment).filter(
            and_(
                ResourceAssignment.resource_id == resource_id,
                ResourceAssignment.assignment_date >= start_date,
                ResourceAssignment.assignment_date <= end_date
            )
        ).order_by(ResourceAssignment.assignment_date).all()
    
    def validate_allocation_limit(
        self,
        db: Session,
        resource_id: UUID,
        assignment_date: date,
        new_allocation: Decimal,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """
        Validate that adding a new allocation doesn't exceed 100% for the day.
        
        Returns True if the allocation is valid (total <= 100%).
        """
        query = db.query(
            func.sum(ResourceAssignment.allocation_percentage)
        ).filter(
            and_(
                ResourceAssignment.resource_id == resource_id,
                ResourceAssignment.assignment_date == assignment_date
            )
        )
        
        if exclude_id:
            query = query.filter(ResourceAssignment.id != exclude_id)
        
        current_total = query.scalar() or Decimal('0.00')
        return (current_total + new_allocation) <= Decimal('100.00')
    
    def validate_accounting_split(
        self,
        capital_percentage: Decimal,
        expense_percentage: Decimal
    ) -> bool:
        """Validate that capital + expense = 100%."""
        return capital_percentage + expense_percentage == Decimal('100.00')


# Create repository instance
resource_assignment_repository = ResourceAssignmentRepository()