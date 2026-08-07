"""
Project and Phase services for business logic operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.nonlabor_plan import NonLaborPlanStatus
from app.models.project import Project, ProjectPhase
from app.repositories.project import project_repository, project_phase_repository
from app.repositories.program import program_repository
from app.services.business_id import allocate_business_id
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
        currency_code: str = "USD",
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
            "currency_code": currency_code.upper(),
            "description": description,
            "business_id": allocate_business_id(db, "project"),
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

    def preview_date_change(
        self,
        db: Session,
        project_id: UUID,
        proposed_start: date,
        proposed_end: date,
    ) -> dict:
        """Validate a proposed inclusive project range without changing data."""
        project = self.repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")

        constraints = []

        def add_constraint(
            constraint_id: str,
            label: str,
            passed: bool,
            pass_message: str,
            fail_message: str,
            resolution_target: Optional[str] = None,
            details: Optional[dict] = None,
        ) -> None:
            constraints.append({
                "id": constraint_id,
                "label": label,
                "status": "pass" if passed else "fail",
                "message": pass_message if passed else fail_message,
                "resolution_target": None if passed else resolution_target,
                "details": details or {},
            })

        range_valid = proposed_start < proposed_end
        add_constraint(
            "project_range",
            "Project date range",
            range_valid,
            "The proposed start date is before the proposed end date.",
            "The project start date must be before the project end date.",
            "project",
        )

        program = project.program
        program_valid = bool(
            range_valid
            and program
            and program.start_date <= proposed_start
            and proposed_end <= program.end_date
        )
        program_details = {
            "program_id": str(program.id) if program else None,
            "program_name": program.name if program else None,
            "program_start_date": str(program.start_date) if program else None,
            "program_end_date": str(program.end_date) if program else None,
        }
        program_range = (
            f"{program.start_date} through {program.end_date}"
            if program else "unavailable"
        )
        add_constraint(
            "program_range",
            "Parent program dates",
            program_valid,
            f"The project fits within {program.name}'s date range ({program_range})." if program else "",
            f"The project must fit within its parent program date range ({program_range}).",
            "program",
            program_details,
        )

        phases = sorted(
            self.phase_repository.get_by_project(db, project_id),
            key=lambda phase: phase.start_date,
        )
        candidate_phases = []
        for index, phase in enumerate(phases):
            phase_start = proposed_start if index == 0 else phase.start_date
            phase_end = proposed_end if index == len(phases) - 1 else phase.end_date
            candidate_phases.append({
                "id": phase.id,
                "name": phase.name,
                "start_date": phase_start,
                "end_date": phase_end,
            })

        phase_validation = phase_service.validator.validate_phase_timeline(
            proposed_start,
            proposed_end,
            candidate_phases,
        ) if range_valid and candidate_phases else None
        phase_valid = bool(candidate_phases and phase_validation and phase_validation.is_valid)
        phase_errors = []
        if not candidate_phases:
            phase_errors.append({"message": "The project has no phases."})
        elif phase_validation:
            phase_errors = [
                {
                    "field": error.field,
                    "message": error.message,
                    "phase_id": str(error.phase_id) if error.phase_id else None,
                }
                for error in phase_validation.errors
            ]
        phase_failure_message = (
            " ".join(error["message"] for error in phase_errors[:2])
            if phase_errors
            else "Resolve the phase timeline first."
        )
        add_constraint(
            "phase_timeline",
            "Phase dates and sequence",
            phase_valid,
            f"All {len(phases)} phase{'s' if len(phases) != 1 else ''} cover the proposed dates without gaps or overlaps.",
            phase_failure_message,
            "phases",
            {"phase_count": len(phases), "errors": phase_errors},
        )

        outside_assignments = [
            assignment for assignment in project.resource_assignments
            if assignment.assignment_date < proposed_start
            or assignment.assignment_date > proposed_end
        ]
        assignment_dates = sorted(
            assignment.assignment_date for assignment in outside_assignments
        )
        add_constraint(
            "labor_assignments",
            "Labor assignments",
            not outside_assignments,
            "All labor assignments are within the proposed project dates.",
            f"{len(outside_assignments)} labor assignment entr{'y is' if len(outside_assignments) == 1 else 'ies are'} outside the proposed project dates.",
            "labor",
            {
                "outside_count": len(outside_assignments),
                "first_outside_date": str(assignment_dates[0]) if assignment_dates else None,
                "last_outside_date": str(assignment_dates[-1]) if assignment_dates else None,
            },
        )

        active_plan_lines = [
            line for line in project.nonlabor_plan_lines
            if line.status == NonLaborPlanStatus.ACTIVE
        ]
        conflicting_plan_lines = []
        outside_occurrence_count = 0
        outside_amount = Decimal("0")
        for line in active_plan_lines:
            outside_occurrences = [
                occurrence for occurrence in line.occurrences
                if occurrence.occurrence_date < proposed_start
                or occurrence.occurrence_date > proposed_end
            ]
            schedule_outside = bool(
                (line.schedule_start and line.schedule_start < proposed_start)
                or (line.schedule_end and line.schedule_end > proposed_end)
            )
            if outside_occurrences or schedule_outside:
                outside_occurrence_count += len(outside_occurrences)
                outside_amount += sum(
                    (occurrence.effective_amount for occurrence in outside_occurrences),
                    Decimal("0"),
                )
                conflicting_plan_lines.append({
                    "id": str(line.id),
                    "name": line.name,
                    "schedule_start": str(line.schedule_start) if line.schedule_start else None,
                    "schedule_end": str(line.schedule_end) if line.schedule_end else None,
                    "outside_occurrence_count": len(outside_occurrences),
                })
        conflicting_plan_names = ", ".join(
            line["name"] for line in conflicting_plan_lines[:3]
        )
        if len(conflicting_plan_lines) > 3:
            conflicting_plan_names += ", and others"
        cost_plan_failure_message = (
            f"{len(conflicting_plan_lines)} active cost "
            f"plan{' is' if len(conflicting_plan_lines) == 1 else 's are'} "
            f"outside the proposed dates ({conflicting_plan_names}); "
            f"{outside_occurrence_count} dated amount"
            f"{' is' if outside_occurrence_count == 1 else 's are'} affected "
            f"for {outside_amount:,.2f}."
        )
        add_constraint(
            "nonlabor_cost_plans",
            "Non-labor cost plans",
            not conflicting_plan_lines,
            "All active non-labor cost plans are within the proposed project dates.",
            cost_plan_failure_message,
            "non_labor",
            {
                "conflicting_line_count": len(conflicting_plan_lines),
                "outside_occurrence_count": outside_occurrence_count,
                "outside_amount": str(outside_amount),
                "plan_lines": conflicting_plan_lines,
            },
        )

        outside_actuals = [
            actual for actual in project.actuals
            if actual.actual_date < proposed_start or actual.actual_date > proposed_end
        ]
        actual_dates = sorted(actual.actual_date for actual in outside_actuals)
        add_constraint(
            "actuals",
            "Actuals",
            not outside_actuals,
            "All loaded actuals are within the proposed project dates.",
            f"{len(outside_actuals)} actual entr{'y is' if len(outside_actuals) == 1 else 'ies are'} outside the proposed project dates.",
            "actuals",
            {
                "outside_count": len(outside_actuals),
                "first_outside_date": str(actual_dates[0]) if actual_dates else None,
                "last_outside_date": str(actual_dates[-1]) if actual_dates else None,
            },
        )

        blocking_count = sum(
            constraint["status"] == "fail" for constraint in constraints
        )
        return {
            "project_id": str(project.id),
            "current_start_date": str(project.start_date),
            "current_end_date": str(project.end_date),
            "proposed_start_date": str(proposed_start),
            "proposed_end_date": str(proposed_end),
            "can_proceed": blocking_count == 0,
            "blocking_count": blocking_count,
            "constraints": constraints,
        }
    
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
        currency_code: Optional[str] = None,
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

        if currency_code is not None:
            update_data["currency_code"] = currency_code.upper()
        
        # Handle date updates with validation
        new_start = start_date if start_date is not None else project.start_date
        new_end = end_date if end_date is not None else project.end_date
        
        phase_adjustments = []  # Track phase adjustments for user notification
        
        dates_changed = (
            new_start != project.start_date or new_end != project.end_date
        )

        if dates_changed:
            if new_start >= new_end:
                raise ValueError("Start date must be before end date")
            preview = self.preview_date_change(
                db,
                project_id,
                proposed_start=new_start,
                proposed_end=new_end,
            )
            if not preview["can_proceed"]:
                raise ValidationError(
                    code="PROJECT_DATE_CONSTRAINTS",
                    message="Resolve the project date conflicts before saving.",
                    details={"preview": preview},
                )
            
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
