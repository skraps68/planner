"""
Program API endpoints.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.program import (
    ProgramCreate,
    ProgramUpdate,
    ProgramResponse,
    ProgramListResponse,
    ProgramSummary
)
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.program import program_service

router = APIRouter()


@router.post(
    "/",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new program",
    description="Create a new program with required attributes"
)
async def create_program(
    program_in: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new program.
    
    Required fields:
    - name: Program name
    - business_sponsor: Business sponsor name
    - program_manager: Program manager name
    - technical_lead: Technical lead name
    - start_date: Program start date
    - end_date: Program end date (must be after start_date)
    
    Optional fields:
    - description: Program description
    """
    try:
        program = program_service.create_program(
            db=db,
            name=program_in.name,
            business_sponsor=program_in.business_sponsor,
            program_manager=program_in.program_manager,
            technical_lead=program_in.technical_lead,
            start_date=program_in.start_date,
            end_date=program_in.end_date,
            description=program_in.description
        )
        
        # Convert to response model
        response = ProgramResponse.model_validate(program)
        response.project_count = len(program.projects) if program.projects else 0
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create program: {str(e)}"
        )


@router.get(
    "/",
    response_model=ProgramListResponse,
    summary="List programs",
    description="Get a paginated list of programs with optional filtering"
)
async def list_programs(
    pagination: PaginationParams = Depends(),
    active_only: bool = Query(False, description="Filter for active programs only"),
    as_of_date: Optional[date] = Query(None, description="Date to check for active programs"),
    search: Optional[str] = Query(None, description="Search term for program name"),
    manager: Optional[str] = Query(None, description="Filter by program manager"),
    sponsor: Optional[str] = Query(None, description="Filter by business sponsor"),
    start_date: Optional[date] = Query(None, description="Filter by start date range"),
    end_date: Optional[date] = Query(None, description="Filter by end date range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List programs with pagination and filtering.
    
    Supports filtering by:
    - Active status (programs active on a specific date)
    - Search term (program name)
    - Program manager
    - Business sponsor
    - Date range
    """
    try:
        # Apply filters
        if search:
            programs = program_service.search_programs(db, search)
        elif manager:
            programs = program_service.get_programs_by_manager(db, manager)
        elif sponsor:
            programs = program_service.get_programs_by_sponsor(db, sponsor)
        elif start_date or end_date:
            programs = program_service.get_programs_by_date_range(db, start_date, end_date)
        else:
            skip = (pagination.page - 1) * pagination.size
            programs = program_service.list_programs(
                db=db,
                skip=skip,
                limit=pagination.size,
                active_only=active_only,
                as_of_date=as_of_date
            )
        
        # Calculate pagination
        total = len(programs)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Apply pagination to filtered results
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_programs = programs[start_idx:end_idx]
        
        # Convert to response models
        program_responses = []
        for program in paginated_programs:
            response = ProgramResponse.model_validate(program)
            response.project_count = len(program.projects) if program.projects else 0
            program_responses.append(response)
        
        return ProgramListResponse(
            items=program_responses,
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
            detail=f"Failed to list programs: {str(e)}"
        )


@router.get(
    "/{program_id}",
    response_model=ProgramResponse,
    summary="Get program by ID",
    description="Retrieve a specific program by its ID"
)
async def get_program(
    program_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific program by ID.
    
    Returns program details including:
    - All program attributes
    - Project count
    - Timestamps
    """
    program = program_service.get_program(db, program_id)
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Program with ID {program_id} not found"
        )
    
    response = ProgramResponse.model_validate(program)
    response.project_count = len(program.projects) if program.projects else 0
    
    return response


@router.get(
    "/name/{program_name}",
    response_model=ProgramResponse,
    summary="Get program by name",
    description="Retrieve a specific program by its name"
)
async def get_program_by_name(
    program_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific program by name.
    """
    program = program_service.get_program_by_name(db, program_name)
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Program with name '{program_name}' not found"
        )
    
    response = ProgramResponse.model_validate(program)
    response.project_count = len(program.projects) if program.projects else 0
    
    return response


@router.put(
    "/{program_id}",
    response_model=ProgramResponse,
    summary="Update program",
    description="Update an existing program's attributes"
)
async def update_program(
    program_id: UUID,
    program_in: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing program.
    
    All fields are optional. Only provided fields will be updated.
    Date validation is applied if dates are updated.
    """
    try:
        program = program_service.update_program(
            db=db,
            program_id=program_id,
            name=program_in.name,
            business_sponsor=program_in.business_sponsor,
            program_manager=program_in.program_manager,
            technical_lead=program_in.technical_lead,
            start_date=program_in.start_date,
            end_date=program_in.end_date,
            description=program_in.description
        )
        
        response = ProgramResponse.model_validate(program)
        response.project_count = len(program.projects) if program.projects else 0
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update program: {str(e)}"
        )


@router.delete(
    "/{program_id}",
    response_model=SuccessResponse,
    summary="Delete program",
    description="Delete a program (only if it has no associated projects)"
)
async def delete_program(
    program_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a program.
    
    A program can only be deleted if it has no associated projects.
    """
    try:
        program_service.delete_program(db, program_id)
        
        return SuccessResponse(
            success=True,
            message=f"Program {program_id} deleted successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete program: {str(e)}"
        )


@router.get(
    "/{program_id}/projects",
    response_model=List[dict],
    summary="Get program projects",
    description="Get all projects associated with a program"
)
async def get_program_projects(
    program_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all projects associated with a program.
    
    Returns a list of project summaries.
    """
    program = program_service.get_program(db, program_id)
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Program with ID {program_id} not found"
        )
    
    # Return project summaries
    projects = []
    for project in program.projects:
        projects.append({
            "id": project.id,
            "name": project.name,
            "project_manager": project.project_manager,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "cost_center_code": project.cost_center_code
        })
    
    return projects


@router.get(
    "/{program_id}/summary",
    response_model=ProgramSummary,
    summary="Get program summary",
    description="Get a brief summary of a program"
)
async def get_program_summary(
    program_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a brief summary of a program.
    
    Returns essential program information without full details.
    """
    program = program_service.get_program(db, program_id)
    
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Program with ID {program_id} not found"
        )
    
    return ProgramSummary(
        id=program.id,
        name=program.name,
        business_sponsor=program.business_sponsor,
        start_date=program.start_date,
        end_date=program.end_date,
        project_count=len(program.projects) if program.projects else 0
    )