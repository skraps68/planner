"""
Project and Phase services for business logic operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import Project, ProjectPhase, PhaseType
from app.repositories.project import project_repository, project_phase_repository
from app.repositories.program import program_repository


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
        Create a new project with validation and mandatory execution phase.
        
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
            execution_capital_budget: Capital budget for execution phase
            execution_expense_budget: Expense budget for execution phase
            planning_capital_budget: Optional capital budget for planning phase
            planning_expense_budget: Optional expense budget for planning phase
            
        Returns:
            Created project with phases
            
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
        
        # Create mandatory execution phase
        exec_capital = execution_capital_budget or Decimal("0")
        exec_expense = execution_expense_budget or Decimal("0")
        exec_total = exec_capital + exec_expense
        
        execution_phase_data = {
            "project_id": project.id,
            "phase_type": PhaseType.EXECUTION,
            "capital_budget": exec_capital,
            "expense_budget": exec_expense,
            "total_budget": exec_total
        }
        self.phase_repository.create(db, obj_in=execution_phase_data)
        
        # Create optional planning phase if budgets provided
        if planning_capital_budget is not None or planning_expense_budget is not None:
            plan_capital = planning_capital_budget or Decimal("0")
            plan_expense = planning_expense_budget or Decimal("0")
            plan_total = plan_capital + plan_expense
            
            planning_phase_data = {
                "project_id": project.id,
                "phase_type": PhaseType.PLANNING,
                "capital_budget": plan_capital,
                "expense_budget": plan_expense,
                "total_budget": plan_total
            }
            self.phase_repository.create(db, obj_in=planning_phase_data)
        
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
        Update project with validation.
        
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
        
        if start_date is not None or end_date is not None:
            if new_start >= new_end:
                raise ValueError("Start date must be before end date")
            
            if start_date is not None:
                update_data["start_date"] = start_date
            if end_date is not None:
                update_data["end_date"] = end_date
        
        return self.repository.update(db, db_obj=project, obj_in=update_data)
    
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


class PhaseService:
    """Service for project phase business logic."""
    
    def __init__(self):
        self.repository = project_phase_repository
        self.project_repository = project_repository
    
    def get_phase(self, db: Session, phase_id: UUID) -> Optional[ProjectPhase]:
        """Get phase by ID."""
        return self.repository.get(db, phase_id)
    
    def get_project_phases(self, db: Session, project_id: UUID) -> List[ProjectPhase]:
        """Get all phases for a project."""
        return self.repository.get_by_project(db, project_id)
    
    def get_execution_phase(self, db: Session, project_id: UUID) -> Optional[ProjectPhase]:
        """Get the execution phase for a project."""
        return self.repository.get_execution_phase(db, project_id)
    
    def get_planning_phase(self, db: Session, project_id: UUID) -> Optional[ProjectPhase]:
        """Get the planning phase for a project."""
        return self.repository.get_planning_phase(db, project_id)
    
    def create_planning_phase(
        self,
        db: Session,
        project_id: UUID,
        capital_budget: Decimal,
        expense_budget: Decimal
    ) -> ProjectPhase:
        """
        Create a planning phase for a project.
        
        Args:
            db: Database session
            project_id: Project ID
            capital_budget: Capital budget for planning phase
            expense_budget: Expense budget for planning phase
            
        Returns:
            Created planning phase
            
        Raises:
            ValueError: If validation fails
        """
        # Validate project exists
        project = self.project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Check if planning phase already exists
        existing = self.repository.get_planning_phase(db, project_id)
        if existing:
            raise ValueError(f"Planning phase already exists for project {project_id}")
        
        # Calculate total budget
        total_budget = capital_budget + expense_budget
        
        # Create planning phase
        phase_data = {
            "project_id": project_id,
            "phase_type": PhaseType.PLANNING,
            "capital_budget": capital_budget,
            "expense_budget": expense_budget,
            "total_budget": total_budget
        }
        
        return self.repository.create(db, obj_in=phase_data)
    
    def update_phase_budget(
        self,
        db: Session,
        phase_id: UUID,
        capital_budget: Optional[Decimal] = None,
        expense_budget: Optional[Decimal] = None
    ) -> ProjectPhase:
        """
        Update phase budget with validation.
        
        Args:
            db: Database session
            phase_id: Phase ID to update
            capital_budget: Optional new capital budget
            expense_budget: Optional new expense budget
            
        Returns:
            Updated phase
            
        Raises:
            ValueError: If validation fails or phase not found
        """
        # Get existing phase
        phase = self.repository.get(db, phase_id)
        if not phase:
            raise ValueError(f"Phase with ID {phase_id} not found")
        
        # Build update data
        update_data = {}
        
        new_capital = capital_budget if capital_budget is not None else phase.capital_budget
        new_expense = expense_budget if expense_budget is not None else phase.expense_budget
        
        if capital_budget is not None:
            update_data["capital_budget"] = capital_budget
        
        if expense_budget is not None:
            update_data["expense_budget"] = expense_budget
        
        # Always recalculate total budget
        update_data["total_budget"] = new_capital + new_expense
        
        return self.repository.update(db, db_obj=phase, obj_in=update_data)
    
    def delete_planning_phase(self, db: Session, phase_id: UUID) -> bool:
        """
        Delete a planning phase (execution phases cannot be deleted).
        
        Args:
            db: Database session
            phase_id: Phase ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If phase not found or is execution phase
        """
        phase = self.repository.get(db, phase_id)
        if not phase:
            raise ValueError(f"Phase with ID {phase_id} not found")
        
        if phase.phase_type == PhaseType.EXECUTION:
            raise ValueError("Cannot delete execution phase - it is mandatory")
        
        self.repository.remove(db, id=phase_id)
        return True


# Create service instances
project_service = ProjectService()
phase_service = PhaseService()
