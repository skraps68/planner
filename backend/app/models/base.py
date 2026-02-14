"""
Base model classes for the application.
"""
import uuid
import json
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, String, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import as_declarative, declared_attr
from sqlalchemy.types import TypeDecorator, CHAR


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified hex values.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(value))
            else:
                return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                value = uuid.UUID(value)
            return value


class JSON(TypeDecorator):
    """Platform-independent JSON type.
    
    Uses PostgreSQL's JSONB type, otherwise uses TEXT, storing as JSON strings.
    """
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB())
        else:
            return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.loads(value)


@as_declarative()
class Base:
    """Base class for all database models."""
    
    id: Any
    __name__: str
    
    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()


class BaseModel(Base):
    """Base model with common fields."""
    
    __abstract__ = True
    
    id = Column(
        GUID(),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    version = Column(
        Integer,
        nullable=False,
        default=1,
        server_default='1'
    )
    
    __mapper_args__ = {
        "version_id_col": version
    }
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"