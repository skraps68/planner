"""
Authorization service for role-based access control with scoped permissions.
"""
from enum import Enum
from typing import List, Optional, Set
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User, RoleType, ScopeType
from app.repositories.user import user_role_repository
from app.services.scope_validator import scope_validator_service


class Permission(str, Enum):
    """System permissions."""
    # User management
    MANAGE_USERS = "manage_users"
    MANAGE_ROLES = "manage_roles"
    
    # Program management
    CREATE_PROGRAM = "create_program"
    READ_PROGRAM = "read_program"
    UPDATE_PROGRAM = "update_program"
    DELETE_PROGRAM = "delete_program"
    
    # Project management
    CREATE_PROJECT = "create_project"
    READ_PROJECT = "read_project"
    UPDATE_PROJECT = "update_project"
    DELETE_PROJECT = "delete_project"
    
    # Resource management
    CREATE_RESOURCE = "create_resource"
    READ_RESOURCE = "read_resource"
    UPDATE_RESOURCE = "update_resource"
    DELETE_RESOURCE = "delete_resource"
    
    # Worker management
    CREATE_WORKER = "create_worker"
    READ_WORKER = "read_worker"
    UPDATE_WORKER = "update_worker"
    DELETE_WORKER = "delete_worker"
    
    # Assignment management
    CREATE_ASSIGNMENT = "create_assignment"
    READ_ASSIGNMENT = "read_assignment"
    UPDATE_ASSIGNMENT = "update_assignment"
    DELETE_ASSIGNMENT = "delete_assignment"
    
    # Actuals management
    CREATE_ACTUAL = "create_actual"
    READ_ACTUAL = "read_actual"
    UPDATE_ACTUAL = "update_actual"
    DELETE_ACTUAL = "delete_actual"
    IMPORT_ACTUALS = "import_actuals"
    
    # Financial operations
    VIEW_BUDGET = "view_budget"
    UPDATE_BUDGET = "update_budget"
    VIEW_FORECAST = "view_forecast"
    VIEW_REPORTS = "view_reports"
    
    # Audit
    VIEW_AUDIT_LOGS = "view_audit_logs"


# Role to permissions mapping
ROLE_PERMISSIONS = {
    RoleType.ADMIN: {
        # Admins have all permissions
        Permission.MANAGE_USERS,
        Permission.MANAGE_ROLES,
        Permission.CREATE_PROGRAM,
        Permission.READ_PROGRAM,
        Permission.UPDATE_PROGRAM,
        Permission.DELETE_PROGRAM,
        Permission.CREATE_PROJECT,
        Permission.READ_PROJECT,
        Permission.UPDATE_PROJECT,
        Permission.DELETE_PROJECT,
        Permission.CREATE_RESOURCE,
        Permission.READ_RESOURCE,
        Permission.UPDATE_RESOURCE,
        Permission.DELETE_RESOURCE,
        Permission.CREATE_WORKER,
        Permission.READ_WORKER,
        Permission.UPDATE_WORKER,
        Permission.DELETE_WORKER,
        Permission.CREATE_ASSIGNMENT,
        Permission.READ_ASSIGNMENT,
        Permission.UPDATE_ASSIGNMENT,
        Permission.DELETE_ASSIGNMENT,
        Permission.CREATE_ACTUAL,
        Permission.READ_ACTUAL,
        Permission.UPDATE_ACTUAL,
        Permission.DELETE_ACTUAL,
        Permission.IMPORT_ACTUALS,
        Permission.VIEW_BUDGET,
        Permission.UPDATE_BUDGET,
        Permission.VIEW_FORECAST,
        Permission.VIEW_REPORTS,
        Permission.VIEW_AUDIT_LOGS,
    },
    RoleType.PROGRAM_MANAGER: {
        # Program managers can manage programs and their projects
        Permission.CREATE_PROGRAM,
        Permission.READ_PROGRAM,
        Permission.UPDATE_PROGRAM,
        Permission.CREATE_PROJECT,
        Permission.READ_PROJECT,
        Permission.UPDATE_PROJECT,
        Permission.READ_RESOURCE,
        Permission.READ_WORKER,
        Permission.CREATE_ASSIGNMENT,
        Permission.READ_ASSIGNMENT,
        Permission.UPDATE_ASSIGNMENT,
        Permission.DELETE_ASSIGNMENT,
        Permission.READ_ACTUAL,
        Permission.IMPORT_ACTUALS,
        Permission.VIEW_BUDGET,
        Permission.UPDATE_BUDGET,
        Permission.VIEW_FORECAST,
        Permission.VIEW_REPORTS,
    },
    RoleType.PROJECT_MANAGER: {
        # Project managers can manage their projects
        Permission.READ_PROGRAM,
        Permission.READ_PROJECT,
        Permission.UPDATE_PROJECT,
        Permission.READ_RESOURCE,
        Permission.READ_WORKER,
        Permission.CREATE_ASSIGNMENT,
        Permission.READ_ASSIGNMENT,
        Permission.UPDATE_ASSIGNMENT,
        Permission.DELETE_ASSIGNMENT,
        Permission.READ_ACTUAL,
        Permission.IMPORT_ACTUALS,
        Permission.VIEW_BUDGET,
        Permission.VIEW_FORECAST,
        Permission.VIEW_REPORTS,
    },
    RoleType.FINANCE_MANAGER: {
        # Finance managers focus on financial data
        Permission.READ_PROGRAM,
        Permission.READ_PROJECT,
        Permission.READ_RESOURCE,
        Permission.READ_WORKER,
        Permission.READ_ASSIGNMENT,
        Permission.READ_ACTUAL,
        Permission.VIEW_BUDGET,
        Permission.UPDATE_BUDGET,
        Permission.VIEW_FORECAST,
        Permission.VIEW_REPORTS,
        Permission.VIEW_AUDIT_LOGS,
    },
    RoleType.RESOURCE_MANAGER: {
        # Resource managers handle resources and workers
        Permission.READ_PROGRAM,
        Permission.READ_PROJECT,
        Permission.CREATE_RESOURCE,
        Permission.READ_RESOURCE,
        Permission.UPDATE_RESOURCE,
        Permission.DELETE_RESOURCE,
        Permission.CREATE_WORKER,
        Permission.READ_WORKER,
        Permission.UPDATE_WORKER,
        Permission.DELETE_WORKER,
        Permission.CREATE_ASSIGNMENT,
        Permission.READ_ASSIGNMENT,
        Permission.UPDATE_ASSIGNMENT,
        Permission.DELETE_ASSIGNMENT,
        Permission.READ_ACTUAL,
        Permission.VIEW_REPORTS,
    },
    RoleType.VIEWER: {
        # Viewers have read-only access
        Permission.READ_PROGRAM,
        Permission.READ_PROJECT,
        Permission.READ_RESOURCE,
        Permission.READ_WORKER,
        Permission.READ_ASSIGNMENT,
        Permission.READ_ACTUAL,
        Permission.VIEW_BUDGET,
        Permission.VIEW_FORECAST,
        Permission.VIEW_REPORTS,
    },
}


class AuthorizationService:
    """Service for handling authorization and permission checks."""
    
    def __init__(self):
        self.user_role_repo = user_role_repository
        self.scope_validator = scope_validator_service
    
    def get_user_permissions(
        self,
        db: Session,
        user_id: UUID
    ) -> Set[Permission]:
        """
        Get all permissions for a user based on their active roles.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Set of permissions
        """
        permissions: Set[Permission] = set()
        
        # Get all active roles for the user
        user_roles = self.user_role_repo.get_active_roles_by_user(db, user_id)
        
        for user_role in user_roles:
            role_permissions = ROLE_PERMISSIONS.get(user_role.role_type, set())
            permissions.update(role_permissions)
        
        return permissions
    
    def has_permission(
        self,
        db: Session,
        user_id: UUID,
        permission: Permission
    ) -> bool:
        """
        Check if a user has a specific permission.
        
        Args:
            db: Database session
            user_id: User ID
            permission: Permission to check
            
        Returns:
            True if user has permission, False otherwise
        """
        user_permissions = self.get_user_permissions(db, user_id)
        return permission in user_permissions
    
    def has_any_permission(
        self,
        db: Session,
        user_id: UUID,
        permissions: List[Permission]
    ) -> bool:
        """
        Check if a user has any of the specified permissions.
        
        Args:
            db: Database session
            user_id: User ID
            permissions: List of permissions to check
            
        Returns:
            True if user has any permission, False otherwise
        """
        user_permissions = self.get_user_permissions(db, user_id)
        return any(perm in user_permissions for perm in permissions)
    
    def has_all_permissions(
        self,
        db: Session,
        user_id: UUID,
        permissions: List[Permission]
    ) -> bool:
        """
        Check if a user has all of the specified permissions.
        
        Args:
            db: Database session
            user_id: User ID
            permissions: List of permissions to check
            
        Returns:
            True if user has all permissions, False otherwise
        """
        user_permissions = self.get_user_permissions(db, user_id)
        return all(perm in user_permissions for perm in permissions)
    
    def has_role(
        self,
        db: Session,
        user_id: UUID,
        role_type: RoleType
    ) -> bool:
        """
        Check if a user has a specific role.
        
        Args:
            db: Database session
            user_id: User ID
            role_type: Role type to check
            
        Returns:
            True if user has role, False otherwise
        """
        return self.user_role_repo.has_role(db, user_id, role_type)
    
    def can_access_program(
        self,
        db: Session,
        user_id: UUID,
        program_id: UUID,
        permission: Permission
    ) -> bool:
        """
        Check if a user can perform an action on a specific program.
        
        Args:
            db: Database session
            user_id: User ID
            program_id: Program ID
            permission: Required permission
            
        Returns:
            True if user has permission and scope access, False otherwise
        """
        # Check if user has the required permission
        if not self.has_permission(db, user_id, permission):
            return False
        
        # Check if user has scope access to the program
        return self.scope_validator.can_access_program(db, user_id, program_id)
    
    def can_access_project(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID,
        permission: Permission
    ) -> bool:
        """
        Check if a user can perform an action on a specific project.
        
        Args:
            db: Database session
            user_id: User ID
            project_id: Project ID
            permission: Required permission
            
        Returns:
            True if user has permission and scope access, False otherwise
        """
        # Check if user has the required permission
        if not self.has_permission(db, user_id, permission):
            return False
        
        # Check if user has scope access to the project
        return self.scope_validator.can_access_project(db, user_id, project_id)
    
    def is_admin(
        self,
        db: Session,
        user_id: UUID
    ) -> bool:
        """
        Check if a user is an admin.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            True if user is admin, False otherwise
        """
        return self.has_role(db, user_id, RoleType.ADMIN)
    
    def get_accessible_programs_with_permission(
        self,
        db: Session,
        user_id: UUID,
        permission: Permission
    ) -> List[UUID]:
        """
        Get all programs the user can access with a specific permission.
        
        Args:
            db: Database session
            user_id: User ID
            permission: Required permission
            
        Returns:
            List of accessible program IDs
        """
        # Check if user has the required permission
        if not self.has_permission(db, user_id, permission):
            return []
        
        # Return all accessible programs
        return self.scope_validator.get_user_accessible_programs(db, user_id)
    
    def get_accessible_projects_with_permission(
        self,
        db: Session,
        user_id: UUID,
        permission: Permission
    ) -> List[UUID]:
        """
        Get all projects the user can access with a specific permission.
        
        Args:
            db: Database session
            user_id: User ID
            permission: Required permission
            
        Returns:
            List of accessible project IDs
        """
        # Check if user has the required permission
        if not self.has_permission(db, user_id, permission):
            return []
        
        # Return all accessible projects
        return self.scope_validator.get_user_accessible_projects(db, user_id)
    
    def validate_program_access(
        self,
        db: Session,
        user_id: UUID,
        program_id: UUID,
        permission: Permission
    ) -> tuple[bool, Optional[str]]:
        """
        Validate program access and return detailed error message.
        
        Args:
            db: Database session
            user_id: User ID
            program_id: Program ID
            permission: Required permission
            
        Returns:
            Tuple of (is_authorized, error_message)
        """
        # Check permission
        if not self.has_permission(db, user_id, permission):
            return False, f"User does not have required permission: {permission.value}"
        
        # Check scope access
        if not self.scope_validator.can_access_program(db, user_id, program_id):
            return False, f"User does not have access to program: {program_id}"
        
        return True, None
    
    def validate_project_access(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID,
        permission: Permission
    ) -> tuple[bool, Optional[str]]:
        """
        Validate project access and return detailed error message.
        
        Args:
            db: Database session
            user_id: User ID
            project_id: Project ID
            permission: Required permission
            
        Returns:
            Tuple of (is_authorized, error_message)
        """
        # Check permission
        if not self.has_permission(db, user_id, permission):
            return False, f"User does not have required permission: {permission.value}"
        
        # Check scope access
        if not self.scope_validator.can_access_project(db, user_id, project_id):
            return False, f"User does not have access to project: {project_id}"
        
        return True, None


# Create service instance
authorization_service = AuthorizationService()
