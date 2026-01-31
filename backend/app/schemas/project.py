"""
Project-related Pydantic schemas.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin, PaginatedResponse


class ProjectBase(BaseSchema):
    """Base project schema with common fields."""
    
    program_id: UUID = Field(description="Program ID this project belongs to")
    name: str = Field(min_length=1, max_length=255, description="Project name")
    business_sponsor: str = Field(min_length=1, max_length=255, description="Business sponsor name")
    project_manager: str = Field(min_length=1, max_length=255, description="Project manager name")
    technical_lead: str = Field(min_length=1, max_length=255, description="Technical lead name")
    start_date: date = Field(description="Project start date")
    end_date: date = Field(description="Project end date")
    cost_center_code: str = Field(min_length=1, max_length=50, description="Cost center code")
    description: Optional[str] = Field(default=None, max_length=1000, description="Project description")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after start_date."""
        if 'start_date' in info.data and v <= info.data['start_date']:
            raise ValueError('End date must be after start date')
        return v


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""
    pass


class ProjectUpdate(BaseSchema):
    """Schema for updating an existing project."""
    
    program_id: Optional[UUID] = Field(default=None, description="Program ID this project belongs to")
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Project name")
    business_sponsor: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Business sponsor name")
    project_manager: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Project manager name")
    technical_lead: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Technical lead name")
    start_date: Optional[date] = Field(default=None, description="Project start date")
    end_date: Optional[date] = Field(default=None, description="Project end date")
    cost_center_code: Optional[str] = Field(default=None, min_length=1, max_length=50, description="Cost center code")
    description: Optional[str] = Field(default=None, max_length=1000, description="Project description")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after start_date."""
        if v is not None and 'start_date' in info.data and info.data['start_date'] is not None:
            if v <= info.data['start_date']:
                raise ValueError('End date must be after start date')
        return v


class ProjectPhaseBase(BaseSchema):
    """Base project phase schema with common fields (deprecated - use PhaseBase instead)."""
    
    project_id: UUID = Field(description="Project ID this phase belongs to")
    name: str = Field(min_length=1, max_length=100, description="Phase name")
    start_date: date = Field(description="Phase start date")
    end_date: date = Field(description="Phase end date")
    description: Optional[str] = Field(default=None, max_length=500, description="Phase description")
    capital_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Capital budget amount")
    expense_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Expense budget amount")
    total_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Total budget amount")
    
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
                raise ValueError(f'Total budget must equal capital budget + expense budget ({expected_total})')
        return v


class ProjectPhaseCreate(ProjectPhaseBase):
    """Schema for creating a new project phase (deprecated - use PhaseCreate instead)."""
    pass


class ProjectPhaseUpdate(BaseSchema):
    """Schema for updating an existing project phase (deprecated - use PhaseUpdate instead)."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Phase name")
    start_date: Optional[date] = Field(default=None, description="Phase start date")
    end_date: Optional[date] = Field(default=None, description="Phase end date")
    description: Optional[str] = Field(default=None, max_length=500, description="Phase description")
    capital_budget: Optional[Decimal] = Field(default=None, ge=0, description="Capital budget amount")
    expense_budget: Optional[Decimal] = Field(default=None, ge=0, description="Expense budget amount")
    total_budget: Optional[Decimal] = Field(default=None, ge=0, description="Total budget amount")
    
    @field_validator('total_budget')
    @classmethod
    def validate_total_budget(cls, v, info):
        """Validate that total_budget equals capital_budget + expense_budget."""
        if v is not None and 'capital_budget' in info.data and 'expense_budget' in info.data:
            if info.data['capital_budget'] is not None and info.data['expense_budget'] is not None:
                expected_total = info.data['capital_budget'] + info.data['expense_budget']
                if v != expected_total:
                    raise ValueError(f'Total budget must equal capital budget + expense budget ({expected_total})')
        return v


class ProjectPhaseResponse(ProjectPhaseBase, TimestampMixin):
    """Schema for project phase response (deprecated - use PhaseResponse instead)."""
    id: UUID
    assignment_count: Optional[int] = Field(default=0, description="Number of assignments in this phase")


class ProjectResponse(ProjectBase, TimestampMixin):
    """Schema for project response."""
    
    program_name: Optional[str] = Field(default=None, description="Program name")
    phases: Optional[List[ProjectPhaseResponse]] = Field(default=None, description="Project phases")
    assignment_count: Optional[int] = Field(default=0, description="Number of resource assignments")
    actual_count: Optional[int] = Field(default=0, description="Number of actual records")


class ProjectListResponse(PaginatedResponse[ProjectResponse]):
    """Schema for paginated project list response."""
    pass


class ProjectSummary(BaseSchema):
    """Summary schema for project with basic info."""
    
    id: UUID
    name: str
    program_id: UUID
    program_name: str
    project_manager: str
    start_date: date
    end_date: date
    cost_center_code: str