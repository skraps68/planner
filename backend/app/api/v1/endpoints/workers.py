"""
Worker and WorkerType API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.resource import (
    WorkerCreate,
    WorkerUpdate,
    WorkerResponse,
    WorkerListResponse,
    WorkerSummary,
    WorkerTypeCreate,
    WorkerTypeUpdate,
    WorkerTypeResponse
)
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.resource import worker_service, worker_type_service
from app.core.exceptions import ConflictError

router = APIRouter()


# Worker Type Endpoints
@router.post(
    "/types",
    response_model=WorkerTypeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new worker type",
    description="Create a new worker type category"
)
async def create_worker_type(
    worker_type_in: WorkerTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new worker type.
    
    Required fields:
    - type: Worker type name (must be unique)
    - description: Worker type description
    """
    try:
        worker_type = worker_type_service.create_worker_type(
            db=db,
            type=worker_type_in.type,
            description=worker_type_in.description
        )
        
        # Convert to response model
        response = WorkerTypeResponse.model_validate(worker_type)
        response.worker_count = len(worker_type.workers) if worker_type.workers else 0
        
        # Get current rate if available
        from app.services.resource import rate_service
        current_rate = rate_service.get_current_rate(db, worker_type.id)
        response.current_rate = str(current_rate.rate_amount) if current_rate else None
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create worker type: {str(e)}"
        )


@router.get(
    "/types",
    response_model=List[WorkerTypeResponse],
    summary="List worker types",
    description="Get a list of all worker types"
)
async def list_worker_types(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="Search term for worker type name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List worker types with pagination and filtering.
    
    Supports filtering by:
    - Search term (worker type name)
    """
    try:
        # Apply filters
        if search:
            worker_types = worker_type_service.search_worker_types(db, search)
        else:
            skip = (pagination.page - 1) * pagination.size
            worker_types = worker_type_service.list_worker_types(
                db=db,
                skip=skip,
                limit=pagination.size
            )
        
        # Convert to response models
        from app.services.resource import rate_service
        worker_type_responses = []
        for worker_type in worker_types:
            response = WorkerTypeResponse.model_validate(worker_type)
            response.worker_count = len(worker_type.workers) if worker_type.workers else 0
            
            # Get current rate if available
            current_rate = rate_service.get_current_rate(db, worker_type.id)
            response.current_rate = str(current_rate.rate_amount) if current_rate else None
            
            worker_type_responses.append(response)
        
        return worker_type_responses
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list worker types: {str(e)}"
        )


@router.get(
    "/types/{worker_type_id}",
    response_model=WorkerTypeResponse,
    summary="Get worker type by ID",
    description="Retrieve a specific worker type by its ID"
)
async def get_worker_type(
    worker_type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific worker type by ID.
    
    Returns worker type details including:
    - All worker type attributes
    - Worker count
    - Current rate
    - Timestamps
    """
    worker_type = worker_type_service.get_worker_type(db, worker_type_id)
    
    if not worker_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker type with ID {worker_type_id} not found"
        )
    
    response = WorkerTypeResponse.model_validate(worker_type)
    response.worker_count = len(worker_type.workers) if worker_type.workers else 0
    
    # Get current rate if available
    from app.services.resource import rate_service
    current_rate = rate_service.get_current_rate(db, worker_type.id)
    response.current_rate = str(current_rate.rate_amount) if current_rate else None
    
    return response


@router.get(
    "/types/name/{type_name}",
    response_model=WorkerTypeResponse,
    summary="Get worker type by name",
    description="Retrieve a specific worker type by its type name"
)
async def get_worker_type_by_name(
    type_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific worker type by type name.
    """
    worker_type = worker_type_service.get_worker_type_by_name(db, type_name)
    
    if not worker_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker type with name '{type_name}' not found"
        )
    
    response = WorkerTypeResponse.model_validate(worker_type)
    response.worker_count = len(worker_type.workers) if worker_type.workers else 0
    
    # Get current rate if available
    from app.services.resource import rate_service
    current_rate = rate_service.get_current_rate(db, worker_type.id)
    response.current_rate = str(current_rate.rate_amount) if current_rate else None
    
    return response


@router.put(
    "/types/{worker_type_id}",
    response_model=WorkerTypeResponse,
    summary="Update worker type",
    description="Update an existing worker type's attributes"
)
async def update_worker_type(
    worker_type_id: UUID,
    worker_type_in: WorkerTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing worker type.
    
    All fields are optional. Only provided fields will be updated.
    """
    try:
        worker_type = worker_type_service.update_worker_type(
            db=db,
            worker_type_id=worker_type_id,
            type=worker_type_in.type,
            description=worker_type_in.description
        )
        
        response = WorkerTypeResponse.model_validate(worker_type)
        response.worker_count = len(worker_type.workers) if worker_type.workers else 0
        
        # Get current rate if available
        from app.services.resource import rate_service
        current_rate = rate_service.get_current_rate(db, worker_type.id)
        response.current_rate = str(current_rate.rate_amount) if current_rate else None
        
        return response
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        current_worker_type = worker_type_service.get_worker_type(db, worker_type_id)
        if current_worker_type:
            current_state = WorkerTypeResponse.model_validate(current_worker_type).model_dump()
            raise ConflictError("worker_type", str(worker_type_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Worker type with ID {worker_type_id} not found"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update worker type: {str(e)}"
        )


@router.delete(
    "/types/{worker_type_id}",
    response_model=SuccessResponse,
    summary="Delete worker type",
    description="Delete a worker type (only if it has no associated workers)"
)
async def delete_worker_type(
    worker_type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a worker type.
    
    A worker type can only be deleted if it has no associated workers.
    """
    try:
        worker_type_service.delete_worker_type(db, worker_type_id)
        
        return SuccessResponse(
            success=True,
            message=f"Worker type {worker_type_id} deleted successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete worker type: {str(e)}"
        )


# Worker Endpoints
@router.post(
    "/",
    response_model=WorkerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new worker",
    description="Create a new worker with worker type association"
)
async def create_worker(
    worker_in: WorkerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new worker.
    
    Required fields:
    - external_id: External worker identifier (must be unique)
    - name: Worker name
    - worker_type_id: Worker type ID
    """
    try:
        worker = worker_service.create_worker(
            db=db,
            external_id=worker_in.external_id,
            name=worker_in.name,
            worker_type_id=worker_in.worker_type_id
        )
        
        # Convert to response model
        response = WorkerResponse.model_validate(worker)
        response.worker_type_name = worker.worker_type.type if worker.worker_type else None
        
        # Get current rate for the worker type
        from app.services.resource import rate_service
        current_rate = rate_service.get_current_rate(db, worker.worker_type_id)
        response.current_rate = str(current_rate.rate_amount) if current_rate else None
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create worker: {str(e)}"
        )


@router.get(
    "/",
    response_model=WorkerListResponse,
    summary="List workers",
    description="Get a paginated list of workers with optional filtering"
)
async def list_workers(
    pagination: PaginationParams = Depends(),
    worker_type_id: Optional[UUID] = Query(None, description="Filter by worker type"),
    search: Optional[str] = Query(None, description="Search term for worker name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List workers with pagination and filtering.
    
    Supports filtering by:
    - Worker type
    - Search term (worker name)
    
    Includes scope-based filtering based on user permissions.
    """
    try:
        # Apply filters
        if search:
            workers = worker_service.search_workers(db, search, user_id=current_user.id)
        else:
            skip = (pagination.page - 1) * pagination.size
            workers = worker_service.list_workers(
                db=db,
                skip=skip,
                limit=pagination.size,
                worker_type_id=worker_type_id,
                user_id=current_user.id
            )
        
        # Calculate pagination
        total = len(workers)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Apply pagination to filtered results
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_workers = workers[start_idx:end_idx]
        
        # Convert to response models
        from app.services.resource import rate_service
        worker_responses = []
        for worker in paginated_workers:
            response = WorkerResponse.model_validate(worker)
            response.worker_type_name = worker.worker_type.type if worker.worker_type else None
            
            # Get current rate for the worker type
            current_rate = rate_service.get_current_rate(db, worker.worker_type_id)
            response.current_rate = str(current_rate.rate_amount) if current_rate else None
            
            worker_responses.append(response)
        
        return WorkerListResponse(
            items=worker_responses,
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
            detail=f"Failed to list workers: {str(e)}"
        )


@router.get(
    "/{worker_id}",
    response_model=WorkerResponse,
    summary="Get worker by ID",
    description="Retrieve a specific worker by its ID"
)
async def get_worker(
    worker_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific worker by ID.
    
    Returns worker details including:
    - All worker attributes
    - Worker type information
    - Current rate
    - Timestamps
    """
    worker = worker_service.get_worker(db, worker_id)
    
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker with ID {worker_id} not found"
        )
    
    response = WorkerResponse.model_validate(worker)
    response.worker_type_name = worker.worker_type.type if worker.worker_type else None
    
    # Get current rate for the worker type
    from app.services.resource import rate_service
    current_rate = rate_service.get_current_rate(db, worker.worker_type_id)
    response.current_rate = str(current_rate.rate_amount) if current_rate else None
    
    return response


@router.get(
    "/external/{external_id}",
    response_model=WorkerResponse,
    summary="Get worker by external ID",
    description="Retrieve a specific worker by its external ID"
)
async def get_worker_by_external_id(
    external_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific worker by external ID.
    """
    worker = worker_service.get_worker_by_external_id(db, external_id)
    
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker with external ID '{external_id}' not found"
        )
    
    response = WorkerResponse.model_validate(worker)
    response.worker_type_name = worker.worker_type.type if worker.worker_type else None
    
    # Get current rate for the worker type
    from app.services.resource import rate_service
    current_rate = rate_service.get_current_rate(db, worker.worker_type_id)
    response.current_rate = str(current_rate.rate_amount) if current_rate else None
    
    return response


@router.put(
    "/{worker_id}",
    response_model=WorkerResponse,
    summary="Update worker",
    description="Update an existing worker's attributes"
)
async def update_worker(
    worker_id: UUID,
    worker_in: WorkerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing worker.
    
    All fields are optional. Only provided fields will be updated.
    """
    try:
        worker = worker_service.update_worker(
            db=db,
            worker_id=worker_id,
            external_id=worker_in.external_id,
            name=worker_in.name,
            worker_type_id=worker_in.worker_type_id
        )
        
        response = WorkerResponse.model_validate(worker)
        response.worker_type_name = worker.worker_type.type if worker.worker_type else None
        
        # Get current rate for the worker type
        from app.services.resource import rate_service
        current_rate = rate_service.get_current_rate(db, worker.worker_type_id)
        response.current_rate = str(current_rate.rate_amount) if current_rate else None
        
        return response
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        current_worker = worker_service.get_worker(db, worker_id)
        if current_worker:
            current_state = WorkerResponse.model_validate(current_worker).model_dump()
            raise ConflictError("worker", str(worker_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Worker with ID {worker_id} not found"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update worker: {str(e)}"
        )


@router.delete(
    "/{worker_id}",
    response_model=SuccessResponse,
    summary="Delete worker",
    description="Delete a worker"
)
async def delete_worker(
    worker_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a worker.
    """
    try:
        worker_service.delete_worker(db, worker_id)
        
        return SuccessResponse(
            success=True,
            message=f"Worker {worker_id} deleted successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete worker: {str(e)}"
        )
