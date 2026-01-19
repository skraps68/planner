"""
ActualsService for managing actual work records with cost calculation.
"""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.actual import Actual
from app.repositories.actual import actual_repository
from app.repositories.resource import worker_repository
from app.repositories.rate import rate_repository
from app.repositories.resource_assignment import resource_assignment_repository
from app.repositories.project import project_repository
from app.services.allocation_validator import allocation_validator_service, AllocationConflict
from app.services.actuals_import import ActualsImportRecord


class ActualsServiceError(Exception):
    """Custom exception for actuals service errors."""
    pass


class ActualsService:
    """Service for managing actual work records with cost calculation."""
    
    def __init__(self):
        pass
    
    def create_actual(
        self,
        db: Session,
        project_id: UUID,
        external_worker_id: str,
        worker_name: str,
        actual_date: date,
        allocation_percentage: Decimal,
        validate_allocation: bool = True
    ) -> Actual:
        """
        Create a new actual record with automatic cost calculation.
        
        Args:
            db: Database session
            project_id: Project ID
            external_worker_id: Worker's external ID
            worker_name: Worker's name
            actual_date: Date of actual work
            allocation_percentage: Allocation percentage (0-100)
            validate_allocation: Whether to validate allocation limits
            
        Returns:
            Created Actual object
            
        Raises:
            ActualsServiceError: If validation fails or data is invalid
        """
        # Validate project exists
        project = project_repository.get(db, project_id)
        if not project:
            raise ActualsServiceError(f"Project with ID {project_id} does not exist")
        
        # Validate worker exists
        worker = worker_repository.get_by_external_id(db, external_worker_id)
        if not worker:
            raise ActualsServiceError(
                f"Worker with external_id '{external_worker_id}' does not exist"
            )
        
        # Validate worker name matches
        if worker.name != worker_name:
            raise ActualsServiceError(
                f"Worker name mismatch: expected '{worker.name}', got '{worker_name}'"
            )
        
        # Validate allocation limit
        if validate_allocation:
            is_valid = allocation_validator_service.validate_single_actual(
                db=db,
                external_worker_id=external_worker_id,
                actual_date=actual_date,
                new_allocation=allocation_percentage
            )
            if not is_valid:
                existing = allocation_validator_service.get_current_allocation(
                    db=db,
                    external_worker_id=external_worker_id,
                    actual_date=actual_date
                )
                raise ActualsServiceError(
                    f"Allocation limit exceeded: worker '{worker_name}' already has "
                    f"{existing}% allocated on {actual_date}, cannot add {allocation_percentage}%"
                )
        
        # Calculate cost
        cost_data = self._calculate_cost(
            db=db,
            worker=worker,
            project_id=project_id,
            actual_date=actual_date,
            allocation_percentage=allocation_percentage
        )
        
        # Create actual record
        actual_data = {
            "project_id": project_id,
            "resource_assignment_id": cost_data.get("resource_assignment_id"),
            "external_worker_id": external_worker_id,
            "worker_name": worker_name,
            "actual_date": actual_date,
            "allocation_percentage": allocation_percentage,
            "actual_cost": cost_data["actual_cost"],
            "capital_amount": cost_data["capital_amount"],
            "expense_amount": cost_data["expense_amount"]
        }
        
        return actual_repository.create(db, obj_in=actual_data)
    
    def _calculate_cost(
        self,
        db: Session,
        worker: Any,
        project_id: UUID,
        actual_date: date,
        allocation_percentage: Decimal
    ) -> Dict[str, Any]:
        """
        Calculate cost for an actual based on worker rate and assignment ratios.
        
        Args:
            db: Database session
            worker: Worker object
            project_id: Project ID
            actual_date: Date of actual work
            allocation_percentage: Allocation percentage
            
        Returns:
            Dictionary with cost breakdown
        """
        # Get worker's rate for the date
        rate = rate_repository.get_active_rate(
            db=db,
            worker_type_id=worker.worker_type_id,
            as_of_date=actual_date
        )
        
        if not rate:
            raise ActualsServiceError(
                f"No active rate found for worker type on {actual_date}"
            )
        
        # Calculate base cost (daily rate * allocation percentage)
        daily_rate = rate.rate_amount
        actual_cost = (daily_rate * allocation_percentage) / Decimal('100.00')
        
        # Try to find matching resource assignment for capital/expense split
        # Note: This is a simplified approach - in reality, we'd need to match
        # the worker to a resource and find the assignment
        capital_percentage = Decimal('50.00')  # Default 50/50 split
        expense_percentage = Decimal('50.00')
        resource_assignment_id = None
        
        # Try to find a resource assignment for this project and date
        # This is a simplified lookup - in production, you'd need more sophisticated matching
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        for assignment in assignments:
            if assignment.assignment_date == actual_date:
                # Found a matching assignment - use its ratios
                capital_percentage = assignment.capital_percentage
                expense_percentage = assignment.expense_percentage
                resource_assignment_id = assignment.id
                break
        
        # Calculate capital and expense amounts
        capital_amount = (actual_cost * capital_percentage) / Decimal('100.00')
        expense_amount = (actual_cost * expense_percentage) / Decimal('100.00')
        
        # Round to 2 decimal places
        actual_cost = actual_cost.quantize(Decimal('0.01'))
        capital_amount = capital_amount.quantize(Decimal('0.01'))
        expense_amount = expense_amount.quantize(Decimal('0.01'))
        
        # Ensure capital + expense = actual_cost (handle rounding)
        if capital_amount + expense_amount != actual_cost:
            # Adjust expense to match
            expense_amount = actual_cost - capital_amount
        
        return {
            "actual_cost": actual_cost,
            "capital_amount": capital_amount,
            "expense_amount": expense_amount,
            "resource_assignment_id": resource_assignment_id,
            "rate_used": daily_rate,
            "capital_percentage": capital_percentage,
            "expense_percentage": expense_percentage
        }
    
    def import_actuals_batch(
        self,
        db: Session,
        records: List[ActualsImportRecord],
        validate_allocation: bool = True
    ) -> Dict[str, Any]:
        """
        Import a batch of actuals from validated import records.
        
        Args:
            db: Database session
            records: List of validated ActualsImportRecord objects
            validate_allocation: Whether to validate allocation limits
            
        Returns:
            Dictionary with import results
            
        Raises:
            ActualsServiceError: If import fails
        """
        # Validate all records are valid
        invalid_records = [r for r in records if not r.is_valid()]
        if invalid_records:
            raise ActualsServiceError(
                f"Cannot import: {len(invalid_records)} records have validation errors"
            )
        
        # Check for allocation conflicts if validation is enabled
        if validate_allocation:
            actuals_data = [
                {
                    "external_worker_id": r.external_worker_id,
                    "worker_name": r.worker_name,
                    "actual_date": r.actual_date,
                    "allocation_percentage": r.percentage
                }
                for r in records
            ]
            
            conflicts = allocation_validator_service.validate_batch_actuals(
                db=db,
                actuals_data=actuals_data
            )
            
            if conflicts:
                conflict_details = [c.to_dict() for c in conflicts]
                raise ActualsServiceError(
                    f"Allocation conflicts detected: {len(conflicts)} worker-date "
                    f"combinations would exceed 100% allocation. Details: {conflict_details}"
                )
        
        # Import actuals in a transaction
        created_actuals = []
        errors = []
        
        try:
            for record in records:
                try:
                    actual = self.create_actual(
                        db=db,
                        project_id=record.project_id,
                        external_worker_id=record.external_worker_id,
                        worker_name=record.worker_name,
                        actual_date=record.actual_date,
                        allocation_percentage=record.percentage,
                        validate_allocation=False  # Already validated in batch
                    )
                    created_actuals.append(actual)
                except Exception as e:
                    errors.append({
                        "row": record.row_number,
                        "error": str(e)
                    })
            
            if errors:
                # Rollback transaction
                db.rollback()
                raise ActualsServiceError(
                    f"Import failed with {len(errors)} errors: {errors}"
                )
            
            # Commit transaction
            db.commit()
            
            return {
                "status": "success",
                "imported_count": len(created_actuals),
                "actuals": created_actuals
            }
            
        except Exception as e:
            db.rollback()
            raise ActualsServiceError(f"Import failed: {str(e)}")
    
    def get_actuals_by_project(
        self,
        db: Session,
        project_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Actual]:
        """Get actuals for a project, optionally filtered by date range."""
        if start_date or end_date:
            return actual_repository.get_by_date_range(
                db=db,
                project_id=project_id,
                start_date=start_date,
                end_date=end_date
            )
        return actual_repository.get_by_project(db, project_id)
    
    def get_actuals_by_worker(
        self,
        db: Session,
        external_worker_id: str
    ) -> List[Actual]:
        """Get all actuals for a worker."""
        return actual_repository.get_by_worker(db, external_worker_id)
    
    def get_project_total_cost(
        self,
        db: Session,
        project_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Decimal:
        """Get total actual cost for a project."""
        return actual_repository.get_project_total_cost(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
    
    def update_actual(
        self,
        db: Session,
        actual_id: UUID,
        allocation_percentage: Optional[Decimal] = None,
        validate_allocation: bool = True
    ) -> Actual:
        """
        Update an actual record.
        
        Args:
            db: Database session
            actual_id: Actual ID to update
            allocation_percentage: New allocation percentage
            validate_allocation: Whether to validate allocation limits
            
        Returns:
            Updated Actual object
        """
        actual = actual_repository.get(db, actual_id)
        if not actual:
            raise ActualsServiceError(f"Actual with ID {actual_id} does not exist")
        
        if allocation_percentage is not None:
            # Validate allocation limit (excluding current actual)
            if validate_allocation:
                is_valid = allocation_validator_service.validate_single_actual(
                    db=db,
                    external_worker_id=actual.external_worker_id,
                    actual_date=actual.actual_date,
                    new_allocation=allocation_percentage,
                    exclude_actual_id=actual_id
                )
                if not is_valid:
                    raise ActualsServiceError(
                        f"Allocation limit exceeded for worker on {actual.actual_date}"
                    )
            
            # Recalculate cost
            worker = worker_repository.get_by_external_id(db, actual.external_worker_id)
            if not worker:
                raise ActualsServiceError(
                    f"Worker with external_id '{actual.external_worker_id}' not found"
                )
            
            cost_data = self._calculate_cost(
                db=db,
                worker=worker,
                project_id=actual.project_id,
                actual_date=actual.actual_date,
                allocation_percentage=allocation_percentage
            )
            
            actual.allocation_percentage = allocation_percentage
            actual.actual_cost = cost_data["actual_cost"]
            actual.capital_amount = cost_data["capital_amount"]
            actual.expense_amount = cost_data["expense_amount"]
        
        update_data = {
            "allocation_percentage": actual.allocation_percentage,
            "actual_cost": actual.actual_cost,
            "capital_amount": actual.capital_amount,
            "expense_amount": actual.expense_amount
        }
        
        return actual_repository.update(db, db_obj=actual, obj_in=update_data)
    
    def delete_actual(self, db: Session, actual_id: UUID) -> bool:
        """Delete an actual record."""
        return actual_repository.delete(db, actual_id)


# Create service instance
actuals_service = ActualsService()
