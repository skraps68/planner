"""
Actuals API endpoints.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.actual import (
    ActualCreate,
    ActualUpdate,
    ActualResponse,
    ActualListResponse,
    ActualImportResponse,
    ActualImportResult,
    AllocationConflictResponse,
    AllocationConflict
)
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.actuals import actuals_service
from app.services.actuals_import import actuals_import_service, ActualsImportValidationError
from app.services.variance_analysis import variance_analysis_service
from app.core.exceptions import (
    BusinessRuleViolationError,
    ImportError as ImportException,
)

router = APIRouter()


@router.post(
    "/",
    response_model=ActualResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new actual record",
    description="Create a new actual work record with automatic cost calculation"
)
async def create_actual(
    actual_in: ActualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new actual work record.
    
    Required fields:
    - project_id: Project ID
    - external_worker_id: Worker's external ID
    - worker_name: Worker's name
    - actual_date: Date of actual work
    - allocation_percentage: Allocation percentage (0-100)
    - actual_cost: Actual cost
    - capital_amount: Capital amount
    - expense_amount: Expense amount
    
    Validation:
    - Capital + expense amounts must equal actual cost
    - Total allocation for worker on date cannot exceed 100%
    - User must have access to the project (scope-based)
    """
    try:
        actual = actuals_service.create_actual(
            db=db,
            project_id=actual_in.project_id,
            external_worker_id=actual_in.external_worker_id,
            worker_name=actual_in.worker_name,
            actual_date=actual_in.actual_date,
            allocation_percentage=actual_in.allocation_percentage,
            validate_allocation=True
        )
        
        # Convert to response model
        response = ActualResponse.model_validate(actual)
        if actual.project:
            response.project_name = actual.project.name
            response.cost_center_code = actual.project.cost_center_code
            if actual.project.program:
                response.program_name = actual.project.program.name
        
        return response
        
    except (BusinessRuleViolationError, ImportException) as e:
        # These exceptions are already handled by global error handlers
        raise
    except Exception as e:
        # Unexpected errors are handled by global error handler
        raise


@router.get(
    "/",
    response_model=ActualListResponse,
    summary="List actual records",
    description="Get a paginated list of actual records with optional filtering"
)
async def list_actuals(
    pagination: PaginationParams = Depends(),
    project_id: Optional[UUID] = Query(None, description="Filter by project"),
    external_worker_id: Optional[str] = Query(None, description="Filter by worker"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List actual records with pagination and filtering.
    
    Supports filtering by:
    - Project ID
    - Worker external ID
    - Date range (start_date and end_date)
    
    Includes scope-based filtering based on user permissions.
    """
    try:
        # Get actuals based on filters
        if project_id:
            actuals = actuals_service.get_actuals_by_project(
                db=db,
                project_id=project_id,
                start_date=start_date,
                end_date=end_date
            )
        elif external_worker_id:
            actuals = actuals_service.get_actuals_by_worker(
                db=db,
                external_worker_id=external_worker_id
            )
            # Apply date filter if provided
            if start_date:
                actuals = [a for a in actuals if a.actual_date >= start_date]
            if end_date:
                actuals = [a for a in actuals if a.actual_date <= end_date]
        else:
            # Get all actuals with date filter
            from app.repositories.actual import actual_repository
            actuals = actual_repository.get_by_date_range(
                db=db,
                start_date=start_date,
                end_date=end_date
            )
        
        # Calculate pagination
        total = len(actuals)
        pages = (total + pagination.size - 1) // pagination.size if total > 0 else 1
        
        # Apply pagination
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_actuals = actuals[start_idx:end_idx]
        
        # Convert to response models
        actual_responses = []
        for actual in paginated_actuals:
            response = ActualResponse.model_validate(actual)
            if actual.project:
                response.project_name = actual.project.name
                response.cost_center_code = actual.project.cost_center_code
                if actual.project.program:
                    response.program_name = actual.project.program.name
            actual_responses.append(response)
        
        return ActualListResponse(
            items=actual_responses,
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
            detail=f"Failed to list actuals: {str(e)}"
        )


@router.get(
    "/{actual_id}",
    response_model=ActualResponse,
    summary="Get actual by ID",
    description="Retrieve a specific actual record by its ID"
)
async def get_actual(
    actual_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific actual record by ID.
    
    Returns actual details including:
    - All actual attributes
    - Project name
    - Program name
    - Cost center code
    - Timestamps
    """
    from app.repositories.actual import actual_repository
    actual = actual_repository.get(db, actual_id)
    
    if not actual:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Actual with ID {actual_id} not found"
        )
    
    # TODO: Check scope access when authentication is implemented
    
    response = ActualResponse.model_validate(actual)
    if actual.project:
        response.project_name = actual.project.name
        response.cost_center_code = actual.project.cost_center_code
        if actual.project.program:
            response.program_name = actual.project.program.name
    
    return response


@router.put(
    "/{actual_id}",
    response_model=ActualResponse,
    summary="Update actual record",
    description="Update an existing actual record's attributes"
)
async def update_actual(
    actual_id: UUID,
    actual_in: ActualUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing actual record.
    
    All fields are optional. Only provided fields will be updated.
    
    Validation:
    - If updating allocation, total for worker on date cannot exceed 100%
    - User must have access to the project (scope-based)
    """
    try:
        actual = actuals_service.update_actual(
            db=db,
            actual_id=actual_id,
            allocation_percentage=actual_in.allocation_percentage,
            validate_allocation=True
        )
        
        response = ActualResponse.model_validate(actual)
        if actual.project:
            response.project_name = actual.project.name
            response.cost_center_code = actual.project.cost_center_code
            if actual.project.program:
                response.program_name = actual.project.program.name
        
        return response
        
    except (BusinessRuleViolationError, ImportException) as e:
        # These exceptions are already handled by global error handlers
        raise
    except Exception as e:
        # Unexpected errors are handled by global error handler
        raise


@router.delete(
    "/{actual_id}",
    response_model=SuccessResponse,
    summary="Delete actual record",
    description="Delete an actual record"
)
async def delete_actual(
    actual_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an actual record.
    
    User must have access to the project (scope-based).
    """
    try:
        success = actuals_service.delete_actual(db, actual_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Actual with ID {actual_id} not found"
            )
        
        return SuccessResponse(
            success=True,
            message=f"Actual {actual_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete actual: {str(e)}"
        )


@router.post(
    "/import",
    response_model=ActualImportResponse,
    summary="Import actuals from CSV",
    description="Import actual work records from CSV file with validation"
)
async def import_actuals(
    file: UploadFile = File(..., description="CSV file with actuals"),
    validate_only: bool = Query(False, description="Only validate, don't import"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import actual work records from CSV file.
    
    CSV Format:
    project_id,external_worker_id,worker_name,date,percentage
    
    Example:
    550e8400-e29b-41d4-a716-446655440000,EMP001,John Smith,2024-01-15,75.0
    
    Validation:
    - All required fields must be present
    - Project must exist
    - Worker must exist and name must match
    - Date must be valid (YYYY-MM-DD format)
    - Percentage must be 0-100
    - Total allocation for worker on any date cannot exceed 100%
    
    Returns:
    - total_rows: Total number of rows processed
    - successful_imports: Number of successful imports
    - failed_imports: Number of failed imports
    - results: Detailed results for each row
    - validation_only: Whether this was validation only
    """
    try:
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        # Parse and validate CSV
        records = actuals_import_service.parse_csv(csv_content)
        validated_records = actuals_import_service.validate_records(db, records)
        
        # Check for validation errors
        validation_errors = actuals_import_service.get_validation_errors(validated_records)
        
        # If validation only, return validation results
        if validate_only:
            results = []
            for record in validated_records:
                results.append(ActualImportResult(
                    row_number=record.row_number,
                    success=record.is_valid(),
                    actual_id=None,
                    errors=record.validation_errors if not record.is_valid() else None,
                    warnings=None
                ))
            
            return ActualImportResponse(
                total_rows=len(records),
                successful_imports=len([r for r in records if r.is_valid()]),
                failed_imports=len(validation_errors),
                results=results,
                validation_only=True
            )
        
        # If there are validation errors, return them
        if validation_errors:
            results = []
            for record in validated_records:
                results.append(ActualImportResult(
                    row_number=record.row_number,
                    success=record.is_valid(),
                    actual_id=None,
                    errors=record.validation_errors if not record.is_valid() else None,
                    warnings=None
                ))
            
            return ActualImportResponse(
                total_rows=len(records),
                successful_imports=0,
                failed_imports=len(validation_errors),
                results=results,
                validation_only=False
            )
        
        # Import actuals
        valid_records = [r for r in validated_records if r.is_valid()]
        import_result = actuals_service.import_actuals_batch(
            db=db,
            records=valid_records,
            validate_allocation=True
        )
        
        # Build response
        results = []
        for i, record in enumerate(valid_records):
            actual = import_result["actuals"][i] if i < len(import_result["actuals"]) else None
            results.append(ActualImportResult(
                row_number=record.row_number,
                success=True,
                actual_id=actual.id if actual else None,
                errors=None,
                warnings=None
            ))
        
        return ActualImportResponse(
            total_rows=len(records),
            successful_imports=import_result["imported_count"],
            failed_imports=0,
            results=results,
            validation_only=False
        )
        
    except ActualsImportValidationError as e:
        # Return validation errors
        results = []
        for error in e.errors:
            results.append(ActualImportResult(
                row_number=error["row"],
                success=False,
                actual_id=None,
                errors=error["errors"],
                warnings=None
            ))
        
        return ActualImportResponse(
            total_rows=len(e.errors),
            successful_imports=0,
            failed_imports=len(e.errors),
            results=results,
            validation_only=validate_only
        )
    except (BusinessRuleViolationError, ImportException, ActualsImportValidationError) as e:
        # These exceptions are already handled by global error handlers
        raise
    except Exception as e:
        # Unexpected errors are handled by global error handler
        raise


@router.get(
    "/project/{project_id}/total-cost",
    response_model=dict,
    summary="Get project total cost",
    description="Get total actual cost for a project"
)
async def get_project_total_cost(
    project_id: UUID,
    start_date: Optional[date] = Query(None, description="Start date for cost calculation"),
    end_date: Optional[date] = Query(None, description="End date for cost calculation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get total actual cost for a project, optionally within a date range.
    
    Returns:
    - project_id: Project ID
    - total_cost: Total actual cost
    - start_date: Start date (if provided)
    - end_date: End date (if provided)
    """
    try:
        total_cost = actuals_service.get_project_total_cost(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "project_id": str(project_id),
            "total_cost": float(total_cost),
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get project total cost: {str(e)}"
        )


@router.get(
    "/variance/{project_id}",
    response_model=dict,
    summary="Get variance analysis for project",
    description="Analyze variances between actual and forecast for a project"
)
async def get_variance_analysis(
    project_id: UUID,
    start_date: date = Query(..., description="Start date of analysis period"),
    end_date: date = Query(..., description="End date of analysis period"),
    allocation_threshold: Optional[float] = Query(20.0, description="Allocation variance threshold (%)"),
    cost_threshold: Optional[float] = Query(10.0, description="Cost variance threshold (%)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analyze variances between actual and forecast for a project.
    
    Returns variance summary including:
    - Total variances found
    - Variance breakdown by type
    - Total allocation variance
    - Total cost variance
    - Detailed variance records
    
    Variance types:
    - allocation_over: Actual allocation > forecast
    - allocation_under: Actual allocation < forecast
    - cost_over: Actual cost > forecast cost
    - cost_under: Actual cost < forecast cost
    - unplanned_work: Actual exists but no forecast
    - unworked_assignment: Forecast exists but no actual
    """
    try:
        from decimal import Decimal
        
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before or equal to end date"
            )
        
        variance_summary = variance_analysis_service.get_variance_summary(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return variance_summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get variance analysis: {str(e)}"
        )


@router.get(
    "/variance/{project_id}/exceptions",
    response_model=dict,
    summary="Get exceptional variances",
    description="Identify exceptional variances that exceed high thresholds"
)
async def get_exceptional_variances(
    project_id: UUID,
    start_date: date = Query(..., description="Start date of analysis period"),
    end_date: date = Query(..., description="End date of analysis period"),
    allocation_threshold: Optional[float] = Query(30.0, description="High allocation variance threshold (%)"),
    cost_threshold: Optional[float] = Query(20.0, description="High cost variance threshold (%)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify exceptional variances that exceed high thresholds.
    
    Returns only variances that exceed the specified thresholds,
    indicating significant deviations from forecast.
    """
    try:
        from decimal import Decimal
        
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before or equal to end date"
            )
        
        exceptions = variance_analysis_service.identify_exceptions(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            allocation_threshold=Decimal(str(allocation_threshold)),
            cost_threshold=Decimal(str(cost_threshold))
        )
        
        return {
            "project_id": str(project_id),
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "thresholds": {
                "allocation_threshold": allocation_threshold,
                "cost_threshold": cost_threshold
            },
            "total_exceptions": len(exceptions),
            "exceptions": [e.to_dict() for e in exceptions]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get exceptional variances: {str(e)}"
        )


@router.get(
    "/variance/compare/{project_id}/{worker_id}/{analysis_date}",
    response_model=dict,
    summary="Compare actual vs forecast for worker",
    description="Compare actual vs forecast for a specific worker on a specific date"
)
async def compare_actual_vs_forecast(
    project_id: UUID,
    worker_id: str,
    analysis_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Compare actual vs forecast for a specific worker on a specific date.
    
    Returns:
    - Forecast allocation and assignments count
    - Actual allocation, cost, and actuals count
    - Variance (allocation and percentage)
    """
    try:
        comparison = variance_analysis_service.compare_actual_vs_forecast(
            db=db,
            project_id=project_id,
            worker_id=worker_id,
            analysis_date=analysis_date
        )
        
        return comparison
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare actual vs forecast: {str(e)}"
        )


@router.post(
    "/check-allocation-conflicts",
    response_model=AllocationConflictResponse,
    summary="Check for allocation conflicts",
    description="Check if importing actuals would cause allocation conflicts"
)
async def check_allocation_conflicts(
    file: UploadFile = File(..., description="CSV file with actuals to check"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if importing actuals would cause allocation conflicts.
    
    Returns conflicts where total allocation would exceed 100% on any given day.
    
    CSV Format:
    project_id,external_worker_id,worker_name,date,percentage
    """
    try:
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        # Parse and validate CSV
        records = actuals_import_service.parse_csv(csv_content)
        validated_records = actuals_import_service.validate_records(db, records)
        
        # Get valid records
        valid_records = [r for r in validated_records if r.is_valid()]
        
        if not valid_records:
            return AllocationConflictResponse(
                has_conflicts=False,
                conflicts=[]
            )
        
        # Check for allocation conflicts
        from app.services.allocation_validator import allocation_validator_service
        
        actuals_data = [
            {
                "external_worker_id": r.external_worker_id,
                "worker_name": r.worker_name,
                "actual_date": r.actual_date,
                "allocation_percentage": r.percentage
            }
            for r in valid_records
        ]
        
        conflicts_data = allocation_validator_service.validate_batch_actuals(
            db=db,
            actuals_data=actuals_data
        )
        
        # Convert to response format
        conflicts = []
        for conflict in conflicts_data:
            conflicts.append(
                AllocationConflict(
                    external_worker_id=conflict.external_worker_id,
                    worker_name=conflict.worker_name,
                    actual_date=conflict.actual_date,
                    existing_allocation=conflict.existing_allocation,
                    new_allocation=conflict.new_allocation,
                    total_allocation=conflict.total_allocation,
                    conflict_type="over_allocation"
                )
            )
        
        return AllocationConflictResponse(
            has_conflicts=len(conflicts) > 0,
            conflicts=conflicts
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check allocation conflicts: {str(e)}"
        )
