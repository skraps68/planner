"""
Scope validation service for user access control based on program/project scopes.
"""
from typing import List, Set, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User, UserRole, ScopeAssignment, ScopeType, RoleType
from app.repositories.user import user_role_repository, scope_assignment_repository
from app.repositories.project import project_repository
from app.repositories.program import program_repository


class ScopeValidatorService:
    """Service for validating and resolving user access scopes."""
    
    def __init__(self):
        self.user_role_repo = user_role_repository
        self.scope_assignment_repo = scope_assignment_repository
        self.project_repo = project_repository
        self.program_repo = program_repository
    
    def get_user_accessible_programs(
        self,
        db: Session,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get all program IDs that a user has access to.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of program IDs the user can access
        """
        accessible_programs: Set[UUID] = set()
        
        # Get all active roles for the user
        user_roles = self.user_role_repo.get_active_roles_by_user(db, user_id)
        
        for user_role in user_roles:
            # Get active scope assignments for this role
            scope_assignments = self.scope_assignment_repo.get_active_by_user_role(
                db, user_role.id
            )
            
            for scope in scope_assignments:
                if scope.scope_type == ScopeType.GLOBAL:
                    # Global scope means access to all programs
                    all_programs = self.program_repo.get_all(db)
                    accessible_programs.update([p.id for p in all_programs])
                elif scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                    # Direct program access
                    accessible_programs.add(scope.program_id)
                elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                    # Project scope gives visibility to parent program
                    project = self.project_repo.get(db, scope.project_id)
                    if project:
                        accessible_programs.add(project.program_id)
        
        return list(accessible_programs)
    
    def get_user_accessible_projects(
        self,
        db: Session,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get all project IDs that a user has access to.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of project IDs the user can access
        """
        accessible_projects: Set[UUID] = set()
        
        # Get all active roles for the user
        user_roles = self.user_role_repo.get_active_roles_by_user(db, user_id)
        
        for user_role in user_roles:
            # Get active scope assignments for this role
            scope_assignments = self.scope_assignment_repo.get_active_by_user_role(
                db, user_role.id
            )
            
            for scope in scope_assignments:
                if scope.scope_type == ScopeType.GLOBAL:
                    # Global scope means access to all projects
                    all_projects = self.project_repo.get_all(db)
                    accessible_projects.update([p.id for p in all_projects])
                elif scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                    # Program scope includes all projects in that program
                    program_projects = self.project_repo.get_by_program(
                        db, scope.program_id
                    )
                    accessible_projects.update([p.id for p in program_projects])
                elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                    # Direct project access
                    accessible_projects.add(scope.project_id)
        
        return list(accessible_projects)
    
    def can_access_program(
        self,
        db: Session,
        user_id: UUID,
        program_id: UUID
    ) -> bool:
        """
        Check if a user has access to a specific program.
        
        Args:
            db: Database session
            user_id: User ID
            program_id: Program ID to check
            
        Returns:
            True if user has access, False otherwise
        """
        accessible_programs = self.get_user_accessible_programs(db, user_id)
        return program_id in accessible_programs
    
    def can_access_project(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID
    ) -> bool:
        """
        Check if a user has access to a specific project.
        
        Args:
            db: Database session
            user_id: User ID
            project_id: Project ID to check
            
        Returns:
            True if user has access, False otherwise
        """
        accessible_projects = self.get_user_accessible_projects(db, user_id)
        return project_id in accessible_projects
    
    def has_global_scope(
        self,
        db: Session,
        user_id: UUID
    ) -> bool:
        """
        Check if a user has global scope access.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            True if user has global scope, False otherwise
        """
        user_roles = self.user_role_repo.get_active_roles_by_user(db, user_id)
        
        for user_role in user_roles:
            scope_assignments = self.scope_assignment_repo.get_active_by_user_role(
                db, user_role.id
            )
            
            for scope in scope_assignments:
                if scope.scope_type == ScopeType.GLOBAL:
                    return True
        
        return False
    
    def get_program_scope_ids(
        self,
        db: Session,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get all program IDs where user has direct program-level scope.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of program IDs with direct program scope
        """
        program_ids: Set[UUID] = set()
        
        user_roles = self.user_role_repo.get_active_roles_by_user(db, user_id)
        
        for user_role in user_roles:
            program_scopes = self.scope_assignment_repo.get_program_scopes(
                db, user_role.id
            )
            
            for scope in program_scopes:
                if scope.program_id:
                    program_ids.add(scope.program_id)
        
        return list(program_ids)
    
    def get_project_scope_ids(
        self,
        db: Session,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get all project IDs where user has direct project-level scope.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of project IDs with direct project scope
        """
        project_ids: Set[UUID] = set()
        
        user_roles = self.user_role_repo.get_active_roles_by_user(db, user_id)
        
        for user_role in user_roles:
            project_scopes = self.scope_assignment_repo.get_project_scopes(
                db, user_role.id
            )
            
            for scope in project_scopes:
                if scope.project_id:
                    project_ids.add(scope.project_id)
        
        return list(project_ids)
    
    def filter_programs_by_scope(
        self,
        db: Session,
        user_id: UUID,
        program_ids: List[UUID]
    ) -> List[UUID]:
        """
        Filter a list of program IDs to only those the user can access.
        
        Args:
            db: Database session
            user_id: User ID
            program_ids: List of program IDs to filter
            
        Returns:
            Filtered list of program IDs
        """
        accessible_programs = set(self.get_user_accessible_programs(db, user_id))
        return [pid for pid in program_ids if pid in accessible_programs]
    
    def filter_projects_by_scope(
        self,
        db: Session,
        user_id: UUID,
        project_ids: List[UUID]
    ) -> List[UUID]:
        """
        Filter a list of project IDs to only those the user can access.
        
        Args:
            db: Database session
            user_id: User ID
            project_ids: List of project IDs to filter
            
        Returns:
            Filtered list of project IDs
        """
        accessible_projects = set(self.get_user_accessible_projects(db, user_id))
        return [pid for pid in project_ids if pid in accessible_projects]
    
    def get_scope_summary(
        self,
        db: Session,
        user_id: UUID
    ) -> dict:
        """
        Get a summary of user's scope access.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with scope summary information
        """
        has_global = self.has_global_scope(db, user_id)
        
        if has_global:
            all_programs = self.program_repo.get_all(db)
            all_projects = self.project_repo.get_all(db)
            return {
                "has_global_scope": True,
                "accessible_program_count": len(all_programs),
                "accessible_project_count": len(all_projects),
                "direct_program_scopes": [],
                "direct_project_scopes": []
            }
        
        program_scopes = self.get_program_scope_ids(db, user_id)
        project_scopes = self.get_project_scope_ids(db, user_id)
        accessible_programs = self.get_user_accessible_programs(db, user_id)
        accessible_projects = self.get_user_accessible_projects(db, user_id)
        
        return {
            "has_global_scope": False,
            "accessible_program_count": len(accessible_programs),
            "accessible_project_count": len(accessible_projects),
            "direct_program_scopes": program_scopes,
            "direct_project_scopes": project_scopes
        }
    
    def validate_scope_assignment(
        self,
        db: Session,
        scope_type: ScopeType,
        program_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Validate a scope assignment configuration.
        
        Args:
            db: Database session
            scope_type: Type of scope
            program_id: Program ID (for PROGRAM scope)
            project_id: Project ID (for PROJECT scope)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if scope_type == ScopeType.GLOBAL:
            if program_id or project_id:
                return False, "Global scope should not have program_id or project_id"
            return True, None
        
        if scope_type == ScopeType.PROGRAM:
            if not program_id:
                return False, "Program scope requires program_id"
            if project_id:
                return False, "Program scope should not have project_id"
            # Verify program exists
            program = self.program_repo.get(db, program_id)
            if not program:
                return False, f"Program {program_id} does not exist"
            return True, None
        
        if scope_type == ScopeType.PROJECT:
            if not project_id:
                return False, "Project scope requires project_id"
            if program_id:
                return False, "Project scope should not have program_id"
            # Verify project exists
            project = self.project_repo.get(db, project_id)
            if not project:
                return False, f"Project {project_id} does not exist"
            return True, None
        
        return False, f"Invalid scope type: {scope_type}"


# Create service instance
scope_validator_service = ScopeValidatorService()
