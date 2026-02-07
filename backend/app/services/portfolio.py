"""
Portfolio service for business logic operations.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.repositories.portfolio import portfolio_repository
from app.services.audit import audit_service


class PortfolioService:
    """Service for portfolio business logic."""
    
    def __init__(self):
        self.repository = portfolio_repository
        self.audit_service = audit_service
    
    def create_portfolio(
        self,
        db: Session,
        name: str,
        description: str,
        owner: str,
        reporting_start_date: date,
        reporting_end_date: date,
        user_id: Optional[UUID] = None
    ) -> Portfolio:
        """
        Create a new portfolio with validation and audit logging.
        
        Args:
            db: Database session
            name: Portfolio name
            description: Portfolio description
            owner: Portfolio owner
            reporting_start_date: Reporting period start date
            reporting_end_date: Reporting period end date
            user_id: Optional user ID for audit logging
            
        Returns:
            Created portfolio
            
        Raises:
            ValueError: If validation fails
        """
        # Validate date constraints
        if not self.repository.validate_date_constraints(reporting_start_date, reporting_end_date):
            raise ValueError("Reporting start date must be before reporting end date")
        
        # Check for duplicate name
        existing = self.repository.get_by_name(db, name)
        if existing:
            raise ValueError(f"Portfolio with name '{name}' already exists")
        
        # Create portfolio
        portfolio_data = {
            "name": name,
            "description": description,
            "owner": owner,
            "reporting_start_date": reporting_start_date,
            "reporting_end_date": reporting_end_date
        }
        
        portfolio = self.repository.create(db, obj_in=portfolio_data)
        
        # Log creation
        if user_id:
            self.audit_service.log_create(db, user_id, portfolio)
        
        return portfolio
    
    def get_portfolio(self, db: Session, portfolio_id: UUID) -> Optional[Portfolio]:
        """Get portfolio by ID."""
        return self.repository.get(db, portfolio_id)
    
    def get_portfolio_by_name(self, db: Session, name: str) -> Optional[Portfolio]:
        """Get portfolio by name."""
        return self.repository.get_by_name(db, name)
    
    def list_portfolios(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False,
        as_of_date: Optional[date] = None,
        user_id: Optional[UUID] = None
    ) -> List[Portfolio]:
        """
        List portfolios with optional filtering and scope-based access control.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            active_only: If True, only return active portfolios
            as_of_date: Date to check for active portfolios (default: today)
            user_id: Optional user ID for scope filtering
            
        Returns:
            List of portfolios
        """
        if active_only:
            portfolios = self.repository.get_active_portfolios(db, as_of_date)
        else:
            portfolios = self.repository.get_multi(db, skip=skip, limit=limit)
        
        # Apply scope filtering if user_id is provided
        if user_id:
            from app.services.scope_validator import scope_validator_service
            accessible_portfolio_ids = scope_validator_service.get_user_accessible_portfolios(db, user_id)
            portfolios = [p for p in portfolios if p.id in accessible_portfolio_ids]
        
        return portfolios
    
    def update_portfolio(
        self,
        db: Session,
        portfolio_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        owner: Optional[str] = None,
        reporting_start_date: Optional[date] = None,
        reporting_end_date: Optional[date] = None,
        user_id: Optional[UUID] = None
    ) -> Portfolio:
        """
        Update portfolio with validation and audit logging.
        
        Args:
            db: Database session
            portfolio_id: Portfolio ID to update
            name: Optional new name
            description: Optional new description
            owner: Optional new owner
            reporting_start_date: Optional new reporting start date
            reporting_end_date: Optional new reporting end date
            user_id: Optional user ID for audit logging
            
        Returns:
            Updated portfolio
            
        Raises:
            ValueError: If validation fails or portfolio not found
        """
        # Get existing portfolio
        portfolio = self.repository.get(db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio with ID {portfolio_id} not found")
        
        # Capture before state for audit
        before_values = None
        if user_id:
            before_values = self.audit_service.capture_before_update(portfolio)
        
        # Build update data
        update_data = {}
        
        if name is not None:
            # Check for duplicate name (excluding current portfolio)
            existing = self.repository.get_by_name(db, name)
            if existing and existing.id != portfolio_id:
                raise ValueError(f"Portfolio with name '{name}' already exists")
            update_data["name"] = name
        
        if description is not None:
            update_data["description"] = description
        
        if owner is not None:
            update_data["owner"] = owner
        
        # Handle date updates with validation
        new_start = reporting_start_date if reporting_start_date is not None else portfolio.reporting_start_date
        new_end = reporting_end_date if reporting_end_date is not None else portfolio.reporting_end_date
        
        if reporting_start_date is not None or reporting_end_date is not None:
            if not self.repository.validate_date_constraints(new_start, new_end):
                raise ValueError("Reporting start date must be before reporting end date")
            
            if reporting_start_date is not None:
                update_data["reporting_start_date"] = reporting_start_date
            if reporting_end_date is not None:
                update_data["reporting_end_date"] = reporting_end_date
        
        updated_portfolio = self.repository.update(db, db_obj=portfolio, obj_in=update_data)
        
        # Log update
        if user_id and before_values:
            self.audit_service.log_update(db, user_id, updated_portfolio, before_values)
        
        return updated_portfolio
    
    def delete_portfolio(
        self,
        db: Session,
        portfolio_id: UUID,
        user_id: Optional[UUID] = None
    ) -> bool:
        """
        Delete a portfolio with audit logging.
        
        Args:
            db: Database session
            portfolio_id: Portfolio ID to delete
            user_id: Optional user ID for audit logging
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If portfolio not found or has associated programs
        """
        portfolio = self.repository.get(db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio with ID {portfolio_id} not found")
        
        # Check if portfolio has associated programs
        if portfolio.programs:
            raise ValueError(
                f"Cannot delete portfolio '{portfolio.name}' because it has {len(portfolio.programs)} associated program(s)"
            )
        
        # Log deletion before removing
        if user_id:
            self.audit_service.log_delete(db, user_id, portfolio)
        
        self.repository.remove(db, id=portfolio_id)
        return True
    
    def search_portfolios(self, db: Session, search_term: str) -> List[Portfolio]:
        """Search portfolios by name."""
        return self.repository.search_by_name(db, search_term)
    
    def get_portfolios_by_owner(self, db: Session, owner: str) -> List[Portfolio]:
        """Get portfolios by owner."""
        return self.repository.get_by_owner(db, owner)
    
    def get_portfolios_by_date_range(
        self,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Portfolio]:
        """Get portfolios that overlap with a date range."""
        return self.repository.get_by_date_range(db, start_date, end_date)


# Create service instance
portfolio_service = PortfolioService()
