"""
Phase API endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.phase import (
    PhaseCreate,
    PhaseUpdate,
    PhaseResponse,
    PhaseValidationRequest,
    PhaseValidationResult,
    PhaseBatchUpdate
)
from app.schemas.assignment import ResourceAssignmentResponse
from app.services.phase_service import phase_service
from app.core.exceptions import ValidationError, ResourceNotFoundError

router = APIRouter()


@router.post(
    "/projects/{project_id}/phases/batch",
    response_model=List[PhaseResponse],
    status_code=status.HTTP_200_OK,
    summary="Batch update all phases for a project",
    description="""
    Atomically update all phases for a project. This is the primary endpoint for saving phase changes.
    
    **Key Features:**
    - Accepts complete list of phases (new phases have id=null, existing phases include their UUID)
    - Validates timeline continuity before making any changes
    - Atomic operation: either all changes succeed or all fail
    - Phases not included in the request will be deleted
    
    **Validation Rules:**
    - Phases must form a continuous timeline from project start to end
    - No gaps or overlaps allowed between phases
    - Phase dates must fall within project dates
    - At least one phase must exist
    
    **Example Request:**
    ```json
    {
      "phases": [
        {
          "id": null,
          "name": "Planning",
          "start_date": "2024-01-01",
          "end_date": "2024-03-31",
          "capital_budget": 50000.00,
          "expense_budget": 25000.00,
          "total_budget": 75000.00
        },
        {
          "id": "existing-phase-uuid",
          "name": "Execution",
          "start_date": "2024-04-01",
          "end_date": "2024-12-31",
          "capital_budget": 150000.00,
          "expense_budget": 75000.00,
          "total_budget": 225000.00
        }
      ]
    }
    ```
    """,
    responses={
        200: {
            "description": "Phases successfully updated",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": "123e4567-e89b-12d3-a456-426614174001",
                            "project_id": "123e4567-e89b-12d3-a456-426614174000",
                            "name": "Planning",
                            "start_date": "2024-01-01",
                            "end_date": "2024-03-31",
                            "description": None,
                            "capital_budget": 50000.00,
                            "expense_budget": 25000.00,
                            "total_budget": 75000.00,
                            "assignment_count": 0,
                            "created_at": "2024-01-01T00:00:00",
                            "updated_at": "2024-01-01T00:00:00"
                        }
                    ]
                }
            }
        },
        404: {
            "description": "Project not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Project not found"}
                }
            }
        },
        422: {
            "description": "Validation failed",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Gap detected between Planning and Execution phases"
                    }
                }
            }
        }
    }
)
async def batch_update_phases(
    project_id: UUID,
    batch_data: PhaseBatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Batch update all phases for a project.
    
    This endpoint accepts a complete list of phases and performs all
    creates/updates/deletes atomically. It validates the entire set
    for timeline continuity before making any changes.
    
    The frontend should always send the complete list of phases when saving.
    
    Args:
        project_id: Project ID
        batch_data: Complete list of phases
        
    Returns:
        List of all phases after update
        
    Raises:
        404: If project not found
        422: If phase validation fails
    """
    try:
        # Convert Pydantic models to dicts for the service
        phases_data = [
            {
                "id": phase.id,
                "name": phase.name,
                "start_date": phase.start_date,
                "end_date": phase.end_date,
                "description": phase.description,
                "capital_budget": phase.capital_budget,
                "expense_budget": phase.expense_budget,
                "total_budget": phase.total_budget
            }
            for phase in batch_data.phases
        ]
        
        phases = phase_service.update_project_phases(
            db=db,
            project_id=project_id,
            phases=phases_data
        )
        
        return [PhaseResponse.model_validate(phase) for phase in phases]
        
    except ResourceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
            headers={"X-Error-Code": e.code}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/projects/{project_id}/phases",
    response_model=List[PhaseResponse],
    summary="List all phases for a project",
    description="""
    Get all phases for a project in chronological order by start_date.
    
    **Returns:**
    - List of phases sorted by start_date
    - Each phase includes assignment_count (number of resource assignments in that phase)
    
    **Example Response:**
    ```json
    [
      {
        "id": "uuid",
        "project_id": "uuid",
        "name": "Planning",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "description": "Initial planning phase",
        "capital_budget": 50000.00,
        "expense_budget": 25000.00,
        "total_budget": 75000.00,
        "assignment_count": 15,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00"
      }
    ]
    ```
    """,
    responses={
        200: {
            "description": "List of phases",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": "123e4567-e89b-12d3-a456-426614174001",
                            "project_id": "123e4567-e89b-12d3-a456-426614174000",
                            "name": "Planning",
                            "start_date": "2024-01-01",
                            "end_date": "2024-03-31",
                            "capital_budget": 50000.00,
                            "expense_budget": 25000.00,
                            "total_budget": 75000.00,
                            "assignment_count": 15
                        }
                    ]
                }
            }
        }
    }
)
async def list_phases(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all phases for a project.
    
    Returns phases in chronological order by start_date.
    
    Args:
        project_id: Project ID
        
    Returns:
        List of phases
    """
    try:
        from app.repositories.project import project_phase_repository
        
        phases = project_phase_repository.get_by_project(db, project_id)
        phases_sorted = sorted(phases, key=lambda p: p.start_date)
        
        return [PhaseResponse.model_validate(phase) for phase in phases_sorted]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/phases/{phase_id}",
    response_model=PhaseResponse,
    summary="Get a specific phase",
    description="""
    Get details of a specific phase by ID.
    
    **Returns:**
    - Complete phase information including budget details
    - Assignment count for the phase
    
    **Example Response:**
    ```json
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31",
      "description": "Initial planning phase",
      "capital_budget": 50000.00,
      "expense_budget": 25000.00,
      "total_budget": 75000.00,
      "assignment_count": 15,
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-01T00:00:00"
    }
    ```
    """,
    responses={
        200: {"description": "Phase details"},
        404: {
            "description": "Phase not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Phase not found"}
                }
            }
        }
    }
)
async def get_phase(
    phase_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific phase.
    
    Args:
        phase_id: Phase ID
        
    Returns:
        Phase details
        
    Raises:
        404: If phase not found
    """
    try:
        from app.repositories.project import project_phase_repository
        
        phase = project_phase_repository.get(db, phase_id)
        if not phase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Phase {phase_id} not found"
            )
        
        return PhaseResponse.model_validate(phase)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/projects/{project_id}/phases/validate",
    response_model=PhaseValidationResult,
    summary="Validate phases without saving",
    description="""
    Validate a set of phases for timeline continuity without persisting changes.
    
    **Use Cases:**
    - Real-time validation in the Phase Editor UI
    - Pre-flight checks before batch updates
    - Validation feedback for user input
    
    **Validation Checks:**
    - Timeline continuity (no gaps)
    - No overlaps between phases
    - Phase dates within project boundaries
    - Date ordering (start_date <= end_date)
    - At least one phase exists
    
    **Example Request:**
    ```json
    [
      {
        "id": null,
        "name": "Planning",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31"
      },
      {
        "id": "existing-uuid",
        "name": "Execution",
        "start_date": "2024-04-01",
        "end_date": "2024-12-31"
      }
    ]
    ```
    
    **Example Success Response:**
    ```json
    {
      "is_valid": true,
      "errors": []
    }
    ```
    
    **Example Error Response:**
    ```json
    {
      "is_valid": false,
      "errors": [
        {
          "field": "timeline",
          "message": "Gap detected between Planning and Execution",
          "phase_id": "uuid"
        }
      ]
    }
    ```
    """,
    responses={
        200: {
            "description": "Validation result",
            "content": {
                "application/json": {
                    "examples": {
                        "valid": {
                            "summary": "Valid phases",
                            "value": {
                                "is_valid": True,
                                "errors": []
                            }
                        },
                        "invalid": {
                            "summary": "Invalid phases with gap",
                            "value": {
                                "is_valid": False,
                                "errors": [
                                    {
                                        "field": "timeline",
                                        "message": "Gap detected between Planning and Execution",
                                        "phase_id": None
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        },
        404: {
            "description": "Project not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Project not found"}
                }
            }
        }
    }
)
async def validate_phases(
    project_id: UUID,
    phases: List[PhaseValidationRequest],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validate a set of phases without saving.
    
    This endpoint allows the frontend to validate phase changes
    before submitting them for persistence.
    
    Args:
        project_id: Project ID
        phases: List of phases to validate
        
    Returns:
        Validation result with errors if any
        
    Raises:
        404: If project not found
    """
    try:
        from app.repositories.project import project_repository
        from app.services.phase_validator import PhaseValidatorService
        
        # Get project
        project = project_repository.get(db, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        
        # Convert to validation format
        phases_data = [
            {
                "id": phase.id,
                "name": phase.name,
                "start_date": phase.start_date,
                "end_date": phase.end_date
            }
            for phase in phases
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project.start_date,
            project.end_date,
            phases_data
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/phases/{phase_id}/assignments",
    response_model=List[ResourceAssignmentResponse],
    summary="Get assignments for a phase",
    description="""
    Get all resource assignments that fall within a phase's date range.
    
    **Implicit Relationship:**
    This endpoint demonstrates the date-based implicit relationship between phases and assignments.
    Assignments are associated with a phase when their assignment_date falls within the phase's
    start_date and end_date range (inclusive).
    
    **Query Logic:**
    ```sql
    SELECT * FROM resource_assignments
    WHERE project_id = phase.project_id
      AND assignment_date >= phase.start_date
      AND assignment_date <= phase.end_date
    ```
    
    **Benefits:**
    - No explicit foreign key needed
    - Assignments automatically move with phase date changes
    - Flexible phase reorganization without data updates
    
    **Example Response:**
    ```json
    [
      {
        "id": "uuid",
        "resource_id": "uuid",
        "project_id": "uuid",
        "assignment_date": "2024-01-15",
        "allocation_percentage": 100.00,
        "capital_percentage": 60.00,
        "expense_percentage": 40.00,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00"
      }
    ]
    ```
    """,
    responses={
        200: {
            "description": "List of resource assignments",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": "123e4567-e89b-12d3-a456-426614174002",
                            "resource_id": "123e4567-e89b-12d3-a456-426614174003",
                            "project_id": "123e4567-e89b-12d3-a456-426614174000",
                            "assignment_date": "2024-01-15",
                            "allocation_percentage": 100.00,
                            "capital_percentage": 60.00,
                            "expense_percentage": 40.00
                        }
                    ]
                }
            }
        },
        404: {
            "description": "Phase not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Phase not found"}
                }
            }
        }
    }
)
async def get_phase_assignments(
    phase_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all resource assignments for a phase.
    
    Returns assignments where assignment_date falls within the
    phase's start_date and end_date range.
    
    Args:
        phase_id: Phase ID
        
    Returns:
        List of resource assignments
        
    Raises:
        404: If phase not found
    """
    try:
        assignments = phase_service.get_assignments_for_phase(
            db=db,
            phase_id=phase_id
        )
        
        return [ResourceAssignmentResponse.model_validate(assignment) for assignment in assignments]
        
    except ResourceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
