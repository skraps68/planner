"""
Base repository class for data access operations.
"""
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.utils import DatabaseUtils
from app.models.base import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)


class BaseRepository(Generic[ModelType]):
    """Base repository with common CRUD operations."""
    
    def __init__(self, model: Type[ModelType]):
        """Initialize repository with model class."""
        self.model = model
    
    def get(self, db: Session, id: Union[UUID, str]) -> Optional[ModelType]:
        """Get a single record by ID."""
        return DatabaseUtils.get_by_id(db, self.model, id)
    
    def get_multi(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records with pagination."""
        return DatabaseUtils.get_multi(db, self.model, skip=skip, limit=limit)
    
    def create(self, db: Session, *, obj_in: Dict[str, Any]) -> ModelType:
        """Create a new record."""
        return DatabaseUtils.create(db, self.model, obj_in)
    
    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Dict[str, Any]
    ) -> ModelType:
        """Update an existing record."""
        return DatabaseUtils.update(db, db_obj, obj_in)
    
    def remove(self, db: Session, *, id: Union[UUID, str]) -> Optional[ModelType]:
        """Remove a record by ID."""
        obj = self.get(db, id)
        if obj:
            return DatabaseUtils.delete(db, obj)
        return None
    
    def count(self, db: Session) -> int:
        """Count total records."""
        return DatabaseUtils.count(db, self.model)
    
    def get_all(self, db: Session) -> List[ModelType]:
        """Get all records."""
        return db.query(self.model).all()