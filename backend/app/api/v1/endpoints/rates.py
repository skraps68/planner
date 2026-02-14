"""
Rate management API endpoints with temporal queries.
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
from app.schemas.rate import (
    RateCreate,
    RateUpdate,
    RateResponse,
    RateListResponse,
    RateHistory,
    WorkerTypeRateHistory,
    RateEffectiveDate
)
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.resource import rate_service, worker_type_service
from app.core.exceptions import ConflictError

router = APIRouter()


@router.post(
    "/",
    response_model=RateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new rate",
    description="Create a new rate for a worker type, optionally closing the previous rate"
)
async def create_rate(
    rate_in: RateCreate,
    close_previous: bool = Query(True, description="Close the previous rate before creating new one"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new rate.
    
    Required fields:
    - worker_type_id: Worker type ID
    - rate_amount: Rate amount (must be positive)
    - start_date: Rate start date
    
    Optional fields:
    - end_date: Rate end date (null for current rate)
    - close_previous: If True, close the current rate before creating new one (default: True)
    """
    try:
        rate = rate_service.create_rate(
            db=db,
            worker_type_id=rate_in.worker_type_id,
            rate_amount=rate_in.rate_amount,
            start_date=rate_in.start_date,
            close_previous=close_previous
        )
        
        # Convert to response model
        response = RateResponse.model_validate(rate)
        response.worker_type_name = rate.worker_type.type if rate.worker_type else None
        response.is_current = rate.end_date is None
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create rate: {str(e)}"
        )


@router.get(
    "/",
    response_model=RateListResponse,
    summary="List rates",
    description="Get a paginated list of rates"
)
async def list_rates(
    pagination: PaginationParams = Depends(),
    worker_type_id: Optional[UUID] = Query(None, description="Filter by worker type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List rates with pagination and filtering.
    
    Supports filtering by:
    - Worker type
    """
    try:
        if worker_type_id:
            rates = rate_service.list_rates_by_worker_type(db, worker_type_id)
        else:
            # Get all rates (not implemented in service, so we'll return empty for now)
            rates = []
        
        # Calculate pagination
        total = len(rates)
        pages = (total + pagination.size - 1) // pagination.size if total > 0 else 1
        
        # Apply pagination
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_rates = rates[start_idx:end_idx]
        
        # Convert to response models
        rate_responses = []
        for rate in paginated_rates:
            response = RateResponse.model_validate(rate)
            response.worker_type_name = rate.worker_type.type if rate.worker_type else None
            response.is_current = rate.end_date is None
            rate_responses.append(response)
        
        return RateListResponse(
            items=rate_responses,
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
            detail=f"Failed to list rates: {str(e)}"
        )


@router.get(
    "/{rate_id}",
    response_model=RateResponse,
    summary="Get rate by ID",
    description="Retrieve a specific rate by its ID"
)
async def get_rate(
    rate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific rate by ID.
    
    Returns rate details including:
    - All rate attributes
    - Worker type information
    - Whether it's the current rate
    - Timestamps
    """
    rate = rate_service.get_rate(db, rate_id)
    
    if not rate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rate with ID {rate_id} not found"
        )
    
    response = RateResponse.model_validate(rate)
    response.worker_type_name = rate.worker_type.type if rate.worker_type else None
    response.is_current = rate.end_date is None
    
    return response


@router.get(
    "/worker-type/{worker_type_id}/current",
    response_model=RateResponse,
    summary="Get current rate for worker type",
    description="Get the current active rate for a worker type (end_date is NULL)"
)
async def get_current_rate(
    worker_type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current active rate for a worker type.
    
    Returns the rate with end_date = NULL.
    """
    rate = rate_service.get_current_rate(db, worker_type_id)
    
    if not rate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No current rate found for worker type {worker_type_id}"
        )
    
    response = RateResponse.model_validate(rate)
    response.worker_type_name = rate.worker_type.type if rate.worker_type else None
    response.is_current = True
    
    return response


@router.get(
    "/worker-type/{worker_type_id}/active",
    response_model=RateResponse,
    summary="Get active rate for worker type on a date",
    description="Get the active rate for a worker type on a specific date"
)
async def get_active_rate(
    worker_type_id: UUID,
    as_of_date: Optional[date] = Query(None, description="Date to check (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the active rate for a worker type on a given date.
    
    If no date is provided, returns the rate active today.
    """
    rate = rate_service.get_active_rate(db, worker_type_id, as_of_date)
    
    if not rate:
        check_date = as_of_date or date.today()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active rate found for worker type {worker_type_id} on {check_date}"
        )
    
    response = RateResponse.model_validate(rate)
    response.worker_type_name = rate.worker_type.type if rate.worker_type else None
    response.is_current = rate.end_date is None
    
    return response


@router.get(
    "/worker-type/{worker_type_id}/history",
    response_model=WorkerTypeRateHistory,
    summary="Get rate history for worker type",
    description="Get all historical rates for a worker type"
)
async def get_rate_history(
    worker_type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all historical rates for a worker type.
    
    Returns rates ordered by start_date descending (most recent first).
    """
    # Verify worker type exists
    worker_type = worker_type_service.get_worker_type(db, worker_type_id)
    if not worker_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Worker type with ID {worker_type_id} not found"
        )
    
    rates = rate_service.list_rates_by_worker_type(db, worker_type_id)
    
    # Get current rate
    current_rate = rate_service.get_current_rate(db, worker_type_id)
    
    # Convert to rate history items
    rate_history_items = []
    for rate in rates:
        rate_history_items.append(
            RateHistory(
                id=rate.id,
                rate_amount=rate.rate_amount,
                start_date=rate.start_date,
                end_date=rate.end_date,
                is_current=rate.end_date is None,
                created_at=rate.created_at.date() if rate.created_at else date.today()
            )
        )
    
    return WorkerTypeRateHistory(
        worker_type_id=worker_type.id,
        worker_type_name=worker_type.type,
        current_rate=current_rate.rate_amount if current_rate else None,
        rate_history=rate_history_items
    )


@router.get(
    "/worker-type/{worker_type_id}/date-range",
    response_model=List[RateResponse],
    summary="Get rates in date range",
    description="Get all rates that overlap with a date range"
)
async def get_rates_in_date_range(
    worker_type_id: UUID,
    start_date: date = Query(..., description="Range start date"),
    end_date: date = Query(..., description="Range end date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all rates that overlap with a date range.
    
    Returns rates where the rate period overlaps with the specified date range.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before or equal to end date"
        )
    
    rates = rate_service.get_rates_in_date_range(db, worker_type_id, start_date, end_date)
    
    # Convert to response models
    rate_responses = []
    for rate in rates:
        response = RateResponse.model_validate(rate)
        response.worker_type_name = rate.worker_type.type if rate.worker_type else None
        response.is_current = rate.end_date is None
        rate_responses.append(response)
    
    return rate_responses


@router.post(
    "/worker-type/{worker_type_id}/update",
    response_model=RateResponse,
    summary="Update rate for worker type",
    description="Update rate by closing the current rate and creating a new one"
)
async def update_rate(
    worker_type_id: UUID,
    new_rate_amount: Decimal = Query(..., gt=0, description="New rate amount"),
    effective_date: date = Query(..., description="Date when new rate becomes effective"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update rate by closing the current rate and creating a new one.
    
    This implements the requirement that rate updates should close the previous
    rate record and create a new one starting on the effective date.
    """
    try:
        rate = rate_service.update_rate(
            db=db,
            worker_type_id=worker_type_id,
            new_rate_amount=new_rate_amount,
            effective_date=effective_date
        )
        
        response = RateResponse.model_validate(rate)
        response.worker_type_name = rate.worker_type.type if rate.worker_type else None
        response.is_current = rate.end_date is None
        
        return response
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        current_rate = rate_service.get_current_rate(db, worker_type_id)
        if current_rate:
            current_state = RateResponse.model_validate(current_rate).model_dump()
            raise ConflictError("rate", str(current_rate.id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No current rate found for worker type {worker_type_id}"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update rate: {str(e)}"
        )


@router.post(
    "/worker-type/{worker_type_id}/close",
    response_model=RateResponse,
    summary="Close current rate",
    description="Close the current rate by setting its end_date"
)
async def close_rate(
    worker_type_id: UUID,
    end_date: date = Query(..., description="Date to close the rate"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Close the current rate by setting its end_date.
    """
    try:
        rate = rate_service.close_rate(db, worker_type_id, end_date)
        
        if not rate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No current rate found for worker type {worker_type_id}"
            )
        
        response = RateResponse.model_validate(rate)
        response.worker_type_name = rate.worker_type.type if rate.worker_type else None
        response.is_current = False
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close rate: {str(e)}"
        )


@router.post(
    "/check-effective",
    response_model=RateEffectiveDate,
    summary="Check effective rate on date",
    description="Check if a rate is effective for a worker type on a specific date"
)
async def check_effective_rate(
    worker_type_id: UUID = Query(..., description="Worker type ID"),
    check_date: date = Query(..., description="Date to check"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check if a rate is effective for a worker type on a specific date.
    
    Returns information about the effective rate on the specified date.
    """
    rate = rate_service.get_active_rate(db, worker_type_id, check_date)
    
    if rate:
        return RateEffectiveDate(
            worker_type_id=worker_type_id,
            check_date=check_date,
            effective_rate=rate.rate_amount,
            rate_id=rate.id,
            is_active=True
        )
    else:
        return RateEffectiveDate(
            worker_type_id=worker_type_id,
            check_date=check_date,
            effective_rate=None,
            rate_id=None,
            is_active=False
        )
