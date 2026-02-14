"""
Portfolio API endpoints.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.api.deps import (
    get_db,
    get_current_user,
    check_permission,
    get_accessible_portfolios
)
from app.models.user import User
from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioUpdate,
    PortfolioResponse,
    PortfolioListResponse,
    PortfolioSummary
)
from app.schemas.program import ProgramSummary
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.portfolio import portfolio_service
from app.services.authorization import Permission, authorization_service
from app.core.exceptions import AuthorizationError, ScopeAccessDeniedError, ConflictError

router = APIRouter()


@router.post(
    "/",
    response_model=PortfolioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new portfolio",
    description="Create a new portfolio with required attributes"
)
async def create_portfolio(
    portfolio_in: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.CREATE_PORTFOLIO))
):
    """
    Create a new portfolio.
    
    Required fields:
    - name: Portfolio name
    - description: Portfolio description
    - owner: Portfolio owner
    - reporting_start_date: Reporting period start date
    - reporting_end_date: Reporting period end date (must be after start_date)
    
    Requires: CREATE_PORTFOLIO permission
    """
    try:
        portfolio = portfolio_service.create_portfolio(
            db=db,
            name=portfolio_in.name,
            description=portfolio_in.description,
            owner=portfolio_in.owner,
            reporting_start_date=portfolio_in.reporting_start_date,
            reporting_end_date=portfolio_in.reporting_end_date,
            user_id=current_user.id  # Add user_id for audit logging
        )
        
        # Convert to response model
        response = PortfolioResponse.model_validate(portfolio)
        response.program_count = len(portfolio.programs) if portfolio.programs else 0
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create portfolio: {str(e)}"
        )


@router.get(
    "/",
    response_model=PortfolioListResponse,
    summary="List portfolios",
    description="Get a paginated list of portfolios with optional filtering"
)
async def list_portfolios(
    pagination: PaginationParams = Depends(),
    active_only: bool = Query(False, description="Filter for active portfolios only"),
    as_of_date: Optional[date] = Query(None, description="Date to check for active portfolios"),
    search: Optional[str] = Query(None, description="Search term for portfolio name"),
    owner: Optional[str] = Query(None, description="Filter by portfolio owner"),
    start_date: Optional[date] = Query(None, description="Filter by start date range"),
    end_date: Optional[date] = Query(None, description="Filter by end date range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.READ_PORTFOLIO))
):
    """
    List portfolios with pagination and filtering.
    
    Supports filtering by:
    - Active status (portfolios active on a specific date)
    - Search term (portfolio name)
    - Portfolio owner
    - Date range
    
    Requires: READ_PORTFOLIO permission
    Scope: Only returns portfolios within user's scope
    """
    try:
        # Apply filters
        if search:
            portfolios = portfolio_service.search_portfolios(db, search)
        elif owner:
            portfolios = portfolio_service.get_portfolios_by_owner(db, owner)
        elif start_date or end_date:
            portfolios = portfolio_service.get_portfolios_by_date_range(db, start_date, end_date)
        else:
            skip = (pagination.page - 1) * pagination.size
            portfolios = portfolio_service.list_portfolios(
                db=db,
                skip=skip,
                limit=pagination.size,
                active_only=active_only,
                as_of_date=as_of_date,
                user_id=current_user.id  # Apply scope filtering
            )
        
        # Apply scope filtering to search/filter results
        if search or owner or start_date or end_date:
            accessible_portfolio_ids = authorization_service.get_accessible_portfolios_with_permission(
                db, current_user.id, Permission.READ_PORTFOLIO
            )
            portfolios = [p for p in portfolios if p.id in accessible_portfolio_ids]
        
        # Calculate pagination
        total = len(portfolios)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Apply pagination to filtered results
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_portfolios = portfolios[start_idx:end_idx]
        
        # Convert to response models
        portfolio_responses = []
        for portfolio in paginated_portfolios:
            response = PortfolioResponse.model_validate(portfolio)
            response.program_count = len(portfolio.programs) if portfolio.programs else 0
            portfolio_responses.append(response)
        
        return PortfolioListResponse(
            items=portfolio_responses,
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
            detail=f"Failed to list portfolios: {str(e)}"
        )


@router.get(
    "/{portfolio_id}",
    response_model=PortfolioResponse,
    summary="Get portfolio by ID",
    description="Retrieve a specific portfolio by its ID"
)
async def get_portfolio(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.READ_PORTFOLIO))
):
    """
    Get a specific portfolio by ID.
    
    Returns portfolio details including:
    - All portfolio attributes
    - Program count
    - Timestamps
    
    Requires: READ_PORTFOLIO permission
    Scope: User must have access to the portfolio
    """
    # First check if portfolio exists
    portfolio = portfolio_service.get_portfolio(db, portfolio_id)
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with ID {portfolio_id} not found"
        )
    
    # Then check scope access
    is_authorized, error_msg = authorization_service.validate_portfolio_access(
        db, current_user.id, portfolio_id, Permission.READ_PORTFOLIO
    )
    if not is_authorized:
        raise ScopeAccessDeniedError("Portfolio", portfolio_id)
    
    response = PortfolioResponse.model_validate(portfolio)
    response.program_count = len(portfolio.programs) if portfolio.programs else 0
    
    return response


@router.get(
    "/name/{portfolio_name}",
    response_model=PortfolioResponse,
    summary="Get portfolio by name",
    description="Retrieve a specific portfolio by its name"
)
async def get_portfolio_by_name(
    portfolio_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific portfolio by name.
    """
    portfolio = portfolio_service.get_portfolio_by_name(db, portfolio_name)
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with name '{portfolio_name}' not found"
        )
    
    response = PortfolioResponse.model_validate(portfolio)
    response.program_count = len(portfolio.programs) if portfolio.programs else 0
    
    return response


@router.put(
    "/{portfolio_id}",
    response_model=PortfolioResponse,
    summary="Update portfolio",
    description="Update an existing portfolio's attributes"
)
async def update_portfolio(
    portfolio_id: UUID,
    portfolio_in: PortfolioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.UPDATE_PORTFOLIO))
):
    """
    Update an existing portfolio.
    
    All fields are optional. Only provided fields will be updated.
    Date validation is applied if dates are updated.
    
    Requires: UPDATE_PORTFOLIO permission
    Scope: User must have access to the portfolio
    """
    # Check scope access
    is_authorized, error_msg = authorization_service.validate_portfolio_access(
        db, current_user.id, portfolio_id, Permission.UPDATE_PORTFOLIO
    )
    if not is_authorized:
        raise ScopeAccessDeniedError("Portfolio", portfolio_id)
    
    try:
        portfolio = portfolio_service.update_portfolio(
            db=db,
            portfolio_id=portfolio_id,
            name=portfolio_in.name,
            description=portfolio_in.description,
            owner=portfolio_in.owner,
            reporting_start_date=portfolio_in.reporting_start_date,
            reporting_end_date=portfolio_in.reporting_end_date,
            user_id=current_user.id  # Add user_id for audit logging
        )
        
        response = PortfolioResponse.model_validate(portfolio)
        response.program_count = len(portfolio.programs) if portfolio.programs else 0
        
        return response
    
    except StaleDataError:
        # Version conflict detected - fetch current state and raise ConflictError
        current_portfolio = portfolio_service.get_portfolio(db, portfolio_id)
        if current_portfolio:
            current_state = PortfolioResponse.model_validate(current_portfolio).model_dump()
            raise ConflictError("portfolio", str(portfolio_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio with ID {portfolio_id} not found"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update portfolio: {str(e)}"
        )


@router.delete(
    "/{portfolio_id}",
    response_model=SuccessResponse,
    summary="Delete portfolio",
    description="Delete a portfolio (only if it has no associated programs)"
)
async def delete_portfolio(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.DELETE_PORTFOLIO))
):
    """
    Delete a portfolio.
    
    A portfolio can only be deleted if it has no associated programs.
    Returns 409 Conflict if portfolio has programs.
    
    Requires: DELETE_PORTFOLIO permission
    Scope: User must have access to the portfolio
    """
    # First check if portfolio exists
    portfolio = portfolio_service.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with ID {portfolio_id} not found"
        )
    
    # Then check scope access
    is_authorized, error_msg = authorization_service.validate_portfolio_access(
        db, current_user.id, portfolio_id, Permission.DELETE_PORTFOLIO
    )
    if not is_authorized:
        raise ScopeAccessDeniedError("Portfolio", portfolio_id)
    
    try:
        portfolio_service.delete_portfolio(
            db,
            portfolio_id,
            user_id=current_user.id  # Add user_id for audit logging
        )
        
        return SuccessResponse(
            success=True,
            message=f"Portfolio {portfolio_id} deleted successfully"
        )
        
    except ValueError as e:
        # Check if error is about associated programs
        if "associated program" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete portfolio: {str(e)}"
        )


@router.get(
    "/{portfolio_id}/programs",
    response_model=List[ProgramSummary],
    summary="Get portfolio programs",
    description="Get all programs associated with a portfolio"
)
async def get_portfolio_programs(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.READ_PORTFOLIO))
):
    """
    Get all programs associated with a portfolio.
    
    Returns a list of program summaries.
    
    Requires: READ_PORTFOLIO permission
    Scope: User must have access to the portfolio
    """
    # First check if portfolio exists
    portfolio = portfolio_service.get_portfolio(db, portfolio_id)
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with ID {portfolio_id} not found"
        )
    
    # Then check scope access
    is_authorized, error_msg = authorization_service.validate_portfolio_access(
        db, current_user.id, portfolio_id, Permission.READ_PORTFOLIO
    )
    if not is_authorized:
        raise ScopeAccessDeniedError("Portfolio", portfolio_id)
    
    # Return program summaries
    programs = []
    for program in portfolio.programs:
        programs.append(ProgramSummary(
            id=program.id,
            name=program.name,
            business_sponsor=program.business_sponsor,
            start_date=program.start_date,
            end_date=program.end_date,
            project_count=len(program.projects) if program.projects else 0
        ))
    
    return programs


@router.get(
    "/{portfolio_id}/summary",
    response_model=PortfolioSummary,
    summary="Get portfolio summary",
    description="Get a brief summary of a portfolio"
)
async def get_portfolio_summary(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a brief summary of a portfolio.
    
    Returns essential portfolio information without full details.
    """
    portfolio = portfolio_service.get_portfolio(db, portfolio_id)
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with ID {portfolio_id} not found"
        )
    
    return PortfolioSummary(
        id=portfolio.id,
        name=portfolio.name,
        owner=portfolio.owner,
        reporting_start_date=portfolio.reporting_start_date,
        reporting_end_date=portfolio.reporting_end_date,
        program_count=len(portfolio.programs) if portfolio.programs else 0
    )
