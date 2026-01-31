"""
Phase service for managing user-definable project phases.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError, ResourceNotFoundError
from app.models.project import Project, ProjectPhase
from app.models.resource_assignment import ResourceAssignment
from app.repositories.project import project_repository, project_phase_repository
from app.services.phase_validator import PhaseValidatorService


class PhaseService:
    """Service for managing project phases with validation."""
    
    def __init__(self):
        self.phase_repo = project_phase_repository
        self.project_repo = project_repository
        self.validator = PhaseValidatorService()
    
    def create_phase(
        self,
        db: Session,
        project_id: UUID,
        name: str,
        start_date: date,
        end_date: date,
        description: Optional[str] = None,
        capital_budget: Optional[Decimal] = None,
        expense_budget: Optional[Decimal] = None,
        total_budget: Optional[Decimal] = None
    ) -> ProjectPhase:
        """
        Create a new phase with validation.
        
        Args:
            db: Database session
            project_id: Project ID this phase belongs to
            name: Phase name
            start_date: Phase start date
            end_date: Phase end date
            description: Optional phase description
            capital_budget: Optional capital budget (default: 0)
            expense_budget: Optional expense budget (default: 0)
            total_budget: Optional total budget (default: capital + expense)
            
        Returns:
            Created phase
            
        Raises:
            NotFoundError: If project not found
            ValidationError: If phase validation fails
        """
        # Get project
        project = self.project_repo.get(db, project_id)
        if not project:
            raise ResourceNotFoundError("Project", resource_id=project_id)
        
        # Set default budgets
        capital = capital_budget if capital_budget is not None else Decimal("0")
        expense = expense_budget if expense_budget is not None else Decimal("0")
        total = total_budget if total_budget is not None else (capital + expense)
        
        # Validate budget components
        if capital + expense != total:
            raise ValidationError(
                code="INVALID_BUDGET",
                message="Total budget must equal capital budget + expense budget",
                details={"capital": capital, "expense": expense, "total": total}
            )
        
        # Get existing phases
        existing_phases = self.phase_repo.get_by_project(db, project_id)
        
        # Prepare validation data (existing phases + new phase)
        all_phases = [
            {
                "id": p.id,
                "name": p.name,
                "start_date": p.start_date,
                "end_date": p.end_date
            }
            for p in existing_phases
        ]
        all_phases.append({
            "id": None,
            "name": name,
            "start_date": start_date,
            "end_date": end_date
        })
        
        # Validate timeline
        validation_result = self.validator.validate_phase_timeline(
            project.start_date,
            project.end_date,
            all_phases
        )
        
        if not validation_result.is_valid:
            raise ValidationError(
                code="VALIDATION_FAILED",
                message="Phase validation failed",
                details={"errors": [{"field": e.field, "message": e.message, "phase_id": str(e.phase_id) if e.phase_id else None} for e in validation_result.errors]}
            )
        
        # Create phase
        phase_data = {
            "project_id": project_id,
            "name": name,
            "start_date": start_date,
            "end_date": end_date,
            "description": description,
            "capital_budget": capital,
            "expense_budget": expense,
            "total_budget": total
        }
        
        phase = self.phase_repo.create(db, obj_in=phase_data)
        return phase
    
    def update_phase(
        self,
        db: Session,
        phase_id: UUID,
        name: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        description: Optional[str] = None,
        capital_budget: Optional[Decimal] = None,
        expense_budget: Optional[Decimal] = None,
        total_budget: Optional[Decimal] = None
    ) -> ProjectPhase:
        """
        Update a phase with validation.
        
        Args:
            db: Database session
            phase_id: Phase ID to update
            name: Optional new name
            start_date: Optional new start date
            end_date: Optional new end date
            description: Optional new description
            capital_budget: Optional new capital budget
            expense_budget: Optional new expense budget
            total_budget: Optional new total budget
            
        Returns:
            Updated phase
            
        Raises:
            NotFoundError: If phase not found
            ValidationError: If phase validation fails
        """
        # Get existing phase
        phase = self.phase_repo.get(db, phase_id)
        if not phase:
            raise ResourceNotFoundError("Phase", resource_id=phase_id)
        
        # Get project
        project = self.project_repo.get(db, phase.project_id)
        if not project:
            raise ResourceNotFoundError("Project", resource_id=phase.project_id)
        
        # Build update data with new or existing values
        new_name = name if name is not None else phase.name
        new_start = start_date if start_date is not None else phase.start_date
        new_end = end_date if end_date is not None else phase.end_date
        new_capital = capital_budget if capital_budget is not None else phase.capital_budget
        new_expense = expense_budget if expense_budget is not None else phase.expense_budget
        new_total = total_budget if total_budget is not None else (new_capital + new_expense)
        
        # Validate budget components
        if new_capital + new_expense != new_total:
            raise ValidationError(
                code="INVALID_BUDGET",
                message="Total budget must equal capital budget + expense budget",
                details={"capital": new_capital, "expense": new_expense, "total": new_total}
            )
        
        # Get all phases for the project
        all_phases = self.phase_repo.get_by_project(db, phase.project_id)
        
        # Prepare validation data (all phases with this one updated)
        phases_for_validation = []
        for p in all_phases:
            if p.id == phase_id:
                # Use updated values for this phase
                phases_for_validation.append({
                    "id": p.id,
                    "name": new_name,
                    "start_date": new_start,
                    "end_date": new_end
                })
            else:
                # Use existing values for other phases
                phases_for_validation.append({
                    "id": p.id,
                    "name": p.name,
                    "start_date": p.start_date,
                    "end_date": p.end_date
                })
        
        # Validate timeline
        validation_result = self.validator.validate_phase_timeline(
            project.start_date,
            project.end_date,
            phases_for_validation
        )
        
        if not validation_result.is_valid:
            raise ValidationError(
                code="VALIDATION_FAILED",
                message="Phase validation failed",
                details={"errors": [{"field": e.field, "message": e.message, "phase_id": str(e.phase_id) if e.phase_id else None} for e in validation_result.errors]}
            )
        
        # Build update dictionary
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if start_date is not None:
            update_data["start_date"] = start_date
        if end_date is not None:
            update_data["end_date"] = end_date
        if description is not None:
            update_data["description"] = description
        if capital_budget is not None:
            update_data["capital_budget"] = capital_budget
        if expense_budget is not None:
            update_data["expense_budget"] = expense_budget
        if total_budget is not None or capital_budget is not None or expense_budget is not None:
            update_data["total_budget"] = new_total
        
        # Update phase
        updated_phase = self.phase_repo.update(db, db_obj=phase, obj_in=update_data)
        return updated_phase
    
    def delete_phase(
        self,
        db: Session,
        phase_id: UUID
    ) -> None:
        """
        Delete a phase with validation.
        
        Args:
            db: Database session
            phase_id: Phase ID to delete
            
        Raises:
            NotFoundError: If phase not found
            ValidationError: If deletion would violate timeline continuity
        """
        # Get phase
        phase = self.phase_repo.get(db, phase_id)
        if not phase:
            raise ResourceNotFoundError("Phase", resource_id=phase_id)
        
        # Get project
        project = self.project_repo.get(db, phase.project_id)
        if not project:
            raise ResourceNotFoundError("Project", resource_id=phase.project_id)
        
        # Get all phases for the project
        all_phases = self.phase_repo.get_by_project(db, phase.project_id)
        
        # Check if this is the last phase
        if len(all_phases) == 1:
            raise ValidationError(
                code="CANNOT_DELETE_LAST_PHASE",
                message="Cannot delete the last remaining phase",
                details={"phase_id": str(phase_id)}
            )
        
        # Prepare validation data (all phases except the one being deleted)
        remaining_phases = [
            {
                "id": p.id,
                "name": p.name,
                "start_date": p.start_date,
                "end_date": p.end_date
            }
            for p in all_phases if p.id != phase_id
        ]
        
        # Validate that remaining phases still form a continuous timeline
        validation_result = self.validator.validate_phase_timeline(
            project.start_date,
            project.end_date,
            remaining_phases
        )
        
        if not validation_result.is_valid:
            raise ValidationError(
                code="DELETION_CREATES_GAP",
                message="Deleting this phase would create a gap in the project timeline",
                details={"errors": [{"field": e.field, "message": e.message, "phase_id": str(e.phase_id) if e.phase_id else None} for e in validation_result.errors]}
            )
        
        # Delete phase
        self.phase_repo.remove(db, id=phase_id)
    
    def create_default_phase(
        self,
        db: Session,
        project_id: UUID,
        project_start: date,
        project_end: date
    ) -> ProjectPhase:
        """
        Create default phase for a new project.
        
        Args:
            db: Database session
            project_id: Project ID
            project_start: Project start date
            project_end: Project end date
            
        Returns:
            Created default phase
        """
        phase_data = {
            "project_id": project_id,
            "name": "Default Phase",
            "start_date": project_start,
            "end_date": project_end,
            "description": None,
            "capital_budget": Decimal("0"),
            "expense_budget": Decimal("0"),
            "total_budget": Decimal("0")
        }
        
        phase = self.phase_repo.create(db, obj_in=phase_data)
        return phase
    
    def get_phase_for_date(
        self,
        db: Session,
        project_id: UUID,
        target_date: date
    ) -> Optional[ProjectPhase]:
        """
        Get the phase that contains a specific date.
        
        Args:
            db: Database session
            project_id: Project ID
            target_date: Date to find phase for
            
        Returns:
            Phase containing the date, or None if no phase found
        """
        result = db.query(ProjectPhase).filter(
            and_(
                ProjectPhase.project_id == project_id,
                ProjectPhase.start_date <= target_date,
                ProjectPhase.end_date >= target_date
            )
        ).first()
        
        return result
    
    def get_assignments_for_phase(
        self,
        db: Session,
        phase_id: UUID
    ) -> List[ResourceAssignment]:
        """
        Get all assignments that fall within a phase's date range.
        
        Args:
            db: Database session
            phase_id: Phase ID
            
        Returns:
            List of resource assignments within the phase date range
            
        Raises:
            NotFoundError: If phase not found
        """
        # Get phase
        phase = self.phase_repo.get(db, phase_id)
        if not phase:
            raise ResourceNotFoundError("Phase", resource_id=phase_id)
        
        # Query assignments by date range
        result = db.query(ResourceAssignment).filter(
            and_(
                ResourceAssignment.project_id == phase.project_id,
                ResourceAssignment.assignment_date >= phase.start_date,
                ResourceAssignment.assignment_date <= phase.end_date
            )
        ).order_by(ResourceAssignment.assignment_date).all()
        
        return result
    
    def update_project_phases(
        self,
        db: Session,
        project_id: UUID,
        phases: List[dict]
    ) -> List[ProjectPhase]:
        """
        Atomically update all phases for a project.
        
        This method accepts a complete list of phases and performs all
        creates/updates/deletes atomically within a transaction. It validates
        the entire set for timeline continuity before making any changes.
        
        Args:
            db: Database session
            project_id: Project ID
            phases: Complete list of phases with structure:
                    [{"id": UUID or None, "name": str, "start_date": date, 
                      "end_date": date, "description": str, "capital_budget": Decimal,
                      "expense_budget": Decimal, "total_budget": Decimal}, ...]
                    
        Returns:
            List of all phases after update
            
        Raises:
            NotFoundError: If project not found
            ValidationError: If phase validation fails
        """
        # Get project
        project = self.project_repo.get(db, project_id)
        if not project:
            raise ResourceNotFoundError("Project", resource_id=project_id)
        
        # Validate that we have at least one phase
        if not phases or len(phases) == 0:
            raise ValidationError(
                code="NO_PHASES",
                message="Project must have at least one phase",
                details={}
            )
        
        # Validate timeline continuity for the complete set
        validation_result = self.validator.validate_phase_timeline(
            project.start_date,
            project.end_date,
            phases
        )
        
        if not validation_result.is_valid:
            raise ValidationError(
                code="VALIDATION_FAILED",
                message="Phase validation failed",
                details={"errors": [{"field": e.field, "message": e.message, "phase_id": str(e.phase_id) if e.phase_id else None} for e in validation_result.errors]}
            )
        
        # Get existing phases
        existing_phases = self.phase_repo.get_by_project(db, project_id)
        existing_phase_ids = {p.id for p in existing_phases}
        
        # Separate phases into create, update, and delete
        incoming_phase_ids = {p.get('id') for p in phases if p.get('id') is not None}
        phases_to_delete = existing_phase_ids - incoming_phase_ids
        
        # Delete phases that are no longer in the list
        for phase_id in phases_to_delete:
            self.phase_repo.remove(db, id=phase_id)
        
        # Create or update phases
        result_phases = []
        for phase_data in phases:
            phase_id = phase_data.get('id')
            
            # Validate budget components
            capital = phase_data.get('capital_budget', Decimal("0"))
            expense = phase_data.get('expense_budget', Decimal("0"))
            total = phase_data.get('total_budget', capital + expense)
            
            if capital + expense != total:
                raise ValidationError(
                    code="INVALID_BUDGET",
                    message=f"Total budget must equal capital + expense for phase '{phase_data.get('name')}'",
                    details={"capital": capital, "expense": expense, "total": total}
                )
            
            if phase_id is None:
                # Create new phase
                create_data = {
                    "project_id": project_id,
                    "name": phase_data['name'],
                    "start_date": phase_data['start_date'],
                    "end_date": phase_data['end_date'],
                    "description": phase_data.get('description'),
                    "capital_budget": capital,
                    "expense_budget": expense,
                    "total_budget": total
                }
                phase = self.phase_repo.create(db, obj_in=create_data)
                result_phases.append(phase)
            else:
                # Update existing phase
                phase = self.phase_repo.get(db, phase_id)
                if not phase:
                    raise ResourceNotFoundError("Phase", resource_id=phase_id)
                
                update_data = {
                    "name": phase_data['name'],
                    "start_date": phase_data['start_date'],
                    "end_date": phase_data['end_date'],
                    "description": phase_data.get('description'),
                    "capital_budget": capital,
                    "expense_budget": expense,
                    "total_budget": total
                }
                updated_phase = self.phase_repo.update(db, db_obj=phase, obj_in=update_data)
                result_phases.append(updated_phase)
        
        return result_phases


# Create service instance
phase_service = PhaseService()
