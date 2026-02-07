"""
Portfolio-related Pydantic schemas.
"""
from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin, PaginatedResponse


class PortfolioBase(BaseSchema):
    """Base portfolio schema with common fields."""
    
    name: str = Field(min_length=1, max_length=255, description="Portfolio name")
    description: str = Field(min_length=1, max_length=1000, description="Portfolio description")
    owner: str = Field(min_length=1, max_length=255, description="Portfolio owner")
    reporting_start_date: date = Field(description="Reporting period start date")
    reporting_end_date: date = Field(description="Reporting period end date")
    
    @field_validator('reporting_end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that reporting_end_date is after reporting_start_date."""
        if 'reporting_start_date' in info.data and v <= info.data['reporting_start_date']:
            raise ValueError('Reporting end date must be after reporting start date')
        return v


class PortfolioCreate(PortfolioBase):
    """Schema for creating a new portfolio."""
    pass


class PortfolioUpdate(BaseSchema):
    """Schema for updating an existing portfolio."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Portfolio name")
    description: Optional[str] = Field(default=None, min_length=1, max_length=1000, description="Portfolio description")
    owner: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Portfolio owner")
    reporting_start_date: Optional[date] = Field(default=None, description="Reporting period start date")
    reporting_end_date: Optional[date] = Field(default=None, description="Reporting period end date")
    
    @field_validator('reporting_end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that reporting_end_date is after reporting_start_date."""
        if v is not None and 'reporting_start_date' in info.data and info.data['reporting_start_date'] is not None:
            if v <= info.data['reporting_start_date']:
                raise ValueError('Reporting end date must be after reporting start date')
        return v


class PortfolioResponse(PortfolioBase, TimestampMixin):
    """Schema for portfolio response."""
    
    program_count: Optional[int] = Field(default=0, description="Number of programs in this portfolio")


class PortfolioListResponse(PaginatedResponse[PortfolioResponse]):
    """Schema for paginated portfolio list response."""
    pass


class PortfolioSummary(BaseSchema):
    """Summary schema for portfolio with basic info."""
    
    id: UUID
    name: str
    owner: str
    reporting_start_date: date
    reporting_end_date: date
    program_count: int = Field(default=0, description="Number of programs in this portfolio")
