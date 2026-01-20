"""
Role management service for user role and scope assignment operations.
"""
from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.repositories.user import (
    user_repository,
    user_role_repository,
    scope_assignment_repository
)
from app.services.scope_validator import scope_validator_service


class RoleManagementService:
    """Service for managing user roles and scope assignments."""
    
    def __init__(self):
        self.user_repo = user_repository
        self.user_role_repo = user_role_repository
        self.scope_assignment_repo = scope_assignment_repository
        self.scope_validator = scope_validator_service
    
    def assign_role(
        self,
        db: Session,
        user_id: UUID,
        role_type: RoleType,
        is_active: bool = True
    ) -> UserRole:
        """
        Assign a role to a user.
        
        Args:
            db: Database session
            user_id: User ID
            role_type: Role type to assign
            is_active: Whether the role is active
            
        Returns:
            Created UserRole object
        """
        # Check if user exists
        user = self.user_repo.get(db, user_id)
        if not user:
            raise ValueError(f"User {user_id} does not exist")
        
        # Check if role already exists
        existing_roles = self.user_role_repo.get_by_user(db, user_id)
        for role in existing_roles:
            if role.role_type == role_type:
                # Update existing role
                role.is_active = is_active
                db.commit()
                db.refresh(role)
                return role
        
        # Create new role
        user_role = UserRole(
            user_id=user_id,
            role_type=role_type,
            is_active=is_active
        )
        db.add(user_role)
        db.commit()
        db.refresh(user_role)
        return user_role
    
    def remove_role(
        self,
        db: Session,
        user_id: UUID,
        role_type: RoleType
    ) -> bool:
        """
        Remove a role from a user (deactivate it).
        
        Args:
            db: Database session
            user_id: User ID
            role_type: Role type to remove
            
        Returns:
            True if role was removed, False if not found
        """
        user_roles = self.user_role_repo.get_by_user(db, user_id)
        
        for role in user_roles:
            if role.role_type == role_type:
                role.is_active = False
                db.commit()
                return True
        
        return False
    
    def activate_role(
        self,
        db: Session,
        user_role_id: UUID
    ) -> bool:
        """
        Activate a user role.
        
        Args:
            db: Database session
            user_role_id: UserRole ID
            
        Returns:
            True if activated, False if not found
        """
        user_role = self.user_role_repo.get(db, user_role_id)
        if not user_role:
            return False
        
        user_role.is_active = True
        db.commit()
        return True
    
    def deactivate_role(
        self,
        db: Session,
        user_role_id: UUID
    ) -> bool:
        """
        Deactivate a user role.
        
        Args:
            db: Database session
            user_role_id: UserRole ID
            
        Returns:
            True if deactivated, False if not found
        """
        user_role = self.user_role_repo.get(db, user_role_id)
        if not user_role:
            return False
        
        user_role.is_active = False
        db.commit()
        return True
    
    def assign_scope(
        self,
        db: Session,
        user_role_id: UUID,
        scope_type: ScopeType,
        program_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        is_active: bool = True
    ) -> ScopeAssignment:
        """
        Assign a scope to a user role.
        
        Args:
            db: Database session
            user_role_id: UserRole ID
            scope_type: Type of scope
            program_id: Program ID (for PROGRAM scope)
            project_id: Project ID (for PROJECT scope)
            is_active: Whether the scope is active
            
        Returns:
            Created ScopeAssignment object
            
        Raises:
            ValueError: If scope configuration is invalid
        """
        # Validate user role exists
        user_role = self.user_role_repo.get(db, user_role_id)
        if not user_role:
            raise ValueError(f"UserRole {user_role_id} does not exist")
        
        # Validate scope configuration
        is_valid, error_msg = self.scope_validator.validate_scope_assignment(
            db, scope_type, program_id, project_id
        )
        if not is_valid:
            raise ValueError(error_msg)
        
        # Create scope assignment
        scope_assignment = ScopeAssignment(
            user_role_id=user_role_id,
            scope_type=scope_type,
            program_id=program_id,
            project_id=project_id,
            is_active=is_active
        )
        db.add(scope_assignment)
        db.commit()
        db.refresh(scope_assignment)
        return scope_assignment
    
    def remove_scope(
        self,
        db: Session,
        scope_assignment_id: UUID
    ) -> bool:
        """
        Remove a scope assignment (deactivate it).
        
        Args:
            db: Database session
            scope_assignment_id: ScopeAssignment ID
            
        Returns:
            True if removed, False if not found
        """
        scope_assignment = self.scope_assignment_repo.get(db, scope_assignment_id)
        if not scope_assignment:
            return False
        
        scope_assignment.is_active = False
        db.commit()
        return True
    
    def activate_scope(
        self,
        db: Session,
        scope_assignment_id: UUID
    ) -> bool:
        """
        Activate a scope assignment.
        
        Args:
            db: Database session
            scope_assignment_id: ScopeAssignment ID
            
        Returns:
            True if activated, False if not found
        """
        scope_assignment = self.scope_assignment_repo.get(db, scope_assignment_id)
        if not scope_assignment:
            return False
        
        scope_assignment.is_active = True
        db.commit()
        return True
    
    def deactivate_scope(
        self,
        db: Session,
        scope_assignment_id: UUID
    ) -> bool:
        """
        Deactivate a scope assignment.
        
        Args:
            db: Database session
            scope_assignment_id: ScopeAssignment ID
            
        Returns:
            True if deactivated, False if not found
        """
        scope_assignment = self.scope_assignment_repo.get(db, scope_assignment_id)
        if not scope_assignment:
            return False
        
        scope_assignment.is_active = False
        db.commit()
        return True
    
    def get_user_roles(
        self,
        db: Session,
        user_id: UUID,
        active_only: bool = False
    ) -> List[UserRole]:
        """
        Get all roles for a user.
        
        Args:
            db: Database session
            user_id: User ID
            active_only: If True, return only active roles
            
        Returns:
            List of UserRole objects
        """
        if active_only:
            return self.user_role_repo.get_active_roles_by_user(db, user_id)
        return self.user_role_repo.get_by_user(db, user_id)
    
    def get_role_scopes(
        self,
        db: Session,
        user_role_id: UUID,
        active_only: bool = False
    ) -> List[ScopeAssignment]:
        """
        Get all scope assignments for a user role.
        
        Args:
            db: Database session
            user_role_id: UserRole ID
            active_only: If True, return only active scopes
            
        Returns:
            List of ScopeAssignment objects
        """
        if active_only:
            return self.scope_assignment_repo.get_active_by_user_role(db, user_role_id)
        return self.scope_assignment_repo.get_by_user_role(db, user_role_id)
    
    def get_user_role_summary(
        self,
        db: Session,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Get a comprehensive summary of user's roles and scopes.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with role and scope information
        """
        user = self.user_repo.get(db, user_id)
        if not user:
            raise ValueError(f"User {user_id} does not exist")
        
        roles = self.get_user_roles(db, user_id, active_only=True)
        
        role_details = []
        for role in roles:
            scopes = self.get_role_scopes(db, role.id, active_only=True)
            
            scope_details = []
            for scope in scopes:
                scope_info = {
                    "id": str(scope.id),
                    "scope_type": scope.scope_type.value,
                    "is_active": scope.is_active
                }
                
                if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                    scope_info["program_id"] = str(scope.program_id)
                elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                    scope_info["project_id"] = str(scope.project_id)
                
                scope_details.append(scope_info)
            
            role_details.append({
                "id": str(role.id),
                "role_type": role.role_type.value,
                "is_active": role.is_active,
                "scopes": scope_details
            })
        
        # Get scope summary
        scope_summary = self.scope_validator.get_scope_summary(db, user_id)
        
        return {
            "user_id": str(user_id),
            "username": user.username,
            "email": user.email,
            "is_active": user.is_active,
            "roles": role_details,
            "scope_summary": scope_summary
        }
    
    def switch_active_role(
        self,
        db: Session,
        user_id: UUID,
        target_role_type: RoleType
    ) -> bool:
        """
        Switch user's active role (for multi-role users).
        This is a UI concept - all roles remain active in the database,
        but the application can track which role is "current" for the session.
        
        Args:
            db: Database session
            user_id: User ID
            target_role_type: Role type to switch to
            
        Returns:
            True if user has the target role, False otherwise
        """
        # Verify user has the target role
        return self.user_role_repo.has_role(db, user_id, target_role_type)
    
    def validate_role_scope_combination(
        self,
        db: Session,
        user_id: UUID,
        role_type: RoleType,
        scope_type: ScopeType,
        program_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Validate if a role-scope combination is valid and doesn't conflict.
        
        Args:
            db: Database session
            user_id: User ID
            role_type: Role type
            scope_type: Scope type
            program_id: Program ID (for PROGRAM scope)
            project_id: Project ID (for PROJECT scope)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate scope configuration
        is_valid, error_msg = self.scope_validator.validate_scope_assignment(
            db, scope_type, program_id, project_id
        )
        if not is_valid:
            return False, error_msg
        
        # Check if user exists
        user = self.user_repo.get(db, user_id)
        if not user:
            return False, f"User {user_id} does not exist"
        
        # Admin with global scope is always valid
        if role_type == RoleType.ADMIN and scope_type == ScopeType.GLOBAL:
            return True, None
        
        # All other combinations are valid
        return True, None
    
    def bulk_assign_scope_to_role(
        self,
        db: Session,
        user_role_id: UUID,
        program_ids: Optional[List[UUID]] = None,
        project_ids: Optional[List[UUID]] = None
    ) -> List[ScopeAssignment]:
        """
        Bulk assign multiple scopes to a user role.
        
        Args:
            db: Database session
            user_role_id: UserRole ID
            program_ids: List of program IDs to assign
            project_ids: List of project IDs to assign
            
        Returns:
            List of created ScopeAssignment objects
        """
        created_scopes = []
        
        # Assign program scopes
        if program_ids:
            for program_id in program_ids:
                try:
                    scope = self.assign_scope(
                        db, user_role_id, ScopeType.PROGRAM, program_id=program_id
                    )
                    created_scopes.append(scope)
                except ValueError as e:
                    # Log error but continue with other assignments
                    print(f"Error assigning program scope {program_id}: {e}")
        
        # Assign project scopes
        if project_ids:
            for project_id in project_ids:
                try:
                    scope = self.assign_scope(
                        db, user_role_id, ScopeType.PROJECT, project_id=project_id
                    )
                    created_scopes.append(scope)
                except ValueError as e:
                    # Log error but continue with other assignments
                    print(f"Error assigning project scope {project_id}: {e}")
        
        return created_scopes


# Create service instance
role_management_service = RoleManagementService()
