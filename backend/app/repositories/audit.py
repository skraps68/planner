"""
AuditLog repository for data access operations.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    """Repository for AuditLog model operations."""
    
    def __init__(self):
        super().__init__(AuditLog)
    
    def get_by_entity(
        self,
        db: Session,
        entity_type: str,
        entity_id: UUID
    ) -> List[AuditLog]:
        """Get all audit logs for a specific entity."""
        return db.query(AuditLog).filter(
            and_(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id
            )
        ).order_by(AuditLog.created_at.desc()).all()
    
    def get_by_user(self, db: Session, user_id: UUID) -> List[AuditLog]:
        """Get all audit logs for a specific user."""
        return db.query(AuditLog).filter(
            AuditLog.user_id == user_id
        ).order_by(AuditLog.created_at.desc()).all()
    
    def get_by_operation(self, db: Session, operation: str) -> List[AuditLog]:
        """Get all audit logs for a specific operation type."""
        return db.query(AuditLog).filter(
            AuditLog.operation == operation
        ).order_by(AuditLog.created_at.desc()).all()
    
    def get_by_date_range(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> List[AuditLog]:
        """Get audit logs within a date range."""
        return db.query(AuditLog).filter(
            and_(
                AuditLog.created_at >= start_date,
                AuditLog.created_at <= end_date
            )
        ).order_by(AuditLog.created_at.desc()).all()
    
    def create_audit_log(
        self,
        db: Session,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        operation: str,
        before_values: Optional[Dict[str, Any]] = None,
        after_values: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """Create a new audit log entry."""
        audit_log = AuditLog(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation=operation,
            before_values=before_values,
            after_values=after_values
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log


# Create repository instance
audit_log_repository = AuditLogRepository()