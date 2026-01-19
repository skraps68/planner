"""
Database utility functions.
"""
from typing import Any, Dict, Optional, Type, TypeVar, Union
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.base import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)


class DatabaseUtils:
    """Utility class for common database operations."""
    
    @staticmethod
    def get_by_id(
        db: Session,
        model: Type[ModelType],
        id: Union[UUID, str]
    ) -> Optional[ModelType]:
        """Get a record by ID."""
        return db.query(model).filter(model.id == id).first()
    
    @staticmethod
    def get_multi(
        db: Session,
        model: Type[ModelType],
        skip: int = 0,
        limit: int = 100
    ) -> list[ModelType]:
        """Get multiple records with pagination."""
        return db.query(model).offset(skip).limit(limit).all()
    
    @staticmethod
    def create(
        db: Session,
        model: Type[ModelType],
        obj_in: Dict[str, Any]
    ) -> ModelType:
        """Create a new record."""
        db_obj = model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    @staticmethod
    def update(
        db: Session,
        db_obj: ModelType,
        obj_in: Dict[str, Any]
    ) -> ModelType:
        """Update an existing record."""
        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    @staticmethod
    def delete(
        db: Session,
        db_obj: ModelType
    ) -> ModelType:
        """Delete a record."""
        db.delete(db_obj)
        db.commit()
        return db_obj
    
    @staticmethod
    def count(
        db: Session,
        model: Type[ModelType]
    ) -> int:
        """Count records in a table."""
        return db.query(model).count()