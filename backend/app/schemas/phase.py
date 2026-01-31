"""
Phase-related Pydantic schemas.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin


class PhaseBase(BaseSchema):
    """Base phase schema with common fields."""
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Planning",
                    "start_date": "2024-01-01",
                    "end_date": "2024-03-31",
                    "description": "Initial planning phase",
                    "capital_budget": 50000.00,
                    "expense_budget": 25000.00,
                    "total_budget": 75000.00
                }
            ]
        }
    }
    
    name: str = Field(min_length=1, max_length=100, description="Phase name")
    start_date: date = Field(description="Phase start date")
    end_date: date = Field(description="Phase end date")
    description: Optional[str] = Field(default=None, max_length=500, description="Phase description")
    capital_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Capital budget")
    expense_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Expense budget")
    total_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Total budget")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after or equal to start_date."""
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('End date must be on or after start date')
        return v
    
    @field_validator('total_budget')
    @classmethod
    def validate_total_budget(cls, v, info):
        """Validate that total_budget equals capital_budget + expense_budget."""
        if 'capital_budget' in info.data and 'expense_budget' in info.data:
            expected_total = info.data['capital_budget'] + info.data['expense_budget']
            if v != expected_total:
                raise ValueError(f'Total budget must equal capital + expense ({expected_total})')
        return v


class PhaseCreate(PhaseBase):
    """Schema for creating a new phase."""
    project_id: UUID = Field(description="Project ID this phase belongs to")


class PhaseUpdate(BaseSchema):
    """Schema for updating an existing phase."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    start_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    description: Optional[str] = Field(default=None, max_length=500)
    capital_budget: Optional[Decimal] = Field(default=None, ge=0)
    expense_budget: Optional[Decimal] = Field(default=None, ge=0)
    total_budget: Optional[Decimal] = Field(default=None, ge=0)


class PhaseResponse(PhaseBase, TimestampMixin):
    """Schema for phase response."""
    
    id: UUID
    project_id: UUID
    assignment_count: Optional[int] = Field(default=0, description="Number of assignments in this phase")


class PhaseValidationRequest(BaseSchema):
    """Schema for validating phases."""
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "id": None,
                    "name": "Planning",
                    "start_date": "2024-01-01",
                    "end_date": "2024-03-31"
                }
            ]
        }
    }
    
    id: Optional[UUID] = Field(default=None, description="Phase ID (null for new phases)")
    name: str
    start_date: date
    end_date: date


class PhaseValidationError(BaseSchema):
    """Validation error details."""
    
    field: str
    message: str
    phase_id: Optional[UUID] = None


class PhaseValidationResult(BaseSchema):
    """Result of phase validation."""
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "is_valid": True,
                    "errors": []
                },
                {
                    "is_valid": False,
                    "errors": [
                        {
                            "field": "timeline",
                            "message": "Gap detected between Planning and Execution",
                            "phase_id": None
                        }
                    ]
                }
            ]
        }
    }
    
    is_valid: bool
    errors: List[PhaseValidationError]


class PhaseBatchItem(BaseSchema):
    """Schema for a single phase in a batch update."""
    
    id: Optional[UUID] = Field(default=None, description="Phase ID (null for new phases)")
    name: str = Field(min_length=1, max_length=100, description="Phase name")
    start_date: date = Field(description="Phase start date")
    end_date: date = Field(description="Phase end date")
    description: Optional[str] = Field(default=None, max_length=500, description="Phase description")
    capital_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Capital budget")
    expense_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Expense budget")
    total_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Total budget")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after or equal to start_date."""
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('End date must be on or after start date')
        return v
    
    @field_validator('total_budget')
    @classmethod
    def validate_total_budget(cls, v, info):
        """Validate that total_budget equals capital_budget + expense_budget."""
        if 'capital_budget' in info.data and 'expense_budget' in info.data:
            expected_total = info.data['capital_budget'] + info.data['expense_budget']
            if v != expected_total:
                raise ValueError(f'Total budget must equal capital + expense ({expected_total})')
        return v


class PhaseBatchUpdate(BaseSchema):
    """Schema for batch updating all phases for a project."""
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "phases": [
                        {
                            "id": None,
                            "name": "Planning",
                            "start_date": "2024-01-01",
                            "end_date": "2024-03-31",
                            "description": "Initial planning phase",
                            "capital_budget": 50000.00,
                            "expense_budget": 25000.00,
                            "total_budget": 75000.00
                        },
                        {
                            "id": "123e4567-e89b-12d3-a456-426614174001",
                            "name": "Execution",
                            "start_date": "2024-04-01",
                            "end_date": "2024-12-31",
                            "description": "Main execution phase",
                            "capital_budget": 150000.00,
                            "expense_budget": 75000.00,
                            "total_budget": 225000.00
                        }
                    ]
                }
            ]
        }
    }
    
    phases: List[PhaseBatchItem] = Field(description="Complete list of phases for the project")
