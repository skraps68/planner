"""
Audit service for tracking data modifications and permission changes.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.inspection import inspect

from app.models.audit import AuditLog
from app.models.base import BaseModel
from app.repositories.audit import audit_log_repository


class AuditService:
    """Service for creating and querying audit logs."""
    
    def __init__(self):
        self.audit_repo = audit_log_repository
    
    def _get_model_values(self, obj: BaseModel) -> Dict[str, Any]:
        """
        Extract all column values from a model instance.
        
        Args:
            obj: Model instance
            
        Returns:
            Dictionary of column names to values
        """
        from datetime import date
        
        values = {}
        mapper = inspect(obj.__class__)
        
        for column in mapper.columns:
            value = getattr(obj, column.key, None)
            
            # Convert non-serializable types
            if isinstance(value, UUID):
                value = str(value)
            elif isinstance(value, datetime):
                value = value.isoformat()
            elif isinstance(value, date):
                value = value.isoformat()
            elif hasattr(value, '__dict__'):
                # Skip complex objects
                continue
            
            values[column.key] = value
        
        return values
    
    def log_create(
        self,
        db: Session,
        user_id: UUID,
        entity: BaseModel
    ) -> AuditLog:
        """
        Log a CREATE operation.
        
        Args:
            db: Database session
            user_id: User who performed the operation
            entity: Created entity
            
        Returns:
            Created AuditLog
        """
        entity_type = entity.__class__.__name__
        entity_id = entity.id
        after_values = self._get_model_values(entity)
        
        return self.audit_repo.create_audit_log(
            db=db,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation="CREATE",
            before_values=None,
            after_values=after_values
        )
    
    def log_update(
        self,
        db: Session,
        user_id: UUID,
        entity: BaseModel,
        before_values: Dict[str, Any]
    ) -> AuditLog:
        """
        Log an UPDATE operation.
        
        Args:
            db: Database session
            user_id: User who performed the operation
            entity: Updated entity
            before_values: Values before the update
            
        Returns:
            Created AuditLog
        """
        entity_type = entity.__class__.__name__
        entity_id = entity.id
        after_values = self._get_model_values(entity)
        
        return self.audit_repo.create_audit_log(
            db=db,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation="UPDATE",
            before_values=before_values,
            after_values=after_values
        )
    
    def log_delete(
        self,
        db: Session,
        user_id: UUID,
        entity: BaseModel
    ) -> AuditLog:
        """
        Log a DELETE operation.
        
        Args:
            db: Database session
            user_id: User who performed the operation
            entity: Deleted entity
            
        Returns:
            Created AuditLog
        """
        entity_type = entity.__class__.__name__
        entity_id = entity.id
        before_values = self._get_model_values(entity)
        
        return self.audit_repo.create_audit_log(
            db=db,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation="DELETE",
            before_values=before_values,
            after_values=None
        )
    
    def log_permission_change(
        self,
        db: Session,
        user_id: UUID,
        target_user_id: UUID,
        change_type: str,
        details: Dict[str, Any]
    ) -> AuditLog:
        """
        Log a permission or role change.
        
        Args:
            db: Database session
            user_id: User who made the change
            target_user_id: User whose permissions were changed
            change_type: Type of change (e.g., "ROLE_ASSIGNED", "SCOPE_ADDED")
            details: Additional details about the change
            
        Returns:
            Created AuditLog
        """
        return self.audit_repo.create_audit_log(
            db=db,
            user_id=user_id,
            entity_type="Permission",
            entity_id=target_user_id,
            operation=change_type,
            before_values=None,
            after_values=details
        )
    
    def get_entity_history(
        self,
        db: Session,
        entity_type: str,
        entity_id: UUID
    ) -> List[AuditLog]:
        """
        Get audit history for a specific entity.
        
        Args:
            db: Database session
            entity_type: Type of entity (model name)
            entity_id: Entity ID
            
        Returns:
            List of AuditLog entries
        """
        return self.audit_repo.get_by_entity(db, entity_type, entity_id)
    
    def get_user_activity(
        self,
        db: Session,
        user_id: UUID,
        limit: Optional[int] = None
    ) -> List[AuditLog]:
        """
        Get audit logs for a specific user's actions.
        
        Args:
            db: Database session
            user_id: User ID
            limit: Optional limit on number of results
            
        Returns:
            List of AuditLog entries
        """
        logs = self.audit_repo.get_by_user(db, user_id)
        
        if limit:
            return logs[:limit]
        
        return logs
    
    def get_recent_changes(
        self,
        db: Session,
        entity_type: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get recent audit logs, optionally filtered by entity type.
        
        Args:
            db: Database session
            entity_type: Optional entity type filter
            limit: Maximum number of results
            
        Returns:
            List of AuditLog entries
        """
        if entity_type:
            logs = self.audit_repo.get_by_operation(db, entity_type)
        else:
            logs = self.audit_repo.get_all(db)
        
        # Sort by created_at descending
        logs.sort(key=lambda x: x.created_at, reverse=True)
        
        return logs[:limit]
    
    def get_changes_by_date_range(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime,
        entity_type: Optional[str] = None
    ) -> List[AuditLog]:
        """
        Get audit logs within a date range.
        
        Args:
            db: Database session
            start_date: Start of date range
            end_date: End of date range
            entity_type: Optional entity type filter
            
        Returns:
            List of AuditLog entries
        """
        logs = self.audit_repo.get_by_date_range(db, start_date, end_date)
        
        if entity_type:
            logs = [log for log in logs if log.entity_type == entity_type]
        
        return logs
    
    def get_permission_changes(
        self,
        db: Session,
        target_user_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get permission and role change audit logs.
        
        Args:
            db: Database session
            target_user_id: Optional filter for specific user
            limit: Maximum number of results
            
        Returns:
            List of AuditLog entries for permission changes
        """
        # Get all permission-related logs
        permission_logs = [
            log for log in self.audit_repo.get_all(db)
            if log.entity_type in ["Permission", "UserRole", "ScopeAssignment"]
        ]
        
        if target_user_id:
            permission_logs = [
                log for log in permission_logs
                if log.entity_id == target_user_id
            ]
        
        # Sort by created_at descending
        permission_logs.sort(key=lambda x: x.created_at, reverse=True)
        
        return permission_logs[:limit]
    
    def get_field_changes(
        self,
        db: Session,
        entity_type: str,
        entity_id: UUID,
        field_name: str
    ) -> List[Dict[str, Any]]:
        """
        Get history of changes to a specific field.
        
        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: Entity ID
            field_name: Name of the field to track
            
        Returns:
            List of change records with timestamps and values
        """
        logs = self.get_entity_history(db, entity_type, entity_id)
        
        changes = []
        for log in logs:
            change_record = {
                "timestamp": log.created_at,
                "user_id": log.user_id,
                "operation": log.operation
            }
            
            if log.before_values and field_name in log.before_values:
                change_record["before"] = log.before_values[field_name]
            
            if log.after_values and field_name in log.after_values:
                change_record["after"] = log.after_values[field_name]
            
            # Only include if the field was actually changed
            if "before" in change_record or "after" in change_record:
                changes.append(change_record)
        
        return changes
    
    def capture_before_update(
        self,
        entity: BaseModel
    ) -> Dict[str, Any]:
        """
        Capture entity state before an update for audit logging.
        
        Args:
            entity: Entity to capture
            
        Returns:
            Dictionary of current values
        """
        return self._get_model_values(entity)
    
    def create_audit_trail(
        self,
        db: Session,
        user_id: UUID,
        operation: str,
        entity_type: str,
        entity_id: UUID,
        before_values: Optional[Dict[str, Any]] = None,
        after_values: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None
    ) -> AuditLog:
        """
        Create a custom audit trail entry.
        
        Args:
            db: Database session
            user_id: User who performed the operation
            operation: Operation type
            entity_type: Type of entity
            entity_id: Entity ID
            before_values: Values before the operation
            after_values: Values after the operation
            description: Optional description
            
        Returns:
            Created AuditLog
        """
        if description and after_values is None:
            after_values = {"description": description}
        elif description and after_values:
            after_values["description"] = description
        
        return self.audit_repo.create_audit_log(
            db=db,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation=operation,
            before_values=before_values,
            after_values=after_values
        )
    
    def get_audit_summary(
        self,
        db: Session,
        entity_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get summary statistics for audit logs.
        
        Args:
            db: Database session
            entity_type: Optional entity type filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            Dictionary with summary statistics
        """
        # Get logs based on filters
        if start_date and end_date:
            logs = self.get_changes_by_date_range(db, start_date, end_date, entity_type)
        elif entity_type:
            logs = [log for log in self.audit_repo.get_all(db) if log.entity_type == entity_type]
        else:
            logs = self.audit_repo.get_all(db)
        
        # Calculate statistics
        total_changes = len(logs)
        creates = sum(1 for log in logs if log.operation == "CREATE")
        updates = sum(1 for log in logs if log.operation == "UPDATE")
        deletes = sum(1 for log in logs if log.operation == "DELETE")
        
        # Count by entity type
        entity_counts = {}
        for log in logs:
            entity_counts[log.entity_type] = entity_counts.get(log.entity_type, 0) + 1
        
        # Count by user
        user_counts = {}
        for log in logs:
            user_id_str = str(log.user_id)
            user_counts[user_id_str] = user_counts.get(user_id_str, 0) + 1
        
        return {
            "total_changes": total_changes,
            "creates": creates,
            "updates": updates,
            "deletes": deletes,
            "by_entity_type": entity_counts,
            "by_user": user_counts,
            "date_range": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            }
        }


# Create service instance
audit_service = AuditService()
