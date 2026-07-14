"""
ActualsImportService for importing and validating actuals data from CSV files.
"""
import csv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.project import project_repository
from app.repositories.resource import worker_repository


class ActualsImportError(Exception):
    """Custom exception for actuals import errors."""
    pass


class ActualsImportValidationError(Exception):
    """Custom exception for actuals import validation errors."""
    
    def __init__(self, errors: List[Dict[str, Any]]):
        self.errors = errors
        super().__init__(f"Validation failed with {len(errors)} error(s)")


class ActualsImportRecord:
    """Represents a single actuals import record."""
    
    def __init__(
        self,
        row_number: int,
        project_id: str,
        external_worker_id: str,
        worker_name: str,
        actual_date: str,
        percentage: str
    ):
        self.row_number = row_number
        self.project_id_str = project_id
        self.external_worker_id = external_worker_id
        self.worker_name = worker_name
        self.actual_date_str = actual_date
        self.percentage_str = percentage
        
        # Parsed values (set during validation)
        self.project_id: Optional[UUID] = None
        self.actual_date: Optional[date] = None
        self.percentage: Optional[Decimal] = None
        self.validation_errors: List[str] = []
    
    def is_valid(self) -> bool:
        """Check if the record passed validation."""
        return len(self.validation_errors) == 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert record to dictionary for error reporting."""
        return {
            "row": self.row_number,
            "project_id": self.project_id_str,
            "external_worker_id": self.external_worker_id,
            "worker_name": self.worker_name,
            "date": self.actual_date_str,
            "percentage": self.percentage_str,
            "errors": self.validation_errors
        }


class ActualsImportService:
    """Service for importing actuals data from CSV files."""
    
    REQUIRED_COLUMNS = [
        "project_id",
        "external_worker_id",
        "worker_name",
        "date",
        "percentage"
    ]
    
    def __init__(self):
        pass
    
    def parse_csv(self, csv_content: str) -> List[ActualsImportRecord]:
        """
        Parse CSV content into ActualsImportRecord objects.
        
        Args:
            csv_content: CSV file content as string
            
        Returns:
            List of ActualsImportRecord objects
            
        Raises:
            ActualsImportError: If CSV format is invalid
        """
        try:
            csv_file = StringIO(csv_content)
            reader = csv.DictReader(csv_file)
            
            # Validate headers
            if not reader.fieldnames:
                raise ActualsImportError("CSV file is empty or has no headers")
            
            missing_columns = set(self.REQUIRED_COLUMNS) - set(reader.fieldnames)
            if missing_columns:
                raise ActualsImportError(
                    f"Missing required columns: {', '.join(missing_columns)}"
                )
            
            records = []
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    record = ActualsImportRecord(
                        row_number=row_num,
                        project_id=row.get("project_id", "").strip(),
                        external_worker_id=row.get("external_worker_id", "").strip(),
                        worker_name=row.get("worker_name", "").strip(),
                        actual_date=row.get("date", "").strip(),
                        percentage=row.get("percentage", "").strip()
                    )
                    records.append(record)
                except Exception as e:
                    raise ActualsImportError(f"Error parsing row {row_num}: {str(e)}")
            
            if not records:
                raise ActualsImportError("CSV file contains no data rows")
            
            return records
            
        except csv.Error as e:
            raise ActualsImportError(f"CSV parsing error: {str(e)}")
    
    def validate_records(
        self,
        db: Session,
        records: List[ActualsImportRecord]
    ) -> List[ActualsImportRecord]:
        """
        Validate all records for data integrity.
        
        Args:
            db: Database session
            records: List of ActualsImportRecord objects
            
        Returns:
            List of validated records (with validation_errors populated)
        """
        for record in records:
            self._validate_record(db, record)
        
        return records
    
    def _validate_record(self, db: Session, record: ActualsImportRecord) -> None:
        """Validate a single record."""
        
        # Validate project_id (UUID format and existence)
        if not record.project_id_str:
            record.validation_errors.append("project_id is required")
        else:
            try:
                record.project_id = UUID(record.project_id_str)
                # Check if project exists
                project = project_repository.get(db, record.project_id)
                if not project:
                    record.validation_errors.append(
                        f"Project with ID {record.project_id} does not exist"
                    )
            except ValueError:
                record.validation_errors.append(
                    f"Invalid project_id format: {record.project_id_str}"
                )
        
        # Validate external_worker_id
        if not record.external_worker_id:
            record.validation_errors.append("external_worker_id is required")
        else:
            # Check if worker exists
            worker = worker_repository.get_by_external_id(db, record.external_worker_id)
            if not worker:
                record.validation_errors.append(
                    f"Worker with external_id '{record.external_worker_id}' does not exist"
                )
            elif record.worker_name and worker.name != record.worker_name:
                record.validation_errors.append(
                    f"Worker name mismatch: expected '{worker.name}', got '{record.worker_name}'"
                )
        
        # Validate worker_name
        if not record.worker_name:
            record.validation_errors.append("worker_name is required")
        
        # Validate date
        if not record.actual_date_str:
            record.validation_errors.append("date is required")
        else:
            try:
                record.actual_date = datetime.strptime(
                    record.actual_date_str, "%Y-%m-%d"
                ).date()
            except ValueError:
                record.validation_errors.append(
                    f"Invalid date format: {record.actual_date_str} (expected YYYY-MM-DD)"
                )
        
        # Validate percentage
        if not record.percentage_str:
            record.validation_errors.append("percentage is required")
        else:
            try:
                record.percentage = Decimal(record.percentage_str)
                if record.percentage < Decimal('0.00'):
                    record.validation_errors.append(
                        f"Percentage must be >= 0.0, got {record.percentage}"
                    )
                elif record.percentage > Decimal('100.00'):
                    record.validation_errors.append(
                        f"Percentage must be <= 100.0, got {record.percentage}"
                    )
            except (InvalidOperation, ValueError):
                record.validation_errors.append(
                    f"Invalid percentage format: {record.percentage_str}"
                )
    
    def get_validation_errors(
        self,
        records: List[ActualsImportRecord]
    ) -> List[Dict[str, Any]]:
        """
        Get all validation errors from records.
        
        Args:
            records: List of validated ActualsImportRecord objects
            
        Returns:
            List of error dictionaries
        """
        errors = []
        for record in records:
            if not record.is_valid():
                errors.append(record.to_dict())
        return errors
    
    def import_actuals(
        self,
        db: Session,
        csv_content: str,
        validate_only: bool = False
    ) -> Dict[str, Any]:
        """
        Import actuals from CSV content.
        
        Args:
            db: Database session
            csv_content: CSV file content as string
            validate_only: If True, only validate without importing
            
        Returns:
            Dictionary with import results
            
        Raises:
            ActualsImportError: If CSV parsing fails
            ActualsImportValidationError: If validation fails
        """
        # Parse CSV
        records = self.parse_csv(csv_content)
        
        # Validate records
        validated_records = self.validate_records(db, records)
        
        # Check for validation errors
        validation_errors = self.get_validation_errors(validated_records)
        if validation_errors:
            raise ActualsImportValidationError(validation_errors)
        
        # If validate_only, return validation results
        if validate_only:
            return {
                "status": "validated",
                "total_records": len(records),
                "valid_records": len([r for r in records if r.is_valid()]),
                "invalid_records": len(validation_errors),
                "errors": validation_errors
            }
        
        # Import will be handled by ActualsService (task 4.3)
        # For now, return the validated records
        return {
            "status": "ready_for_import",
            "total_records": len(records),
            "valid_records": len([r for r in records if r.is_valid()]),
            "records": validated_records
        }


class LaborImportRecord:
    """Represents a single labor actuals import record.

    Either `percentage` (single-bucket) or the pair
    `capital_percentage`/`expense_percentage` (split) is populated,
    depending on which form the CSV header declared.
    """

    def __init__(
        self,
        row_number: int,
        project_id: str,
        external_worker_id: str,
        worker_name: str,
        actual_date: str,
        percentage: Optional[str] = None,
        capital_percentage: Optional[str] = None,
        expense_percentage: Optional[str] = None,
    ):
        self.row_number = row_number
        self.project_id_str = project_id
        self.external_worker_id = external_worker_id
        self.worker_name = worker_name
        self.actual_date_str = actual_date
        self.percentage_str = percentage
        self.capital_percentage_str = capital_percentage
        self.expense_percentage_str = expense_percentage

        # Parsed values (set during validation)
        self.project_id: Optional[UUID] = None
        self.actual_date: Optional[date] = None
        self.percentage: Optional[Decimal] = None
        self.capital_percentage: Optional[Decimal] = None
        self.expense_percentage: Optional[Decimal] = None
        self.validation_errors: List[str] = []

    def is_valid(self) -> bool:
        """Check if the record passed validation."""
        return len(self.validation_errors) == 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert record to dictionary for error reporting."""
        return {
            "row": self.row_number,
            "project_id": self.project_id_str,
            "external_worker_id": self.external_worker_id,
            "worker_name": self.worker_name,
            "date": self.actual_date_str,
            "percentage": self.percentage_str,
            "capital_percentage": self.capital_percentage_str,
            "expense_percentage": self.expense_percentage_str,
            "errors": self.validation_errors,
        }


class LaborActualsImportService:
    """Service for importing labor actuals data from CSV files.

    Accepts either a single `percentage` column, or a split pair of
    `capital_percentage`/`expense_percentage` columns — but not both or
    neither. Rows carrying a `resource_id` column belong to the
    non-labor importer and are rejected at the header level.
    """

    BASE_REQUIRED_COLUMNS = [
        "project_id",
        "external_worker_id",
        "worker_name",
        "date",
    ]

    def __init__(self):
        pass

    def parse_csv(self, csv_content: str) -> List[LaborImportRecord]:
        """
        Parse CSV content into LaborImportRecord objects.

        Args:
            csv_content: CSV file content as string

        Returns:
            List of LaborImportRecord objects

        Raises:
            ActualsImportError: If CSV format is invalid
        """
        try:
            csv_file = StringIO(csv_content)
            reader = csv.DictReader(csv_file)

            # Validate headers
            if not reader.fieldnames:
                raise ActualsImportError("CSV file is empty or has no headers")

            fieldnames = set(reader.fieldnames)

            missing_columns = set(self.BASE_REQUIRED_COLUMNS) - fieldnames
            if missing_columns:
                raise ActualsImportError(
                    f"Missing required columns: {', '.join(missing_columns)}"
                )

            if "resource_id" in fieldnames:
                raise ActualsImportError(
                    "Column 'resource_id' is not valid for the labor actuals "
                    "importer; use the non-labor actuals importer instead"
                )

            has_single = "percentage" in fieldnames
            has_split = "capital_percentage" in fieldnames and "expense_percentage" in fieldnames

            if has_single and has_split:
                raise ActualsImportError(
                    "CSV must not contain both 'percentage' and "
                    "'capital_percentage'/'expense_percentage' columns"
                )
            if not has_single and not has_split:
                raise ActualsImportError(
                    "CSV must contain either a 'percentage' column or both "
                    "'capital_percentage' and 'expense_percentage' columns"
                )

            records = []
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    record = LaborImportRecord(
                        row_number=row_num,
                        project_id=row.get("project_id", "").strip(),
                        external_worker_id=row.get("external_worker_id", "").strip(),
                        worker_name=row.get("worker_name", "").strip(),
                        actual_date=row.get("date", "").strip(),
                        percentage=row.get("percentage", "").strip() if has_single else None,
                        capital_percentage=row.get("capital_percentage", "").strip() if has_split else None,
                        expense_percentage=row.get("expense_percentage", "").strip() if has_split else None,
                    )
                    records.append(record)
                except Exception as e:
                    raise ActualsImportError(f"Error parsing row {row_num}: {str(e)}")

            if not records:
                raise ActualsImportError("CSV file contains no data rows")

            return records

        except csv.Error as e:
            raise ActualsImportError(f"CSV parsing error: {str(e)}")

    def validate_records(
        self,
        db: Session,
        records: List[LaborImportRecord]
    ) -> List[LaborImportRecord]:
        """
        Validate all records for data integrity.

        Args:
            db: Database session
            records: List of LaborImportRecord objects

        Returns:
            List of validated records (with validation_errors populated)
        """
        for record in records:
            self._validate_record(db, record)

        return records

    def _validate_record(self, db: Session, record: LaborImportRecord) -> None:
        """Validate a single record."""

        # Validate project_id (UUID format and existence)
        if not record.project_id_str:
            record.validation_errors.append("project_id is required")
        else:
            try:
                record.project_id = UUID(record.project_id_str)
                # Check if project exists
                project = project_repository.get(db, record.project_id)
                if not project:
                    record.validation_errors.append(
                        f"Project with ID {record.project_id} does not exist"
                    )
            except ValueError:
                record.validation_errors.append(
                    f"Invalid project_id format: {record.project_id_str}"
                )

        # Validate external_worker_id
        if not record.external_worker_id:
            record.validation_errors.append("external_worker_id is required")
        else:
            # Check if worker exists
            worker = worker_repository.get_by_external_id(db, record.external_worker_id)
            if not worker:
                record.validation_errors.append(
                    f"Worker with external_id '{record.external_worker_id}' does not exist"
                )
            elif record.worker_name and worker.name != record.worker_name:
                record.validation_errors.append(
                    f"Worker name mismatch: expected '{worker.name}', got '{record.worker_name}'"
                )

        # Validate worker_name
        if not record.worker_name:
            record.validation_errors.append("worker_name is required")

        # Validate date
        if not record.actual_date_str:
            record.validation_errors.append("date is required")
        else:
            try:
                record.actual_date = datetime.strptime(
                    record.actual_date_str, "%Y-%m-%d"
                ).date()
            except ValueError:
                record.validation_errors.append(
                    f"Invalid date format: {record.actual_date_str} (expected YYYY-MM-DD)"
                )

        # Validate percentage(s), depending on which form this record carries
        # (parse_csv guarantees exactly one of the two forms is populated).
        if record.percentage_str is not None:
            self._validate_single_percentage(record)
        else:
            self._validate_split_percentage(record)

    def _validate_single_percentage(self, record: LaborImportRecord) -> None:
        """Validate the single `percentage` column form."""
        if not record.percentage_str:
            record.validation_errors.append("percentage is required")
            return
        try:
            record.percentage = Decimal(record.percentage_str)
            if record.percentage < Decimal('0.00'):
                record.validation_errors.append(
                    f"Percentage must be >= 0.0, got {record.percentage}"
                )
            elif record.percentage > Decimal('100.00'):
                record.validation_errors.append(
                    f"Percentage must be <= 100.0, got {record.percentage}"
                )
        except (InvalidOperation, ValueError):
            record.validation_errors.append(
                f"Invalid percentage format: {record.percentage_str}"
            )

    def _validate_split_percentage(self, record: LaborImportRecord) -> None:
        """Validate the split `capital_percentage`/`expense_percentage` form."""
        if not record.capital_percentage_str:
            record.validation_errors.append("capital_percentage is required")
        if not record.expense_percentage_str:
            record.validation_errors.append("expense_percentage is required")
        if not record.capital_percentage_str or not record.expense_percentage_str:
            return

        try:
            record.capital_percentage = Decimal(record.capital_percentage_str)
        except (InvalidOperation, ValueError):
            record.validation_errors.append(
                f"Invalid capital_percentage format: {record.capital_percentage_str}"
            )
        try:
            record.expense_percentage = Decimal(record.expense_percentage_str)
        except (InvalidOperation, ValueError):
            record.validation_errors.append(
                f"Invalid expense_percentage format: {record.expense_percentage_str}"
            )

        if record.capital_percentage is None or record.expense_percentage is None:
            return

        if record.capital_percentage < Decimal('0.00'):
            record.validation_errors.append(
                f"capital_percentage must be >= 0.0, got {record.capital_percentage}"
            )
        if record.expense_percentage < Decimal('0.00'):
            record.validation_errors.append(
                f"expense_percentage must be >= 0.0, got {record.expense_percentage}"
            )
        if record.capital_percentage > Decimal('100.00'):
            record.validation_errors.append(
                f"capital_percentage must be <= 100.0, got {record.capital_percentage}"
            )
        if record.expense_percentage > Decimal('100.00'):
            record.validation_errors.append(
                f"expense_percentage must be <= 100.0, got {record.expense_percentage}"
            )

        total = record.capital_percentage + record.expense_percentage
        if total > Decimal('100.00'):
            record.validation_errors.append(
                f"capital_percentage + expense_percentage must be <= 100.0, got {total}"
            )
        if total <= Decimal('0.00'):
            record.validation_errors.append(
                "At least one of capital_percentage/expense_percentage must be > 0"
            )

    def get_validation_errors(
        self,
        records: List[LaborImportRecord]
    ) -> List[Dict[str, Any]]:
        """
        Get all validation errors from records.

        Args:
            records: List of validated LaborImportRecord objects

        Returns:
            List of error dictionaries
        """
        errors = []
        for record in records:
            if not record.is_valid():
                errors.append(record.to_dict())
        return errors


# Create service instances
actuals_import_service = ActualsImportService()
labor_actuals_import_service = LaborActualsImportService()
