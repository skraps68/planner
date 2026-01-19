"""
Resource, Worker, and WorkerType repositories for data access operations.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.repositories.base import BaseRepository


class ResourceRepository(BaseRepository[Resource]):
    """Repository for Resource model operations."""
    
    def __init__(self):
        super().__init__(Resource)
    
    def get_by_type(self, db: Session, resource_type: ResourceType) -> List[Resource]:
        """Get resources by type."""
        return db.query(Resource).filter(Resource.resource_type == resource_type).all()
    
    def get_labor_resources(self, db: Session) -> List[Resource]:
        """Get all labor resources."""
        return self.get_by_type(db, ResourceType.LABOR)
    
    def get_non_labor_resources(self, db: Session) -> List[Resource]:
        """Get all non-labor resources."""
        return self.get_by_type(db, ResourceType.NON_LABOR)
    
    def search_by_name(self, db: Session, search_term: str) -> List[Resource]:
        """Search resources by name (case-insensitive partial match)."""
        return db.query(Resource).filter(
            Resource.name.ilike(f"%{search_term}%")
        ).all()


class WorkerTypeRepository(BaseRepository[WorkerType]):
    """Repository for WorkerType model operations."""
    
    def __init__(self):
        super().__init__(WorkerType)
    
    def get_by_type(self, db: Session, type: str) -> Optional[WorkerType]:
        """Get worker type by type name."""
        return db.query(WorkerType).filter(WorkerType.type == type).first()
    
    def search_by_type(self, db: Session, search_term: str) -> List[WorkerType]:
        """Search worker types by type name (case-insensitive partial match)."""
        return db.query(WorkerType).filter(
            WorkerType.type.ilike(f"%{search_term}%")
        ).all()


class WorkerRepository(BaseRepository[Worker]):
    """Repository for Worker model operations."""
    
    def __init__(self):
        super().__init__(Worker)
    
    def get_by_external_id(self, db: Session, external_id: str) -> Optional[Worker]:
        """Get worker by external ID."""
        return db.query(Worker).filter(Worker.external_id == external_id).first()
    
    def get_by_worker_type(self, db: Session, worker_type_id: UUID) -> List[Worker]:
        """Get workers by worker type."""
        return db.query(Worker).filter(Worker.worker_type_id == worker_type_id).all()
    
    def search_by_name(self, db: Session, search_term: str) -> List[Worker]:
        """Search workers by name (case-insensitive partial match)."""
        return db.query(Worker).filter(
            Worker.name.ilike(f"%{search_term}%")
        ).all()
    
    def validate_external_id_unique(self, db: Session, external_id: str, exclude_id: Optional[UUID] = None) -> bool:
        """Validate that external_id is unique."""
        query = db.query(Worker).filter(Worker.external_id == external_id)
        if exclude_id:
            query = query.filter(Worker.id != exclude_id)
        return query.first() is None


# Create repository instances
resource_repository = ResourceRepository()
worker_type_repository = WorkerTypeRepository()
worker_repository = WorkerRepository()