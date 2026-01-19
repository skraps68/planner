"""
AllocationValidatorService for validating worker allocation limits.
"""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.actual import actual_repository


class AllocationConflict:
    """Represents an allocation conflict for a worker on a specific date."""
    
    def __init__(
        self,
        external_worker_id: str,
        worker_name: str,
        actual_date: date,
        existing_allocation: Decimal,
        new_allocation: Decimal,
        total_allocation: Decimal
    ):
        self.external_worker_id = external_worker_id
        self.worker_name = worker_name
        self.actual_date = actual_date
        self.existing_allocation = existing_allocation
        self.new_allocation = new_allocation
        self.total_allocation = total_allocation
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert conflict to dictionary for reporting."""
        return {
            "external_worker_id": self.external_worker_id,
            "worker_name": self.worker_name,
            "date": self.actual_date.isoformat(),
            "existing_allocation": float(self.existing_allocation),
            "new_allocation": float(self.new_allocation),
            "total_allocation": float(self.total_allocation),
            "excess": float(self.total_allocation - Decimal('100.00'))
        }


class AllocationValidatorService:
    """Service for validating worker allocation limits."""
    
    MAX_ALLOCATION = Decimal('100.00')
    
    def __init__(self):
        pass
    
    def validate_single_actual(
        self,
        db: Session,
        external_worker_id: str,
        actual_date: date,
        new_allocation: Decimal,
        exclude_actual_id: Optional[UUID] = None
    ) -> bool:
        """
        Validate that adding a new actual doesn't exceed 100% allocation for the day.
        
        Args:
            db: Database session
            external_worker_id: Worker's external ID
            actual_date: Date of the actual
            new_allocation: Allocation percentage to add
            exclude_actual_id: Optional actual ID to exclude from calculation (for updates)
            
        Returns:
            True if allocation is valid (total <= 100%), False otherwise
        """
        return actual_repository.validate_allocation_limit(
            db=db,
            external_worker_id=external_worker_id,
            actual_date=actual_date,
            new_allocation=new_allocation,
            exclude_id=exclude_actual_id
        )
    
    def get_current_allocation(
        self,
        db: Session,
        external_worker_id: str,
        actual_date: date
    ) -> Decimal:
        """
        Get the current total allocation for a worker on a specific date.
        
        Args:
            db: Database session
            external_worker_id: Worker's external ID
            actual_date: Date to check
            
        Returns:
            Total allocation percentage
        """
        return actual_repository.get_total_allocation_for_date(
            db=db,
            external_worker_id=external_worker_id,
            actual_date=actual_date
        )
    
    def validate_batch_actuals(
        self,
        db: Session,
        actuals_data: List[Dict[str, Any]]
    ) -> List[AllocationConflict]:
        """
        Validate a batch of actuals for allocation conflicts.
        
        This method checks both:
        1. Conflicts with existing actuals in the database
        2. Conflicts within the batch itself
        
        Args:
            db: Database session
            actuals_data: List of dictionaries with keys:
                - external_worker_id: str
                - worker_name: str
                - actual_date: date
                - allocation_percentage: Decimal
                
        Returns:
            List of AllocationConflict objects (empty if no conflicts)
        """
        conflicts = []
        
        # Group actuals by worker and date
        worker_date_allocations: Dict[tuple, List[Dict[str, Any]]] = {}
        for actual in actuals_data:
            key = (actual["external_worker_id"], actual["actual_date"])
            if key not in worker_date_allocations:
                worker_date_allocations[key] = []
            worker_date_allocations[key].append(actual)
        
        # Check each worker-date combination
        for (external_worker_id, actual_date), batch_actuals in worker_date_allocations.items():
            # Get existing allocation from database
            existing_allocation = self.get_current_allocation(
                db=db,
                external_worker_id=external_worker_id,
                actual_date=actual_date
            )
            
            # Calculate new allocation from batch
            new_allocation = sum(
                actual["allocation_percentage"] for actual in batch_actuals
            )
            
            # Calculate total
            total_allocation = existing_allocation + new_allocation
            
            # Check if exceeds limit
            if total_allocation > self.MAX_ALLOCATION:
                conflicts.append(AllocationConflict(
                    external_worker_id=external_worker_id,
                    worker_name=batch_actuals[0]["worker_name"],
                    actual_date=actual_date,
                    existing_allocation=existing_allocation,
                    new_allocation=new_allocation,
                    total_allocation=total_allocation
                ))
        
        return conflicts
    
    def check_cross_project_allocation(
        self,
        db: Session,
        external_worker_id: str,
        start_date: date,
        end_date: date
    ) -> Dict[date, Decimal]:
        """
        Check allocation across all projects for a worker within a date range.
        
        Args:
            db: Database session
            external_worker_id: Worker's external ID
            start_date: Start of date range
            end_date: End of date range
            
        Returns:
            Dictionary mapping dates to total allocation percentages
        """
        actuals = actual_repository.get_by_date_range(
            db=db,
            start_date=start_date,
            end_date=end_date
        )
        
        # Filter by worker and group by date
        worker_actuals = [
            a for a in actuals if a.external_worker_id == external_worker_id
        ]
        
        date_allocations: Dict[date, Decimal] = {}
        for actual in worker_actuals:
            if actual.actual_date not in date_allocations:
                date_allocations[actual.actual_date] = Decimal('0.00')
            date_allocations[actual.actual_date] += actual.allocation_percentage
        
        return date_allocations
    
    def find_over_allocated_dates(
        self,
        db: Session,
        external_worker_id: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Find all dates where a worker is over-allocated (>100%).
        
        Args:
            db: Database session
            external_worker_id: Worker's external ID
            start_date: Start of date range
            end_date: End of date range
            
        Returns:
            List of dictionaries with over-allocated dates and amounts
        """
        date_allocations = self.check_cross_project_allocation(
            db=db,
            external_worker_id=external_worker_id,
            start_date=start_date,
            end_date=end_date
        )
        
        over_allocated = []
        for actual_date, total_allocation in date_allocations.items():
            if total_allocation > self.MAX_ALLOCATION:
                over_allocated.append({
                    "date": actual_date.isoformat(),
                    "total_allocation": float(total_allocation),
                    "excess": float(total_allocation - self.MAX_ALLOCATION)
                })
        
        return over_allocated
    
    def detect_conflicts_with_existing(
        self,
        db: Session,
        external_worker_id: str,
        actual_date: date,
        new_allocation: Decimal
    ) -> Optional[AllocationConflict]:
        """
        Detect if a new actual would conflict with existing actuals.
        
        Args:
            db: Database session
            external_worker_id: Worker's external ID
            actual_date: Date of the new actual
            new_allocation: Allocation percentage of the new actual
            
        Returns:
            AllocationConflict if conflict exists, None otherwise
        """
        existing_allocation = self.get_current_allocation(
            db=db,
            external_worker_id=external_worker_id,
            actual_date=actual_date
        )
        
        total_allocation = existing_allocation + new_allocation
        
        if total_allocation > self.MAX_ALLOCATION:
            # Get worker name from existing actuals
            existing_actuals = actual_repository.get_by_date(
                db=db,
                external_worker_id=external_worker_id,
                actual_date=actual_date
            )
            worker_name = existing_actuals[0].worker_name if existing_actuals else "Unknown"
            
            return AllocationConflict(
                external_worker_id=external_worker_id,
                worker_name=worker_name,
                actual_date=actual_date,
                existing_allocation=existing_allocation,
                new_allocation=new_allocation,
                total_allocation=total_allocation
            )
        
        return None


# Create service instance
allocation_validator_service = AllocationValidatorService()
