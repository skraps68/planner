"""
User management API endpoints for CRUD operations, role assignment, and scope management.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.api.deps import get_db, get_current_active_user
from app.models.user import User, RoleType, ScopeType
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    UserRoleCreate,
    UserRoleUpdate,
    UserRoleResponse,
    ScopeAssignmentCreate,
    ScopeAssignmentUpdate,
    ScopeAssignmentResponse,
    CurrentUserResponse
)
from app.repositories.user import user_repository, user_role_repository, scope_assignment_repository
from app.services.authentication import authentication_service
from app.services.authorization import authorization_service, Permission
from app.services.role_management import role_management_service
from app.services.audit import audit_service
from app.core.exceptions import ConflictError

router = APIRouter()


def check_admin_access(current_user: User, db: Session):
    """Helper to check if user has admin access."""
    if not authorization_service.is_admin(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required"
        )


@router.get("", response_model=UserListResponse, status_code=status.HTTP_200_OK)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all users (admin only).
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        is_active: Filter by active status
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Paginated list of users
    """
    check_admin_access(current_user, db)
    
    # Get users
    users = user_repository.get_all(db)
    
    # Apply filters
    if is_active is not None:
        users = [u for u in users if u.is_active == is_active]
    
    # Apply pagination
    total = len(users)
    users = users[skip:skip + limit]
    
    # Convert to response models
    user_responses = []
    for user in users:
        user_roles = role_management_service.get_user_roles(db, user.id, active_only=True)
        role_responses = []
        
        for role in user_roles:
            scopes = role_management_service.get_role_scopes(db, role.id, active_only=True)
            scope_responses = []
            
            for scope in scopes:
                scope_name = None
                if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                    from app.repositories.program import program_repository
                    program = program_repository.get(db, scope.program_id)
                    scope_name = program.name if program else None
                elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                    from app.repositories.project import project_repository
                    project = project_repository.get(db, scope.project_id)
                    scope_name = project.name if project else None
                
                scope_responses.append(ScopeAssignmentResponse(
                    id=scope.id,
                    user_role_id=scope.user_role_id,
                    scope_type=scope.scope_type,
                    program_id=scope.program_id,
                    project_id=scope.project_id,
                    is_active=scope.is_active,
                    program_name=scope_name if scope.scope_type == ScopeType.PROGRAM else None,
                    project_name=scope_name if scope.scope_type == ScopeType.PROJECT else None,
                    created_at=scope.created_at,
                    updated_at=scope.updated_at
                ))
            
            role_responses.append(UserRoleResponse(
                id=role.id,
                user_id=role.user_id,
                role_type=role.role_type,
                is_active=role.is_active,
                scope_assignments=scope_responses,
                created_at=role.created_at,
                updated_at=role.updated_at
            ))
        
        user_responses.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            user_roles=role_responses,
            created_at=user.created_at,
            updated_at=user.updated_at
        ))
    
    # Calculate pagination
    page = (skip // limit) + 1 if limit > 0 else 1
    pages = (total + limit - 1) // limit if limit > 0 else 1
    has_next = skip + limit < total
    has_prev = skip > 0
    
    return UserListResponse(
        items=user_responses,
        total=total,
        page=page,
        size=limit,
        pages=pages,
        has_next=has_next,
        has_prev=has_prev
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new user (admin only).
    
    Args:
        user_data: User creation data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Created user
        
    Raises:
        HTTPException: If username or email already exists
    """
    check_admin_access(current_user, db)
    
    # Check if username exists
    existing_user = user_repository.get_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email exists
    existing_email = user_repository.get_by_email(db, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    # Create user
    user = authentication_service.create_user(
        db,
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        is_active=user_data.is_active
    )
    
    # Log audit trail
    audit_service.log_create(db, current_user.id, user)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        user_roles=[],
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user by ID (admin only or own user).
    
    Args:
        user_id: User ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        User details
        
    Raises:
        HTTPException: If user not found or access denied
    """
    # Allow users to view their own profile
    if user_id != current_user.id:
        check_admin_access(current_user, db)
    
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user roles and scopes
    user_roles = role_management_service.get_user_roles(db, user.id, active_only=False)
    role_responses = []
    
    for role in user_roles:
        scopes = role_management_service.get_role_scopes(db, role.id, active_only=False)
        scope_responses = []
        
        for scope in scopes:
            scope_name = None
            if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                from app.repositories.program import program_repository
                program = program_repository.get(db, scope.program_id)
                scope_name = program.name if program else None
            elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                from app.repositories.project import project_repository
                project = project_repository.get(db, scope.project_id)
                scope_name = project.name if project else None
            
            scope_responses.append(ScopeAssignmentResponse(id=scope.id, 
                user_role_id=scope.user_role_id,
                scope_type=scope.scope_type,
                program_id=scope.program_id,
                project_id=scope.project_id,
                is_active=scope.is_active,
                program_name=scope_name if scope.scope_type == ScopeType.PROGRAM else None,
                project_name=scope_name if scope.scope_type == ScopeType.PROJECT else None,
                created_at=scope.created_at,
                updated_at=scope.updated_at
            ))
        
        role_responses.append(UserRoleResponse(id=role.id, 
            user_id=role.user_id,
            role_type=role.role_type,
            is_active=role.is_active,
            scope_assignments=scope_responses,
            created_at=role.created_at,
            updated_at=role.updated_at
        ))
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        user_roles=role_responses,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user (admin only).
    
    Args:
        user_id: User ID
        user_data: User update data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Updated user
        
    Raises:
        HTTPException: If user not found
    """
    check_admin_access(current_user, db)
    
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Capture before values for audit
        before_values = audit_service.capture_before_update(user)
        
        # Update user
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        db.commit()
        db.refresh(user)
        
        # Log audit trail
        audit_service.log_update(db, current_user.id, user, before_values)
        
        # Get user roles
        user_roles = role_management_service.get_user_roles(db, user.id, active_only=False)
        role_responses = []
        
        for role in user_roles:
            scopes = role_management_service.get_role_scopes(db, role.id, active_only=False)
            scope_responses = [
                ScopeAssignmentResponse(id=scope.id, 
                    user_role_id=scope.user_role_id,
                    scope_type=scope.scope_type,
                    program_id=scope.program_id,
                    project_id=scope.project_id,
                    is_active=scope.is_active,
                    created_at=scope.created_at,
                    updated_at=scope.updated_at
                )
                for scope in scopes
            ]
            
            role_responses.append(UserRoleResponse(id=role.id, 
                user_id=role.user_id,
                role_type=role.role_type,
                is_active=role.is_active,
                scope_assignments=scope_responses,
                created_at=role.created_at,
                updated_at=role.updated_at
            ))
        
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            user_roles=role_responses,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        db.rollback()
        current_user_obj = user_repository.get(db, user_id)
        if current_user_obj:
            current_state = UserResponse.model_validate(current_user_obj).model_dump()
            raise ConflictError("user", str(user_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete user (admin only). This is a soft delete (deactivate).
    
    Args:
        user_id: User ID
        current_user: Current authenticated user
        db: Database session
        
    Raises:
        HTTPException: If user not found or trying to delete self
    """
    check_admin_access(current_user, db)
    
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Soft delete - deactivate user
    before_values = audit_service.capture_before_update(user)
    user.is_active = False
    db.commit()
    
    # Log audit trail
    audit_service.log_update(db, current_user.id, user, before_values)


# Role management endpoints

@router.post("/{user_id}/roles", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
def assign_role_to_user(
    user_id: UUID,
    role_data: UserRoleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Assign a role to a user (admin only).
    
    Args:
        user_id: User ID
        role_data: Role assignment data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Created user role
        
    Raises:
        HTTPException: If user not found
    """
    check_admin_access(current_user, db)
    
    # Verify user exists
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Assign role
    try:
        user_role = role_management_service.assign_role(
            db,
            user_id=user_id,
            role_type=role_data.role_type,
            is_active=role_data.is_active
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Log audit trail
    audit_service.log_permission_change(
        db,
        current_user.id,
        user_id,
        "ROLE_ASSIGNED",
        {"role_type": role_data.role_type.value, "is_active": role_data.is_active}
    )
    
    return UserRoleResponse(
        id=user_role.id,
        user_id=user_role.user_id,
        role_type=user_role.role_type,
        is_active=user_role.is_active,
        scope_assignments=[],
        created_at=user_role.created_at,
        updated_at=user_role.updated_at
    )


@router.get("/{user_id}/roles", response_model=List[UserRoleResponse], status_code=status.HTTP_200_OK)
def get_user_roles(
    user_id: UUID,
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all roles for a user (admin only or own user).
    
    Args:
        user_id: User ID
        active_only: Return only active roles
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of user roles
    """
    # Allow users to view their own roles
    if user_id != current_user.id:
        check_admin_access(current_user, db)
    
    user_roles = role_management_service.get_user_roles(db, user_id, active_only=active_only)
    
    role_responses = []
    for role in user_roles:
        scopes = role_management_service.get_role_scopes(db, role.id, active_only=active_only)
        scope_responses = []
        
        for scope in scopes:
            scope_name = None
            if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                from app.repositories.program import program_repository
                program = program_repository.get(db, scope.program_id)
                scope_name = program.name if program else None
            elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                from app.repositories.project import project_repository
                project = project_repository.get(db, scope.project_id)
                scope_name = project.name if project else None
            
            scope_responses.append(ScopeAssignmentResponse(id=scope.id, 
                user_role_id=scope.user_role_id,
                scope_type=scope.scope_type,
                program_id=scope.program_id,
                project_id=scope.project_id,
                is_active=scope.is_active,
                program_name=scope_name if scope.scope_type == ScopeType.PROGRAM else None,
                project_name=scope_name if scope.scope_type == ScopeType.PROJECT else None,
                created_at=scope.created_at,
                updated_at=scope.updated_at
            ))
        
        role_responses.append(UserRoleResponse(id=role.id, 
            user_id=role.user_id,
            role_type=role.role_type,
            is_active=role.is_active,
            scope_assignments=scope_responses,
            created_at=role.created_at,
            updated_at=role.updated_at
        ))
    
    return role_responses


@router.delete("/{user_id}/roles/{role_type}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role_from_user(
    user_id: UUID,
    role_type: RoleType,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Remove a role from a user (admin only).
    
    Args:
        user_id: User ID
        role_type: Role type to remove
        current_user: Current authenticated user
        db: Database session
        
    Raises:
        HTTPException: If role not found
    """
    check_admin_access(current_user, db)
    
    success = role_management_service.remove_role(db, user_id, role_type)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found for user"
        )
    
    # Log audit trail
    audit_service.log_permission_change(
        db,
        current_user.id,
        user_id,
        "ROLE_REMOVED",
        {"role_type": role_type.value}
    )


# Scope assignment endpoints

@router.post("/roles/{user_role_id}/scopes", response_model=ScopeAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_scope_to_role(
    user_role_id: UUID,
    scope_data: ScopeAssignmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Assign a scope to a user role (admin only).
    
    Args:
        user_role_id: User role ID
        scope_data: Scope assignment data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Created scope assignment
        
    Raises:
        HTTPException: If user role not found or scope invalid
    """
    check_admin_access(current_user, db)
    
    # Assign scope
    try:
        scope_assignment = role_management_service.assign_scope(
            db,
            user_role_id=user_role_id,
            scope_type=scope_data.scope_type,
            program_id=scope_data.program_id,
            project_id=scope_data.project_id,
            is_active=scope_data.is_active
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Get scope name
    scope_name = None
    if scope_assignment.scope_type == ScopeType.PROGRAM and scope_assignment.program_id:
        from app.repositories.program import program_repository
        program = program_repository.get(db, scope_assignment.program_id)
        scope_name = program.name if program else None
    elif scope_assignment.scope_type == ScopeType.PROJECT and scope_assignment.project_id:
        from app.repositories.project import project_repository
        project = project_repository.get(db, scope_assignment.project_id)
        scope_name = project.name if project else None
    
    # Log audit trail
    user_role = user_role_repository.get(db, user_role_id)
    if user_role:
        audit_service.log_permission_change(
            db,
            current_user.id,
            user_role.user_id,
            "SCOPE_ASSIGNED",
            {
                "scope_type": scope_data.scope_type.value,
                "program_id": str(scope_data.program_id) if scope_data.program_id else None,
                "project_id": str(scope_data.project_id) if scope_data.project_id else None
            }
        )
    
    return ScopeAssignmentResponse(
        id=scope_assignment.id,
        user_role_id=scope_assignment.user_role_id,
        scope_type=scope_assignment.scope_type,
        program_id=scope_assignment.program_id,
        project_id=scope_assignment.project_id,
        is_active=scope_assignment.is_active,
        program_name=scope_name if scope_assignment.scope_type == ScopeType.PROGRAM else None,
        project_name=scope_name if scope_assignment.scope_type == ScopeType.PROJECT else None,
        created_at=scope_assignment.created_at,
        updated_at=scope_assignment.updated_at
    )


@router.get("/roles/{user_role_id}/scopes", response_model=List[ScopeAssignmentResponse], status_code=status.HTTP_200_OK)
def get_role_scopes(
    user_role_id: UUID,
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all scope assignments for a user role (admin only).
    
    Args:
        user_role_id: User role ID
        active_only: Return only active scopes
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of scope assignments
    """
    check_admin_access(current_user, db)
    
    scopes = role_management_service.get_role_scopes(db, user_role_id, active_only=active_only)
    
    scope_responses = []
    for scope in scopes:
        scope_name = None
        if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
            from app.repositories.program import program_repository
            program = program_repository.get(db, scope.program_id)
            scope_name = program.name if program else None
        elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
            from app.repositories.project import project_repository
            project = project_repository.get(db, scope.project_id)
            scope_name = project.name if project else None
        
        scope_responses.append(ScopeAssignmentResponse(id=scope.id, 
            user_role_id=scope.user_role_id,
            scope_type=scope.scope_type,
            program_id=scope.program_id,
            project_id=scope.project_id,
            is_active=scope.is_active,
            program_name=scope_name if scope.scope_type == ScopeType.PROGRAM else None,
            project_name=scope_name if scope.scope_type == ScopeType.PROJECT else None,
            created_at=scope.created_at,
            updated_at=scope.updated_at
        ))
    
    return scope_responses


@router.delete("/scopes/{scope_assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_scope_assignment(
    scope_assignment_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Remove a scope assignment (admin only).
    
    Args:
        scope_assignment_id: Scope assignment ID
        current_user: Current authenticated user
        db: Database session
        
    Raises:
        HTTPException: If scope assignment not found
    """
    check_admin_access(current_user, db)
    
    # Get scope assignment for audit
    scope_assignment = scope_assignment_repository.get(db, scope_assignment_id)
    if not scope_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scope assignment not found"
        )
    
    # Get user role for audit
    user_role = user_role_repository.get(db, scope_assignment.user_role_id)
    
    success = role_management_service.remove_scope(db, scope_assignment_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scope assignment not found"
        )
    
    # Log audit trail
    if user_role:
        audit_service.log_permission_change(
            db,
            current_user.id,
            user_role.user_id,
            "SCOPE_REMOVED",
            {
                "scope_type": scope_assignment.scope_type.value,
                "program_id": str(scope_assignment.program_id) if scope_assignment.program_id else None,
                "project_id": str(scope_assignment.project_id) if scope_assignment.project_id else None
            }
        )
