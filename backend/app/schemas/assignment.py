"""
Resource assignment-related Pydantic schemas.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin, PaginatedResponse


class ResourceAssignmentBase(BaseSchema):
    """Base resource assignment schema with common fields."""
    
    resource_id: UUID = Field(description="Resource ID")
    project_id: UUID = Field(description="Project ID")
    project_phase_id: UUID = Field(description="Project phase ID")
    assignment_date: date = Field(description="Assignment date")
    allocation_percentage: Decimal = Field(ge=0, le=100, description="Allocation percentage (0-100)")
    capital_percentage: Decimal = Field(ge=0, le=100, description="Capital percentage (0-100)")
    expense_percentage: Decimal = Field(ge=0, le=100, description="Expense percentage (0-100)")
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_accounting_split(cls, v, info):
        """Validate that capital_percentage + expense_percentage = 100."""
        if 'capital_percentage' in info.data:
            total = info.data['capital_percentage'] + v
            if total != 100:
                raise ValueError('Capital percentage + expense percentage must equal 100')
        return v


class ResourceAssignmentCreate(ResourceAssignmentBase):
    """Schema for creating a new resource assignment."""
    pass


class ResourceAssignmentUpdate(BaseSchema):
    """Schema for updating an existing resource assignment."""
    
    resource_id: Optional[UUID] = Field(default=None, description="Resource ID")
    project_id: Optional[UUID] = Field(default=None, description="Project ID")
    project_phase_id: Optional[UUID] = Field(default=None, description="Project phase ID")
    assignment_date: Optional[date] = Field(default=None, description="Assignment date")
    allocation_percentage: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Allocation percentage (0-100)")
    capital_percentage: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Capital percentage (0-100)")
    expense_percentage: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Expense percentage (0-100)")
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_accounting_split(cls, v, info):
        """Validate that capital_percentage + expense_percentage = 100."""
        if v is not None and 'capital_percentage' in info.data and info.data['capital_percentage'] is not None:
            total = info.data['capital_percentage'] + v
            if total != 100:
                raise ValueError('Capital percentage + expense percentage must equal 100')
        return v


class ResourceAssignmentResponse(ResourceAssignmentBase, TimestampMixin):
    """Schema for resource assignment response."""
    
    resource_name: Optional[str] = Field(default=None, description="Resource name")
    project_name: Optional[str] = Field(default=None, description="Project name")
    program_name: Optional[str] = Field(default=None, description="Program name")
    phase_type: Optional[str] = Field(default=None, description="Project phase type")


class ResourceAssignmentListResponse(PaginatedResponse[ResourceAssignmentResponse]):
    """Schema for paginated resource assignment list response."""
    pass


class AssignmentImportRow(BaseSchema):
    """Schema for a single row in assignment import."""
    
    resource_name: str = Field(description="Resource name")
    project_cost_center: str = Field(description="Project cost center code")
    phase_type: str = Field(description="Project phase type (planning/execution)")
    assignment_date: date = Field(description="Assignment date")
    allocation_percentage: Decimal = Field(ge=0, le=100, description="Allocation percentage")
    capital_percentage: Decimal = Field(ge=0, le=100, description="Capital percentage")
    expense_percentage: Decimal = Field(ge=0, le=100, description="Expense percentage")
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_accounting_split(cls, v, info):
        """Validate that capital_percentage + expense_percentage = 100."""
        if 'capital_percentage' in info.data:
            total = info.data['capital_percentage'] + v
            if total != 100:
                raise ValueError('Capital percentage + expense percentage must equal 100')
        return v


class AssignmentImportRequest(BaseSchema):
    """Schema for assignment import request."""
    
    assignments: List[AssignmentImportRow] = Field(description="List of assignments to import")
    validate_only: bool = Field(default=False, description="Only validate, don't import")


class AssignmentImportResult(BaseSchema):
    """Schema for assignment import result."""
    
    row_number: int = Field(description="Row number in import")
    success: bool = Field(description="Whether the row was processed successfully")
    assignment_id: Optional[UUID] = Field(default=None, description="Created assignment ID")
    errors: Optional[List[str]] = Field(default=None, description="Validation or processing errors")


class AssignmentImportResponse(BaseSchema):
    """Schema for assignment import response."""
    
    total_rows: int = Field(description="Total number of rows processed")
    successful_imports: int = Field(description="Number of successful imports")
    failed_imports: int = Field(description="Number of failed imports")
    results: List[AssignmentImportResult] = Field(description="Detailed results for each row")
    validation_only: bool = Field(description="Whether this was validation only")


class AssignmentConflict(BaseSchema):
    """Schema for assignment conflict information."""
    
    resource_id: UUID = Field(description="Resource ID")
    resource_name: str = Field(description="Resource name")
    assignment_date: date = Field(description="Assignment date")
    existing_allocation: Decimal = Field(description="Existing allocation percentage")
    new_allocation: Decimal = Field(description="New allocation percentage")
    total_allocation: Decimal = Field(description="Total allocation if both assignments exist")
    conflict_type: str = Field(description="Type of conflict (over_allocation, etc.)")


class AssignmentConflictResponse(BaseSchema):
    """Schema for assignment conflict check response."""
    
    has_conflicts: bool = Field(description="Whether conflicts were found")
    conflicts: List[AssignmentConflict] = Field(description="List of conflicts found")