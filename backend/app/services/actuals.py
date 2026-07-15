"""
ActualsService for managing actual work records with cost calculation.
"""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.actual import Actual
from app.models.resource import ResourceType
from app.repositories.actual import actual_repository
from app.repositories.resource import worker_repository, resource_repository
from app.repositories.rate import rate_repository
from app.repositories.resource_assignment import resource_assignment_repository
from app.repositories.project import project_repository
from app.services.allocation_validator import allocation_validator_service, AllocationConflict
from app.services.actuals_import import ActualsImportRecord, LaborImportRecord, NonLaborImportRecord
from app.core.exceptions import (
    ProjectNotFoundError,
    WorkerNotFoundError,
    RateNotFoundError,
    AllocationConflictError,
    BusinessRuleViolationError,
    ResourceNotFoundError,
    ImportError as ImportException
)


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
            raise ProjectNotFoundError(project_id)
        
        # Validate worker exists
        worker = worker_repository.get_by_external_id(db, external_worker_id)
        if not worker:
            raise WorkerNotFoundError(external_id=external_worker_id)
        
        # Validate worker name matches
        if worker.name != worker_name:
            raise BusinessRuleViolationError(
                f"Worker name mismatch: expected '{worker.name}', got '{worker_name}'",
                rule_code="WORKER_NAME_MISMATCH",
                details={
                    "external_worker_id": external_worker_id,
                    "expected_name": worker.name,
                    "provided_name": worker_name
                }
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
                raise AllocationConflictError(
                    resource_id=worker.id,
                    date=str(actual_date),
                    total_allocation=float(existing + allocation_percentage),
                    message=f"Worker '{worker_name}' already has {existing}% allocated on {actual_date}, cannot add {allocation_percentage}%"
                )
        
        # Calculate cost (resolves the worker's resource + planned assignment split)
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
            "resource_id": cost_data["resource_id"],
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
        Calculate cost for an actual based on worker rate and the worker's
        resource's planned assignment for the date.

        The worker must be linked to a (LABOR) resource, and that resource
        must have a planned ResourceAssignment on `actual_date` to supply the
        capital/expense split -- there is no 50/50 fallback. If either is
        missing, a BusinessRuleViolationError is raised.

        Args:
            db: Database session
            worker: Worker object
            project_id: Project ID
            actual_date: Date of actual work
            allocation_percentage: Allocation percentage

        Returns:
            Dictionary with cost breakdown and the resolved resource_id
        """
        # Get worker's rate for the date
        rate = rate_repository.get_active_rate(
            db=db,
            worker_type_id=worker.worker_type_id,
            as_of_date=actual_date
        )

        if not rate:
            raise RateNotFoundError(worker.worker_type_id, str(actual_date))

        # Resolve the resource linked to this worker
        resource = resource_repository.get_by_worker_id(db, worker.id)
        if not resource:
            raise BusinessRuleViolationError(
                f"No resource linked to worker '{worker.external_id}'",
                rule_code="NO_RESOURCE_FOR_WORKER",
                details={"worker_id": str(worker.id)}
            )

        # Planned assignment for this resource on this date supplies the cap/exp split
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        planned = next(
            (a for a in assignments
             if a.resource_id == resource.id and a.assignment_date == actual_date),
            None
        )
        if planned is None:
            raise BusinessRuleViolationError(
                f"No planned assignment for worker '{worker.external_id}' on {actual_date}; cannot split cost",
                rule_code="NO_PLANNED_ASSIGNMENT",
                details={"resource_id": str(resource.id), "date": str(actual_date)}
            )

        # Calculate base cost (daily rate * allocation percentage)
        daily_rate = rate.rate_amount
        actual_cost = ((daily_rate * allocation_percentage) / Decimal('100.00')).quantize(Decimal('0.01'))

        total_pct = planned.capital_percentage + planned.expense_percentage
        if total_pct == 0:
            cap_ratio = Decimal('0')
        else:
            cap_ratio = planned.capital_percentage / total_pct

        capital_amount = (actual_cost * cap_ratio).quantize(Decimal('0.01'))
        # Ensure capital + expense = actual_cost (handle rounding)
        expense_amount = actual_cost - capital_amount

        return {
            "actual_cost": actual_cost,
            "capital_amount": capital_amount,
            "expense_amount": expense_amount,
            "rate_used": daily_rate,
            "resource_id": resource.id
        }

    def create_nonlabor_actual(
        self,
        db: Session,
        project_id: UUID,
        resource_id: UUID,
        actual_date: date,
        capital_amount: Decimal,
        expense_amount: Decimal
    ) -> Actual:
        """
        Create a non-labor actual directly from dollar amounts.

        Non-labor actuals have no worker, allocation percentage, or rate --
        they record capital/expense dollars against a NON_LABOR resource.

        Args:
            db: Database session
            project_id: Project ID
            resource_id: NON_LABOR Resource ID
            actual_date: Date of the actual
            capital_amount: Capital dollars
            expense_amount: Expense dollars

        Returns:
            Created Actual object
        """
        project = project_repository.get(db, project_id)
        if not project:
            raise ProjectNotFoundError(project_id)

        resource = resource_repository.get(db, resource_id)
        if not resource:
            raise ResourceNotFoundError("Resource", resource_id=resource_id)

        if resource.resource_type != ResourceType.NON_LABOR:
            raise BusinessRuleViolationError(
                f"Resource '{resource_id}' is not a non-labor resource",
                rule_code="RESOURCE_NOT_NON_LABOR",
                details={"resource_id": str(resource_id), "resource_type": str(resource.resource_type)},
            )

        actual_data = {
            "project_id": project_id,
            "resource_id": resource_id,
            "external_worker_id": None,
            "worker_name": None,
            "actual_date": actual_date,
            "allocation_percentage": None,
            "actual_cost": capital_amount + expense_amount,
            "capital_amount": capital_amount,
            "expense_amount": expense_amount,
        }

        return actual_repository.create(db, obj_in=actual_data)

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
            raise ImportException(
                f"Cannot import: {len(invalid_records)} records have validation errors",
                row_errors=[{
                    "row": r.row_number,
                    "errors": r.errors
                } for r in invalid_records]
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
                raise ImportException(
                    f"Allocation conflicts detected: {len(conflicts)} worker-date combinations would exceed 100% allocation",
                    details={"conflicts": conflict_details}
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
                raise ImportException(
                    f"Import failed with {len(errors)} errors",
                    row_errors=errors
                )
            
            # Commit transaction
            db.commit()
            
            return {
                "status": "success",
                "imported_count": len(created_actuals),
                "actuals": created_actuals
            }
            
        except ImportException:
            # Re-raise import exceptions
            raise
        except Exception as e:
            db.rollback()
            raise ImportException(f"Import failed: {str(e)}")

    def _create_labor_split_actual(
        self,
        db: Session,
        project_id: UUID,
        external_worker_id: str,
        worker_name: str,
        actual_date: date,
        capital_percentage: Decimal,
        expense_percentage: Decimal
    ) -> Actual:
        """
        Create a labor actual whose capital/expense split is given explicitly
        (via capital_percentage/expense_percentage import columns), rather
        than derived from the worker's planned ResourceAssignment.

        Unlike create_actual's single-percentage path, this does NOT require
        a planned assignment on actual_date -- the split is already known.

        Args:
            db: Database session
            project_id: Project ID
            external_worker_id: Worker's external ID
            worker_name: Worker's name
            actual_date: Date of actual work
            capital_percentage: Capital allocation percentage (0-100)
            expense_percentage: Expense allocation percentage (0-100)

        Returns:
            Created Actual object
        """
        project = project_repository.get(db, project_id)
        if not project:
            raise ProjectNotFoundError(project_id)

        worker = worker_repository.get_by_external_id(db, external_worker_id)
        if not worker:
            raise WorkerNotFoundError(external_id=external_worker_id)

        if worker.name != worker_name:
            raise BusinessRuleViolationError(
                f"Worker name mismatch: expected '{worker.name}', got '{worker_name}'",
                rule_code="WORKER_NAME_MISMATCH",
                details={
                    "external_worker_id": external_worker_id,
                    "expected_name": worker.name,
                    "provided_name": worker_name
                }
            )

        rate = rate_repository.get_active_rate(
            db=db,
            worker_type_id=worker.worker_type_id,
            as_of_date=actual_date
        )
        if not rate:
            raise RateNotFoundError(worker.worker_type_id, str(actual_date))

        resource = resource_repository.get_by_worker_id(db, worker.id)
        if not resource:
            raise BusinessRuleViolationError(
                f"No resource linked to worker '{worker.external_id}'",
                rule_code="NO_RESOURCE_FOR_WORKER",
                details={"worker_id": str(worker.id)}
            )

        allocation_percentage = capital_percentage + expense_percentage
        daily_rate = rate.rate_amount
        actual_cost = ((daily_rate * allocation_percentage) / Decimal('100.00')).quantize(Decimal('0.01'))
        capital_amount = ((daily_rate * capital_percentage) / Decimal('100.00')).quantize(Decimal('0.01'))
        # Ensure capital + expense = actual_cost exactly (handle rounding)
        expense_amount = actual_cost - capital_amount

        actual_data = {
            "project_id": project_id,
            "resource_id": resource.id,
            "external_worker_id": external_worker_id,
            "worker_name": worker_name,
            "actual_date": actual_date,
            "allocation_percentage": allocation_percentage,
            "actual_cost": actual_cost,
            "capital_amount": capital_amount,
            "expense_amount": expense_amount
        }

        return actual_repository.create(db, obj_in=actual_data)

    def import_labor_batch(
        self,
        db: Session,
        records: List[LaborImportRecord],
        validate_allocation: bool = True
    ) -> Dict[str, Any]:
        """
        Import a batch of labor actuals from validated LaborImportRecord objects.

        Records carrying a single `percentage` delegate to create_actual,
        which resolves the capital/expense split from the worker's planned
        ResourceAssignment (and rejects rows with no such assignment).
        Records carrying explicit `capital_percentage`/`expense_percentage`
        are costed directly from the worker's rate via
        _create_labor_split_actual, bypassing the assignment lookup.

        Args:
            db: Database session
            records: List of validated LaborImportRecord objects
            validate_allocation: Whether to validate allocation limits

        Returns:
            Dictionary with import results

        Raises:
            ImportException: If import fails
        """
        # Validate all records are valid
        invalid_records = [r for r in records if not r.is_valid()]
        if invalid_records:
            raise ImportException(
                f"Cannot import: {len(invalid_records)} records have validation errors",
                row_errors=[{
                    "row": r.row_number,
                    "errors": r.validation_errors
                } for r in invalid_records]
            )

        # Check for allocation conflicts if validation is enabled
        if validate_allocation:
            actuals_data = [
                {
                    "external_worker_id": r.external_worker_id,
                    "worker_name": r.worker_name,
                    "actual_date": r.actual_date,
                    "allocation_percentage": (
                        r.percentage if r.percentage is not None
                        else r.capital_percentage + r.expense_percentage
                    )
                }
                for r in records
            ]

            conflicts = allocation_validator_service.validate_batch_actuals(
                db=db,
                actuals_data=actuals_data
            )

            if conflicts:
                conflict_details = [c.to_dict() for c in conflicts]
                raise ImportException(
                    f"Allocation conflicts detected: {len(conflicts)} worker-date combinations would exceed 100% allocation",
                    details={"conflicts": conflict_details}
                )

        # Import actuals in a transaction
        created_actuals = []
        errors = []

        try:
            for record in records:
                try:
                    if record.percentage is not None:
                        actual = self.create_actual(
                            db=db,
                            project_id=record.project_id,
                            external_worker_id=record.external_worker_id,
                            worker_name=record.worker_name,
                            actual_date=record.actual_date,
                            allocation_percentage=record.percentage,
                            validate_allocation=False  # Already validated in batch
                        )
                    else:
                        actual = self._create_labor_split_actual(
                            db=db,
                            project_id=record.project_id,
                            external_worker_id=record.external_worker_id,
                            worker_name=record.worker_name,
                            actual_date=record.actual_date,
                            capital_percentage=record.capital_percentage,
                            expense_percentage=record.expense_percentage
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
                raise ImportException(
                    f"Import failed with {len(errors)} errors",
                    row_errors=errors
                )

            # Commit transaction
            db.commit()

            return {
                "status": "success",
                "imported_count": len(created_actuals),
                "actuals": created_actuals
            }

        except ImportException:
            # Re-raise import exceptions
            raise
        except Exception as e:
            db.rollback()
            raise ImportException(f"Import failed: {str(e)}")

    def import_nonlabor_batch(
        self,
        db: Session,
        records: List[NonLaborImportRecord]
    ) -> Dict[str, Any]:
        """
        Import a batch of non-labor actuals from validated
        NonLaborImportRecord objects.

        Non-labor actuals carry no worker or allocation percentage, so no
        allocation-conflict validation applies here.

        Args:
            db: Database session
            records: List of validated NonLaborImportRecord objects

        Returns:
            Dictionary with import results

        Raises:
            ImportException: If import fails
        """
        # Validate all records are valid
        invalid_records = [r for r in records if not r.is_valid()]
        if invalid_records:
            raise ImportException(
                f"Cannot import: {len(invalid_records)} records have validation errors",
                row_errors=[{
                    "row": r.row_number,
                    "errors": r.validation_errors
                } for r in invalid_records]
            )

        # Import actuals in a transaction
        created_actuals = []
        errors = []

        try:
            for record in records:
                try:
                    actual = self.create_nonlabor_actual(
                        db=db,
                        project_id=record.project_id,
                        resource_id=record.resource_id,
                        actual_date=record.actual_date,
                        capital_amount=record.capital,
                        expense_amount=record.expense
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
                raise ImportException(
                    f"Import failed with {len(errors)} errors",
                    row_errors=errors
                )

            # Commit transaction
            db.commit()

            return {
                "status": "success",
                "imported_count": len(created_actuals),
                "actuals": created_actuals
            }

        except ImportException:
            # Re-raise import exceptions
            raise
        except Exception as e:
            db.rollback()
            raise ImportException(f"Import failed: {str(e)}")

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
            raise ResourceNotFoundError("Actual", resource_id=actual_id)
        
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
                    raise AllocationConflictError(
                        resource_id=UUID(actual.external_worker_id) if actual.external_worker_id else actual_id,
                        date=str(actual.actual_date),
                        total_allocation=100.0,
                        message=f"Allocation limit exceeded for worker on {actual.actual_date}"
                    )
            
            # Recalculate cost
            worker = worker_repository.get_by_external_id(db, actual.external_worker_id)
            if not worker:
                raise WorkerNotFoundError(external_id=actual.external_worker_id)
            
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
        result = actual_repository.remove(db, id=actual_id)
        return result is not None


# Create service instance
actuals_service = ActualsService()
