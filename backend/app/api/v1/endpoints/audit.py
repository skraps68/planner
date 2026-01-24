"""
Audit trail API endpoints for querying audit logs and activity history.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditLogFilters,
    EntityChangesSummary,
    UserActivitySummary
)
from app.services.authorization import authorization_service, Permission
from app.services.audit import audit_service
from app.repositories.user import user_repository

router = APIRouter()


def check_audit_access(current_user: User, db: Session):
    """Helper to check if user has audit log access."""
    if not authorization_service.has_permission(db, current_user.id, Permission.VIEW_AUDIT_LOGS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view audit logs"
        )


@router.get("", response_model=AuditLogListResponse, status_code=status.HTTP_200_OK)
def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[UUID] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[UUID] = Query(None),
    operation: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List audit logs with optional filters.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        user_id: Filter by user ID
        entity_type: Filter by entity type
        entity_id: Filter by entity ID
        operation: Filter by operation type
        start_date: Filter by start date (ISO format)
        end_date: Filter by end date (ISO format)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Paginated list of audit logs
    """
    check_audit_access(current_user, db)
    
    # Get audit logs based on filters
    if start_date and end_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
            logs = audit_service.get_changes_by_date_range(db, start_dt, end_dt, entity_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"
            )
    elif entity_type and entity_id:
        logs = audit_service.get_entity_history(db, entity_type, entity_id)
    elif user_id:
        logs = audit_service.get_user_activity(db, user_id)
    else:
        logs = audit_service.get_recent_changes(db, entity_type, limit=1000)
    
    # Apply additional filters
    if user_id and not (entity_type and entity_id):
        logs = [log for log in logs if log.user_id == user_id]
    
    if operation:
        logs = [log for log in logs if log.operation == operation]
    
    # Apply pagination
    total = len(logs)
    logs = logs[skip:skip + limit]
    
    # Convert to response models
    log_responses = []
    for log in logs:
        # Get username
        user = user_repository.get(db, log.user_id)
        username = user.username if user else None
        
        log_responses.append(AuditLogResponse(id=log.id, 
            user_id=log.user_id,
            username=username,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            operation=log.operation,
            before_values=log.before_values,
            after_values=log.after_values,
            created_at=log.created_at,
            updated_at=log.updated_at
        ))
    
    # Calculate pagination
    page = (skip // limit) + 1 if limit > 0 else 1
    pages = (total + limit - 1) // limit if limit > 0 else 1
    has_next = skip + limit < total
    has_prev = skip > 0
    
    return AuditLogListResponse(
        items=log_responses,
        total=total,
        page=page,
        size=limit,
        pages=pages,
        has_next=has_next,
        has_prev=has_prev
    )


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[AuditLogResponse], status_code=status.HTTP_200_OK)
def get_entity_audit_history(
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get complete audit history for a specific entity.
    
    Args:
        entity_type: Type of entity (model name)
        entity_id: Entity ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of audit logs for the entity
    """
    check_audit_access(current_user, db)
    
    logs = audit_service.get_entity_history(db, entity_type, entity_id)
    
    # Convert to response models
    log_responses = []
    for log in logs:
        # Get username
        user = user_repository.get(db, log.user_id)
        username = user.username if user else None
        
        log_responses.append(AuditLogResponse(id=log.id, 
            user_id=log.user_id,
            username=username,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            operation=log.operation,
            before_values=log.before_values,
            after_values=log.after_values,
            created_at=log.created_at,
            updated_at=log.updated_at
        ))
    
    return log_responses


@router.get("/user/{user_id}", response_model=List[AuditLogResponse], status_code=status.HTTP_200_OK)
def get_user_audit_activity(
    user_id: UUID,
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get audit activity for a specific user.
    
    Args:
        user_id: User ID
        limit: Maximum number of records to return
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of audit logs for the user's actions
    """
    check_audit_access(current_user, db)
    
    logs = audit_service.get_user_activity(db, user_id, limit=limit)
    
    # Convert to response models
    log_responses = []
    for log in logs:
        # Get username
        user = user_repository.get(db, log.user_id)
        username = user.username if user else None
        
        log_responses.append(AuditLogResponse(id=log.id, 
            user_id=log.user_id,
            username=username,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            operation=log.operation,
            before_values=log.before_values,
            after_values=log.after_values,
            created_at=log.created_at,
            updated_at=log.updated_at
        ))
    
    return log_responses


@router.get("/permissions", response_model=List[AuditLogResponse], status_code=status.HTTP_200_OK)
def get_permission_changes(
    user_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get audit logs for permission and role changes.
    
    Args:
        user_id: Optional filter for specific user
        limit: Maximum number of records to return
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of permission change audit logs
    """
    check_audit_access(current_user, db)
    
    logs = audit_service.get_permission_changes(db, user_id, limit=limit)
    
    # Convert to response models
    log_responses = []
    for log in logs:
        # Get username
        user = user_repository.get(db, log.user_id)
        username = user.username if user else None
        
        log_responses.append(AuditLogResponse(id=log.id, 
            user_id=log.user_id,
            username=username,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            operation=log.operation,
            before_values=log.before_values,
            after_values=log.after_values,
            created_at=log.created_at,
            updated_at=log.updated_at
        ))
    
    return log_responses


@router.get("/entity/{entity_type}/{entity_id}/field/{field_name}", status_code=status.HTTP_200_OK)
def get_field_change_history(
    entity_type: str,
    entity_id: UUID,
    field_name: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get change history for a specific field of an entity.
    
    Args:
        entity_type: Type of entity (model name)
        entity_id: Entity ID
        field_name: Name of the field to track
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of changes to the field with timestamps and values
    """
    check_audit_access(current_user, db)
    
    changes = audit_service.get_field_changes(db, entity_type, entity_id, field_name)
    
    # Add username to each change
    for change in changes:
        user = user_repository.get(db, change["user_id"])
        change["username"] = user.username if user else None
        # Convert datetime to ISO format
        if isinstance(change["timestamp"], datetime):
            change["timestamp"] = change["timestamp"].isoformat()
    
    return changes


@router.get("/summary", status_code=status.HTTP_200_OK)
def get_audit_summary(
    entity_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for audit logs.
    
    Args:
        entity_type: Optional entity type filter
        start_date: Optional start date filter (ISO format)
        end_date: Optional end date filter (ISO format)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Summary statistics
    """
    check_audit_access(current_user, db)
    
    # Parse dates if provided
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"
            )
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"
            )
    
    summary = audit_service.get_audit_summary(db, entity_type, start_dt, end_dt)
    
    return summary


@router.get("/recent", response_model=List[AuditLogResponse], status_code=status.HTTP_200_OK)
def get_recent_changes(
    limit: int = Query(50, ge=1, le=500),
    entity_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get recent audit logs across the system.
    
    Args:
        limit: Maximum number of records to return
        entity_type: Optional entity type filter
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of recent audit logs
    """
    check_audit_access(current_user, db)
    
    logs = audit_service.get_recent_changes(db, entity_type, limit=limit)
    
    # Convert to response models
    log_responses = []
    for log in logs:
        # Get username
        user = user_repository.get(db, log.user_id)
        username = user.username if user else None
        
        log_responses.append(AuditLogResponse(id=log.id, 
            user_id=log.user_id,
            username=username,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            operation=log.operation,
            before_values=log.before_values,
            after_values=log.after_values,
            created_at=log.created_at,
            updated_at=log.updated_at
        ))
    
    return log_responses


@router.get("/user/{user_id}/summary", response_model=UserActivitySummary, status_code=status.HTTP_200_OK)
def get_user_activity_summary(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get activity summary for a specific user.
    
    Args:
        user_id: User ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        User activity summary with statistics
    """
    check_audit_access(current_user, db)
    
    # Get user
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get all activity for user
    logs = audit_service.get_user_activity(db, user_id)
    
    if not logs:
        return UserActivitySummary(
            user_id=user_id,
            username=user.username,
            total_actions=0,
            first_action=datetime.utcnow().isoformat(),
            last_action=datetime.utcnow().isoformat(),
            operations={},
            entities_modified={}
        )
    
    # Calculate statistics
    total_actions = len(logs)
    first_action = min(log.created_at for log in logs)
    last_action = max(log.created_at for log in logs)
    
    # Count by operation
    operations = {}
    for log in logs:
        operations[log.operation] = operations.get(log.operation, 0) + 1
    
    # Count by entity type
    entities_modified = {}
    for log in logs:
        entities_modified[log.entity_type] = entities_modified.get(log.entity_type, 0) + 1
    
    return UserActivitySummary(
        user_id=user_id,
        username=user.username,
        total_actions=total_actions,
        first_action=first_action.isoformat(),
        last_action=last_action.isoformat(),
        operations=operations,
        entities_modified=entities_modified
    )


@router.get("/entity/{entity_type}/{entity_id}/summary", response_model=EntityChangesSummary, status_code=status.HTTP_200_OK)
def get_entity_changes_summary(
    entity_type: str,
    entity_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get changes summary for a specific entity.
    
    Args:
        entity_type: Type of entity (model name)
        entity_id: Entity ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Entity changes summary with statistics
    """
    check_audit_access(current_user, db)
    
    # Get entity history
    logs = audit_service.get_entity_history(db, entity_type, entity_id)
    
    if not logs:
        return EntityChangesSummary(
            entity_type=entity_type,
            entity_id=entity_id,
            total_changes=0,
            first_change=datetime.utcnow().isoformat(),
            last_change=datetime.utcnow().isoformat(),
            operations={}
        )
    
    # Calculate statistics
    total_changes = len(logs)
    first_change = min(log.created_at for log in logs)
    last_change = max(log.created_at for log in logs)
    
    # Count by operation
    operations = {}
    for log in logs:
        operations[log.operation] = operations.get(log.operation, 0) + 1
    
    return EntityChangesSummary(
        entity_type=entity_type,
        entity_id=entity_id,
        total_changes=total_changes,
        first_change=first_change.isoformat(),
        last_change=last_change.isoformat(),
        operations=operations
    )
