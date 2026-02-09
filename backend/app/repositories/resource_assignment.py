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
    

# Create repository instance
resource_assignment_repository = ResourceAssignmentRepository()