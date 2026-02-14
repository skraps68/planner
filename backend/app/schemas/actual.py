"""
Actual-related Pydantic schemas.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin, PaginatedResponse, VersionedSchema


class ActualBase(BaseSchema):
    """Base actual schema with common fields."""
    
    project_id: UUID = Field(description="Project ID")
    resource_assignment_id: Optional[UUID] = Field(default=None, description="Resource assignment ID")
    external_worker_id: str = Field(min_length=1, max_length=100, description="External worker ID")
    worker_name: str = Field(min_length=1, max_length=255, description="Worker name")
    actual_date: date = Field(description="Actual work date")
    allocation_percentage: Decimal = Field(ge=0, le=100, description="Allocation percentage (0-100)")
    actual_cost: Decimal = Field(ge=0, description="Actual cost")
    capital_amount: Decimal = Field(ge=0, description="Capital amount")
    expense_amount: Decimal = Field(ge=0, description="Expense amount")
    
    @field_validator('expense_amount')
    @classmethod
    def validate_cost_split(cls, v, info):
        """Validate that capital_amount + expense_amount = actual_cost."""
        if 'capital_amount' in info.data and 'actual_cost' in info.data:
            total = info.data['capital_amount'] + v
            if total != info.data['actual_cost']:
                raise ValueError('Capital amount + expense amount must equal actual cost')
        return v


class ActualCreate(BaseSchema):
    """Schema for creating a new actual."""
    
    project_id: UUID = Field(description="Project ID")
    external_worker_id: str = Field(min_length=1, max_length=100, description="External worker ID")
    worker_name: str = Field(min_length=1, max_length=255, description="Worker name")
    actual_date: date = Field(description="Actual work date")
    allocation_percentage: Decimal = Field(ge=0, le=100, description="Allocation percentage (0-100)")


class ActualUpdate(VersionedSchema):
    """Schema for updating an existing actual."""
    
    project_id: Optional[UUID] = Field(default=None, description="Project ID")
    resource_assignment_id: Optional[UUID] = Field(default=None, description="Resource assignment ID")
    external_worker_id: Optional[str] = Field(default=None, min_length=1, max_length=100, description="External worker ID")
    worker_name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Worker name")
    actual_date: Optional[date] = Field(default=None, description="Actual work date")
    allocation_percentage: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Allocation percentage (0-100)")
    actual_cost: Optional[Decimal] = Field(default=None, ge=0, description="Actual cost")
    capital_amount: Optional[Decimal] = Field(default=None, ge=0, description="Capital amount")
    expense_amount: Optional[Decimal] = Field(default=None, ge=0, description="Expense amount")
    
    @field_validator('expense_amount')
    @classmethod
    def validate_cost_split(cls, v, info):
        """Validate that capital_amount + expense_amount = actual_cost."""
        if (v is not None and 'capital_amount' in info.data and 'actual_cost' in info.data and
            info.data['capital_amount'] is not None and info.data['actual_cost'] is not None):
            total = info.data['capital_amount'] + v
            if total != info.data['actual_cost']:
                raise ValueError('Capital amount + expense amount must equal actual cost')
        return v


class ActualResponse(ActualBase, TimestampMixin, VersionedSchema):
    """Schema for actual response."""
    
    project_name: Optional[str] = Field(default=None, description="Project name")
    program_name: Optional[str] = Field(default=None, description="Program name")
    cost_center_code: Optional[str] = Field(default=None, description="Project cost center code")


class ActualListResponse(PaginatedResponse[ActualResponse]):
    """Schema for paginated actual list response."""
    pass


class ActualImportRow(BaseSchema):
    """Schema for a single row in actuals import."""
    
    project_cost_center: str = Field(description="Project cost center code")
    external_worker_id: str = Field(description="External worker ID")
    worker_name: str = Field(description="Worker name")
    actual_date: date = Field(description="Actual work date")
    allocation_percentage: Decimal = Field(ge=0, le=100, description="Allocation percentage")
    actual_cost: Decimal = Field(ge=0, description="Actual cost")
    capital_amount: Decimal = Field(ge=0, description="Capital amount")
    expense_amount: Decimal = Field(ge=0, description="Expense amount")
    
    @field_validator('expense_amount')
    @classmethod
    def validate_cost_split(cls, v, info):
        """Validate that capital_amount + expense_amount = actual_cost."""
        if 'capital_amount' in info.data and 'actual_cost' in info.data:
            total = info.data['capital_amount'] + v
            if total != info.data['actual_cost']:
                raise ValueError('Capital amount + expense amount must equal actual cost')
        return v


class ActualImportRequest(BaseSchema):
    """Schema for actuals import request."""
    
    actuals: List[ActualImportRow] = Field(description="List of actuals to import")
    validate_only: bool = Field(default=False, description="Only validate, don't import")


class ActualImportResult(BaseSchema):
    """Schema for actual import result."""
    
    row_number: int = Field(description="Row number in import")
    success: bool = Field(description="Whether the row was processed successfully")
    actual_id: Optional[UUID] = Field(default=None, description="Created actual ID")
    errors: Optional[List[str]] = Field(default=None, description="Validation or processing errors")
    warnings: Optional[List[str]] = Field(default=None, description="Validation warnings")


class ActualImportResponse(BaseSchema):
    """Schema for actuals import response."""
    
    total_rows: int = Field(description="Total number of rows processed")
    successful_imports: int = Field(description="Number of successful imports")
    failed_imports: int = Field(description="Number of failed imports")
    results: List[ActualImportResult] = Field(description="Detailed results for each row")
    validation_only: bool = Field(description="Whether this was validation only")


class AllocationConflict(BaseSchema):
    """Schema for allocation conflict information."""
    
    external_worker_id: str = Field(description="External worker ID")
    worker_name: str = Field(description="Worker name")
    actual_date: date = Field(description="Actual work date")
    existing_allocation: Decimal = Field(description="Existing allocation percentage")
    new_allocation: Decimal = Field(description="New allocation percentage")
    total_allocation: Decimal = Field(description="Total allocation if both actuals exist")
    conflict_type: str = Field(description="Type of conflict (over_allocation, etc.)")


class AllocationConflictResponse(BaseSchema):
    """Schema for allocation conflict check response."""
    
    has_conflicts: bool = Field(description="Whether conflicts were found")
    conflicts: List[AllocationConflict] = Field(description="List of conflicts found")