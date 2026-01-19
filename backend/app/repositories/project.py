"""
Project and ProjectPhase repositories for data access operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectPhase, PhaseType
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    """Repository for Project model operations."""
    
    def __init__(self):
        super().__init__(Project)
    
    def get_by_program(self, db: Session, program_id: UUID) -> List[Project]:
        """Get all projects for a program."""
        return db.query(Project).filter(Project.program_id == program_id).all()
    
    def get_by_cost_center(self, db: Session, cost_center_code: str) -> Optional[Project]:
        """Get project by cost center code."""
        return db.query(Project).filter(Project.cost_center_code == cost_center_code).first()
    
    def get_by_manager(self, db: Session, manager: str) -> List[Project]:
        """Get projects by project manager."""
        return db.query(Project).filter(Project.project_manager == manager).all()
    
    def get_active_projects(self, db: Session, as_of_date: Optional[date] = None) -> List[Project]:
        """Get projects that are active on a given date (default: today)."""
        if as_of_date is None:
            as_of_date = date.today()
        
        return db.query(Project).filter(
            and_(
                Project.start_date <= as_of_date,
                Project.end_date >= as_of_date
            )
        ).all()
    
    def search_by_name(self, db: Session, search_term: str) -> List[Project]:
        """Search projects by name (case-insensitive partial match)."""
        return db.query(Project).filter(
            Project.name.ilike(f"%{search_term}%")
        ).all()
    
    def validate_budget_components(
        self,
        capital_budget: Decimal,
        expense_budget: Decimal,
        total_budget: Decimal
    ) -> bool:
        """Validate that capital + expense = total budget."""
        return capital_budget + expense_budget == total_budget


class ProjectPhaseRepository(BaseRepository[ProjectPhase]):
    """Repository for ProjectPhase model operations."""
    
    def __init__(self):
        super().__init__(ProjectPhase)
    
    def get_by_project(self, db: Session, project_id: UUID) -> List[ProjectPhase]:
        """Get all phases for a project."""
        return db.query(ProjectPhase).filter(ProjectPhase.project_id == project_id).all()
    
    def get_by_project_and_type(
        self,
        db: Session,
        project_id: UUID,
        phase_type: PhaseType
    ) -> Optional[ProjectPhase]:
        """Get a specific phase for a project."""
        return db.query(ProjectPhase).filter(
            and_(
                ProjectPhase.project_id == project_id,
                ProjectPhase.phase_type == phase_type
            )
        ).first()
    
    def get_execution_phase(self, db: Session, project_id: UUID) -> Optional[ProjectPhase]:
        """Get the execution phase for a project."""
        return self.get_by_project_and_type(db, project_id, PhaseType.EXECUTION)
    
    def get_planning_phase(self, db: Session, project_id: UUID) -> Optional[ProjectPhase]:
        """Get the planning phase for a project."""
        return self.get_by_project_and_type(db, project_id, PhaseType.PLANNING)
    
    def calculate_total_budget(self, capital_budget: Decimal, expense_budget: Decimal) -> Decimal:
        """Calculate total budget from components."""
        return capital_budget + expense_budget
    
    def validate_budget_components(
        self,
        capital_budget: Decimal,
        expense_budget: Decimal,
        total_budget: Decimal
    ) -> bool:
        """Validate that capital + expense = total budget."""
        return capital_budget + expense_budget == total_budget


# Create repository instances
project_repository = ProjectRepository()
project_phase_repository = ProjectPhaseRepository()