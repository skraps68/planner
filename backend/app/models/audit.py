"""
AuditLog model for tracking data modifications.
"""
from typing import TYPE_CHECKING, Any, Dict

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(BaseModel):
    """Audit log model for tracking all data modifications."""
    
    __tablename__ = "audit_logs"
    
    # Foreign keys
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Required fields
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    operation = Column(String(50), nullable=False, index=True)  # CREATE, UPDATE, DELETE
    before_values = Column(JSONB, nullable=True)
    after_values = Column(JSONB, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, entity={self.entity_type}, operation={self.operation})>"