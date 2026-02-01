"""
Project and Phase services for business logic operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import Project, ProjectPhase
from app.repositories.project import project_repository, project_phase_repository
from app.repositories.program import program_repository
from app.services.phase_service import phase_service


class ProjectService:
    """Service for project business logic."""
    
    def __init__(self):
        self.repository = project_repository
        self.phase_repository = project_phase_repository
        self.program_repository = program_repository
    
    def create_project(
        self,
        db: Session,
        program_id: UUID,
        name: str,
        business_sponsor: str,
        project_manager: str,
        technical_lead: str,
        start_date: date,
        end_date: date,
        cost_center_code: str,
        description: Optional[str] = None,
        execution_capital_budget: Optional[Decimal] = None,
        execution_expense_budget: Optional[Decimal] = None,
        planning_capital_budget: Optional[Decimal] = None,
        planning_expense_budget: Optional[Decimal] = None
    ) -> Project:
        """
        Create a new project with validation and automatic default phase creation.
        
        Args:
            db: Database session
            program_id: Parent program ID
            name: Project name
            business_sponsor: Business sponsor name
            project_manager: Project manager name
            technical_lead: Technical lead name
            start_date: Project start date
            end_date: Project end date
            cost_center_code: Unique cost center code
            description: Optional project description
            execution_capital_budget: Deprecated - ignored
            execution_expense_budget: Deprecated - ignored
            planning_capital_budget: Deprecated - ignored
            planning_expense_budget: Deprecated - ignored
            
        Returns:
            Created project with default phase
            
        Raises:
            ValueError: If validation fails
        """
        # Validate program exists
        program = self.program_repository.get(db, program_id)
        if not program:
            raise ValueError(f"Program with ID {program_id} not found")
        
        # Validate date constraints
        if start_date >= end_date:
            raise ValueError("Start date must be before end date")
        
        # Check for duplicate cost center code
        existing = self.repository.get_by_cost_center(db, cost_center_code)
        if existing:
            raise ValueError(f"Project with cost center code '{cost_center_code}' already exists")
        
        # Create project
        project_data = {
            "program_id": program_id,
            "name": name,
            "business_sponsor": business_sponsor,
            "project_manager": project_manager,
            "technical_lead": technical_lead,
            "start_date": start_date,
            "end_date": end_date,
            "cost_center_code": cost_center_code,
            "description": description
        }
        
        project = self.repository.create(db, obj_in=project_data)
        
        # Create default phase automatically
        phase_service.create_default_phase(
            db=db,
            project_id=project.id,
            project_start=start_date,
            project_end=end_date
        )
        
        # Refresh to get phases
        db.refresh(project)
        return project
    
    def get_project(self, db: Session, project_id: UUID) -> Optional[Project]:
        """Get project by ID."""
        return self.repository.get(db, project_id)
    
    def get_project_by_cost_center(self, db: Session, cost_center_code: str) -> Optional[Project]:
        """Get project by cost center code."""
        return self.repository.get_by_cost_center(db, cost_center_code)
    
    def list_projects(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        program_id: Optional[UUID] = None,
        active_only: bool = False,
        as_of_date: Optional[date] = None
    ) -> List[Project]:
        """
        List projects with optional filtering.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            program_id: Optional filter by program
            active_only: If True, only return active projects
            as_of_date: Date to check for active projects (default: today)
            
        Returns:
            List of projects
        """
        if program_id:
            projects = self.repository.get_by_program(db, program_id)
            if active_only:
                if as_of_date is None:
                    as_of_date = date.today()
                projects = [p for p in projects if p.start_date <= as_of_date <= p.end_date]
            return projects[skip:skip + limit]
        elif active_only:
            return self.repository.get_active_projects(db, as_of_date)
        else:
            return self.repository.get_multi(db, skip=skip, limit=limit)
    
    def update_project(
        self,
        db: Session,
        project_id: UUID,
        name: Optional[str] = None,
        business_sponsor: Optional[str] = None,
        project_manager: Optional[str] = None,
        technical_lead: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        cost_center_code: Optional[str] = None,
        description: Optional[str] = None
    ) -> Project:
        """
        Update project with validation and automatic default phase date synchronization.
        
        Args:
            db: Database session
            project_id: Project ID to update
            name: Optional new name
            business_sponsor: Optional new business sponsor
            project_manager: Optional new project manager
            technical_lead: Optional new technical lead
            start_date: Optional new start date
            end_date: Optional new end date
            cost_center_code: Optional new cost center code
            description: Optional new description
            
        Returns:
            Updated project
            
        Raises:
            ValueError: If validation fails or project not found
        """
        # Get existing project
        project = self.repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Build update data
        update_data = {}
        
        if name is not None:
            update_data["name"] = name
        
        if business_sponsor is not None:
            update_data["business_sponsor"] = business_sponsor
        
        if project_manager is not None:
            update_data["project_manager"] = project_manager
        
        if technical_lead is not None:
            update_data["technical_lead"] = technical_lead
        
        if description is not None:
            update_data["description"] = description
        
        if cost_center_code is not None:
            # Check for duplicate cost center code (excluding current project)
            existing = self.repository.get_by_cost_center(db, cost_center_code)
            if existing and existing.id != project_id:
                raise ValueError(f"Project with cost center code '{cost_center_code}' already exists")
            update_data["cost_center_code"] = cost_center_code
        
        # Handle date updates with validation
        new_start = start_date if start_date is not None else project.start_date
        new_end = end_date if end_date is not None else project.end_date
        
        phase_adjustments = []  # Track phase adjustments for user notification
        
        if start_date is not None or end_date is not None:
            if new_start >= new_end:
                raise ValueError("Start date must be before end date")
            
            if start_date is not None:
                update_data["start_date"] = start_date
            if end_date is not None:
                update_data["end_date"] = end_date
            
            # Get all phases for this project
            phases = self.phase_repository.get_by_project(db, project_id)
            
            if len(phases) == 1 and phases[0].name == "Default Phase":
                # Sync default phase dates if only default phase exists
                default_phase = phases[0]
                phase_update_data = {
                    "start_date": new_start,
                    "end_date": new_end
                }
                self.phase_repository.update(db, db_obj=default_phase, obj_in=phase_update_data)
                phase_adjustments.append({
                    "phase_name": "Default Phase",
                    "field": "start_date and end_date",
                    "old_start": str(default_phase.start_date),
                    "new_start": str(new_start),
                    "old_end": str(default_phase.end_date),
                    "new_end": str(new_end)
                })
            elif len(phases) > 0:
                # For user-definable phases, adjust boundary phases
                # Sort phases by start date to identify first and last
                sorted_phases = sorted(phases, key=lambda p: p.start_date)
                first_phase = sorted_phases[0]
                last_phase = sorted_phases[-1]
                
                # Adjust first phase start date if project start date changed
                if start_date is not None and first_phase.start_date != new_start:
                    old_start = first_phase.start_date
                    phase_update_data = {"start_date": new_start}
                    self.phase_repository.update(db, db_obj=first_phase, obj_in=phase_update_data)
                    phase_adjustments.append({
                        "phase_name": first_phase.name,
                        "field": "start_date",
                        "old_value": str(old_start),
                        "new_value": str(new_start)
                    })
                
                # Adjust last phase end date if project end date changed
                if end_date is not None and last_phase.end_date != new_end:
                    old_end = last_phase.end_date
                    phase_update_data = {"end_date": new_end}
                    self.phase_repository.update(db, db_obj=last_phase, obj_in=phase_update_data)
                    phase_adjustments.append({
                        "phase_name": last_phase.name,
                        "field": "end_date",
                        "old_value": str(old_end),
                        "new_value": str(new_end)
                    })
        
        updated_project = self.repository.update(db, db_obj=project, obj_in=update_data)
        db.refresh(updated_project)
        
        # Store phase adjustments in project metadata for API response
        if phase_adjustments:
            updated_project._phase_adjustments = phase_adjustments
        
        return updated_project
    
    def delete_project(self, db: Session, project_id: UUID) -> bool:
        """
        Delete a project.
        
        Args:
            db: Database session
            project_id: Project ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If project not found
        """
        project = self.repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Cascade delete will handle phases and assignments
        self.repository.remove(db, id=project_id)
        return True
    
    def search_projects(self, db: Session, search_term: str) -> List[Project]:
        """Search projects by name."""
        return self.repository.search_by_name(db, search_term)
    
    def get_projects_by_manager(self, db: Session, manager: str) -> List[Project]:
        """Get projects by project manager."""
        return self.repository.get_by_manager(db, manager)
    
    def get_projects_by_program(self, db: Session, program_id: UUID) -> List[Project]:
        """Get all projects for a program."""
        return self.repository.get_by_program(db, program_id)


# Create service instance
project_service = ProjectService()
