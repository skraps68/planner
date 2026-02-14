"""
Project API endpoints.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectSummary,
    ProjectPhaseCreate,
    ProjectPhaseUpdate,
    ProjectPhaseResponse
)
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.project import project_service, phase_service
from app.services.reporting import reporting_service
from app.core.exceptions import ConflictError

router = APIRouter()


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
    description="Create a new project with required attributes and mandatory execution phase"
)
async def create_project(
    project_in: ProjectCreate,
    execution_capital_budget: Decimal = Query(default=Decimal("0"), ge=0, description="Capital budget for execution phase"),
    execution_expense_budget: Decimal = Query(default=Decimal("0"), ge=0, description="Expense budget for execution phase"),
    planning_capital_budget: Optional[Decimal] = Query(default=None, ge=0, description="Optional capital budget for planning phase"),
    planning_expense_budget: Optional[Decimal] = Query(default=None, ge=0, description="Optional expense budget for planning phase"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project.
    
    Required fields:
    - program_id: Parent program ID
    - name: Project name
    - business_sponsor: Business sponsor name
    - project_manager: Project manager name
    - technical_lead: Technical lead name
    - start_date: Project start date
    - end_date: Project end date (must be after start_date)
    - cost_center_code: Unique cost center code
    
    Optional fields:
    - description: Project description
    - execution_capital_budget: Capital budget for execution phase (default: 0)
    - execution_expense_budget: Expense budget for execution phase (default: 0)
    - planning_capital_budget: Capital budget for planning phase (optional)
    - planning_expense_budget: Expense budget for planning phase (optional)
    
    A mandatory execution phase is created automatically.
    An optional planning phase is created if planning budgets are provided.
    """
    try:
        project = project_service.create_project(
            db=db,
            program_id=project_in.program_id,
            name=project_in.name,
            business_sponsor=project_in.business_sponsor,
            project_manager=project_in.project_manager,
            technical_lead=project_in.technical_lead,
            start_date=project_in.start_date,
            end_date=project_in.end_date,
            cost_center_code=project_in.cost_center_code,
            description=project_in.description,
            execution_capital_budget=execution_capital_budget,
            execution_expense_budget=execution_expense_budget,
            planning_capital_budget=planning_capital_budget,
            planning_expense_budget=planning_expense_budget
        )
        
        # Convert to response model
        response = ProjectResponse.model_validate(project)
        response.program_name = project.program.name if project.program else None
        response.phases = [ProjectPhaseResponse.model_validate(phase) for phase in project.phases]
        response.assignment_count = len(project.resource_assignments) if project.resource_assignments else 0
        response.actual_count = len(project.actuals) if project.actuals else 0
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )


@router.get(
    "/",
    response_model=ProjectListResponse,
    summary="List projects",
    description="Get a paginated list of projects with optional filtering"
)
async def list_projects(
    pagination: PaginationParams = Depends(),
    program_id: Optional[UUID] = Query(None, description="Filter by program ID"),
    active_only: bool = Query(False, description="Filter for active projects only"),
    as_of_date: Optional[date] = Query(None, description="Date to check for active projects"),
    search: Optional[str] = Query(None, description="Search term for project name"),
    manager: Optional[str] = Query(None, description="Filter by project manager"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List projects with pagination and filtering.
    
    Supports filtering by:
    - Program ID
    - Active status (projects active on a specific date)
    - Search term (project name)
    - Project manager
    """
    try:
        # Apply filters
        if search:
            projects = project_service.search_projects(db, search)
        elif manager:
            projects = project_service.get_projects_by_manager(db, manager)
        elif program_id:
            projects = project_service.get_projects_by_program(db, program_id)
        else:
            skip = (pagination.page - 1) * pagination.size
            projects = project_service.list_projects(
                db=db,
                skip=skip,
                limit=pagination.size,
                active_only=active_only,
                as_of_date=as_of_date
            )
        
        # Calculate pagination
        total = len(projects)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Apply pagination to filtered results
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_projects = projects[start_idx:end_idx]
        
        # Convert to response models
        project_responses = []
        for project in paginated_projects:
            response = ProjectResponse.model_validate(project)
            response.program_name = project.program.name if project.program else None
            response.phases = [ProjectPhaseResponse.model_validate(phase) for phase in project.phases]
            response.assignment_count = len(project.resource_assignments) if project.resource_assignments else 0
            response.actual_count = len(project.actuals) if project.actuals else 0
            project_responses.append(response)
        
        return ProjectListResponse(
            items=project_responses,
            total=total,
            page=pagination.page,
            size=pagination.size,
            pages=pages,
            has_next=pagination.page < pages,
            has_prev=pagination.page > 1
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list projects: {str(e)}"
        )


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project by ID",
    description="Retrieve a specific project by its ID"
)
async def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project by ID.
    
    Returns project details including:
    - All project attributes
    - Program name
    - Project phases
    - Assignment and actual counts
    - Timestamps
    """
    project = project_service.get_project(db, project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    
    response = ProjectResponse.model_validate(project)
    response.program_name = project.program.name if project.program else None
    response.phases = [ProjectPhaseResponse.model_validate(phase) for phase in project.phases]
    response.assignment_count = len(project.resource_assignments) if project.resource_assignments else 0
    response.actual_count = len(project.actuals) if project.actuals else 0
    
    return response


@router.get(
    "/cost-center/{cost_center_code}",
    response_model=ProjectResponse,
    summary="Get project by cost center code",
    description="Retrieve a specific project by its cost center code"
)
async def get_project_by_cost_center(
    cost_center_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project by cost center code.
    """
    project = project_service.get_project_by_cost_center(db, cost_center_code)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with cost center code '{cost_center_code}' not found"
        )
    
    response = ProjectResponse.model_validate(project)
    response.program_name = project.program.name if project.program else None
    response.phases = [ProjectPhaseResponse.model_validate(phase) for phase in project.phases]
    response.assignment_count = len(project.resource_assignments) if project.resource_assignments else 0
    response.actual_count = len(project.actuals) if project.actuals else 0
    
    return response


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project",
    description="Update an existing project's attributes"
)
async def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing project.
    
    All fields are optional. Only provided fields will be updated.
    Date validation is applied if dates are updated.
    
    When project start/end dates are modified, boundary phase dates are automatically adjusted:
    - First phase start date is updated to match project start date
    - Last phase end date is updated to match project end date
    """
    try:
        project = project_service.update_project(
            db=db,
            project_id=project_id,
            name=project_in.name,
            business_sponsor=project_in.business_sponsor,
            project_manager=project_in.project_manager,
            technical_lead=project_in.technical_lead,
            start_date=project_in.start_date,
            end_date=project_in.end_date,
            cost_center_code=project_in.cost_center_code,
            description=project_in.description
        )
        
        response = ProjectResponse.model_validate(project)
        response.program_name = project.program.name if project.program else None
        response.phases = [ProjectPhaseResponse.model_validate(phase) for phase in project.phases]
        response.assignment_count = len(project.resource_assignments) if project.resource_assignments else 0
        response.actual_count = len(project.actuals) if project.actuals else 0
        
        # Add phase adjustment information if available
        if hasattr(project, '_phase_adjustments') and project._phase_adjustments:
            response.phase_adjustments = project._phase_adjustments
        
        return response
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        current_project = project_service.get_project(db, project_id)
        if current_project:
            current_state = ProjectResponse.model_validate(current_project).model_dump()
            raise ConflictError("project", str(project_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project: {str(e)}"
        )


@router.delete(
    "/{project_id}",
    response_model=SuccessResponse,
    summary="Delete project",
    description="Delete a project and all associated data"
)
async def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project.
    
    This will cascade delete all associated phases, assignments, and actuals.
    """
    try:
        project_service.delete_project(db, project_id)
        
        return SuccessResponse(
            success=True,
            message=f"Project {project_id} deleted successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )


# Phase Management Endpoints

@router.get(
    "/{project_id}/phases",
    response_model=List[ProjectPhaseResponse],
    summary="Get project phases",
    description="Get all phases for a project"
)
async def get_project_phases(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all phases for a project.
    
    Returns all phases in chronological order.
    """
    from app.repositories.project import project_repository, project_phase_repository
    
    project = project_repository.get(db, project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    
    phases = project_phase_repository.get_by_project(db, project_id)
    phases_sorted = sorted(phases, key=lambda p: p.start_date)
    
    return [ProjectPhaseResponse.model_validate(phase) for phase in phases_sorted]


@router.get(
    "/{project_id}/phases/execution",
    response_model=ProjectPhaseResponse,
    summary="Get execution phase",
    description="Get the execution phase for a project"
)
async def get_execution_phase(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the execution phase for a project.
    
    Every project has a mandatory execution phase.
    """
    phase = phase_service.get_execution_phase(db, project_id)
    
    if not phase:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution phase not found for project {project_id}"
        )
    
    return ProjectPhaseResponse.model_validate(phase)


@router.get(
    "/{project_id}/phases/planning",
    response_model=ProjectPhaseResponse,
    summary="Get planning phase",
    description="Get the planning phase for a project"
)
async def get_planning_phase(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the planning phase for a project.
    
    Planning phases are optional.
    """
    phase = phase_service.get_planning_phase(db, project_id)
    
    if not phase:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planning phase not found for project {project_id}"
        )
    
    return ProjectPhaseResponse.model_validate(phase)


@router.post(
    "/{project_id}/phases/planning",
    response_model=ProjectPhaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create planning phase",
    description="Create a planning phase for a project"
)
async def create_planning_phase(
    project_id: UUID,
    capital_budget: Decimal = Query(ge=0, description="Capital budget for planning phase"),
    expense_budget: Decimal = Query(ge=0, description="Expense budget for planning phase"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a planning phase for a project.
    
    A project can only have one planning phase.
    """
    try:
        phase = phase_service.create_planning_phase(
            db=db,
            project_id=project_id,
            capital_budget=capital_budget,
            expense_budget=expense_budget
        )
        
        return ProjectPhaseResponse.model_validate(phase)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create planning phase: {str(e)}"
        )


@router.put(
    "/{project_id}/phases/{phase_id}",
    response_model=ProjectPhaseResponse,
    summary="Update phase budget",
    description="Update the budget for a project phase"
)
async def update_phase_budget(
    project_id: UUID,
    phase_id: UUID,
    capital_budget: Optional[Decimal] = Query(default=None, ge=0, description="Capital budget"),
    expense_budget: Optional[Decimal] = Query(default=None, ge=0, description="Expense budget"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update phase budget.
    
    Total budget is automatically recalculated.
    """
    try:
        phase = phase_service.update_phase_budget(
            db=db,
            phase_id=phase_id,
            capital_budget=capital_budget,
            expense_budget=expense_budget
        )
        
        return ProjectPhaseResponse.model_validate(phase)
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        from app.repositories.project import project_phase_repository
        current_phase = project_phase_repository.get(db, phase_id)
        if current_phase:
            current_state = ProjectPhaseResponse.model_validate(current_phase).model_dump()
            raise ConflictError("project_phase", str(phase_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Phase with ID {phase_id} not found"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update phase budget: {str(e)}"
        )


@router.delete(
    "/{project_id}/phases/{phase_id}",
    response_model=SuccessResponse,
    summary="Delete planning phase",
    description="Delete a planning phase (execution phases cannot be deleted)"
)
async def delete_planning_phase(
    project_id: UUID,
    phase_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a planning phase.
    
    Execution phases cannot be deleted as they are mandatory.
    """
    try:
        phase_service.delete_planning_phase(db, phase_id)
        
        return SuccessResponse(
            success=True,
            message=f"Planning phase {phase_id} deleted successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete planning phase: {str(e)}"
        )


# Project-Specific Reporting Endpoints

@router.get(
    "/{project_id}/report",
    summary="Get project report",
    description="Generate comprehensive report for a project"
)
async def get_project_report(
    project_id: UUID,
    as_of_date: Optional[date] = Query(None, description="Date to generate report as of (default: today)"),
    include_variance: bool = Query(True, description="Include variance analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate comprehensive report for a project.
    
    Includes:
    - Project details
    - Budget vs actual vs forecast
    - Variance analysis (optional)
    """
    try:
        report = reporting_service.get_project_report(
            db=db,
            project_id=project_id,
            as_of_date=as_of_date,
            include_variance=include_variance
        )
        
        return report
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate project report: {str(e)}"
        )


@router.get(
    "/{project_id}/budget-status",
    summary="Get project budget status",
    description="Get budget status showing budget vs actual vs forecast"
)
async def get_project_budget_status(
    project_id: UUID,
    as_of_date: Optional[date] = Query(None, description="Date to generate report as of (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get budget status for a project.
    
    Returns budget vs actual vs forecast with status indicators.
    """
    try:
        report = reporting_service.get_budget_status_report(
            db=db,
            entity_id=project_id,
            entity_type="project",
            as_of_date=as_of_date
        )
        
        return report
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate budget status: {str(e)}"
        )


@router.get(
    "/{project_id}/variance",
    summary="Get project variance analysis",
    description="Get detailed variance analysis for a project"
)
async def get_project_variance(
    project_id: UUID,
    start_date: date = Query(description="Start of analysis period"),
    end_date: date = Query(description="End of analysis period"),
    allocation_threshold: Optional[Decimal] = Query(None, description="Percentage threshold for allocation variance"),
    cost_threshold: Optional[Decimal] = Query(None, description="Percentage threshold for cost variance"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed variance analysis for a project.
    
    Compares actual vs forecasted allocations and costs.
    """
    try:
        report = reporting_service.get_variance_report(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            allocation_threshold=allocation_threshold,
            cost_threshold=cost_threshold
        )
        
        return report
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate variance report: {str(e)}"
        )


@router.get(
    "/{project_id}/time-series",
    summary="Get project time-series report",
    description="Get time-series report showing budget vs actual over time"
)
async def get_project_time_series(
    project_id: UUID,
    start_date: date = Query(description="Start of reporting period"),
    end_date: date = Query(description="End of reporting period"),
    interval: str = Query(default="monthly", description="Interval: daily, weekly, or monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get time-series report for a project.
    
    Shows budget vs actual over time with configurable intervals.
    """
    try:
        report = reporting_service.get_time_series_report(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            interval=interval
        )
        
        return report
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate time-series report: {str(e)}"
        )


@router.get(
    "/{project_id}/drill-down",
    summary="Get project drill-down report",
    description="Get drill-down report with detailed breakdown"
)
async def get_project_drill_down(
    project_id: UUID,
    start_date: date = Query(description="Start of reporting period"),
    end_date: date = Query(description="End of reporting period"),
    group_by: str = Query(default="worker", description="Group by: worker, date, or phase"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get drill-down report for a project.
    
    Provides detailed breakdown by worker, date, or phase.
    """
    try:
        report = reporting_service.get_drill_down_report(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        
        return report
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate drill-down report: {str(e)}"
        )


@router.get(
    "/{project_id}/summary",
    response_model=ProjectSummary,
    summary="Get project summary",
    description="Get a brief summary of a project"
)
async def get_project_summary(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a brief summary of a project.
    
    Returns essential project information without full details.
    """
    project = project_service.get_project(db, project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )
    
    return ProjectSummary(
        id=project.id,
        name=project.name,
        program_id=project.program_id,
        program_name=project.program.name if project.program else "",
        project_manager=project.project_manager,
        start_date=project.start_date,
        end_date=project.end_date,
        cost_center_code=project.cost_center_code
    )
