"""
Program-related Pydantic schemas.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin, PaginatedResponse


class ProgramBase(BaseSchema):
    """Base program schema with common fields."""
    
    name: str = Field(min_length=1, max_length=255, description="Program name")
    business_sponsor: str = Field(min_length=1, max_length=255, description="Business sponsor name")
    program_manager: str = Field(min_length=1, max_length=255, description="Program manager name")
    technical_lead: str = Field(min_length=1, max_length=255, description="Technical lead name")
    start_date: date = Field(description="Program start date")
    end_date: date = Field(description="Program end date")
    description: Optional[str] = Field(default=None, max_length=1000, description="Program description")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after start_date."""
        if 'start_date' in info.data and v <= info.data['start_date']:
            raise ValueError('End date must be after start date')
        return v


class ProgramCreate(ProgramBase):
    """Schema for creating a new program."""
    pass


class ProgramUpdate(BaseSchema):
    """Schema for updating an existing program."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Program name")
    business_sponsor: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Business sponsor name")
    program_manager: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Program manager name")
    technical_lead: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Technical lead name")
    start_date: Optional[date] = Field(default=None, description="Program start date")
    end_date: Optional[date] = Field(default=None, description="Program end date")
    description: Optional[str] = Field(default=None, max_length=1000, description="Program description")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after start_date."""
        if v is not None and 'start_date' in info.data and info.data['start_date'] is not None:
            if v <= info.data['start_date']:
                raise ValueError('End date must be after start date')
        return v


class ProgramResponse(ProgramBase, TimestampMixin):
    """Schema for program response."""
    
    project_count: Optional[int] = Field(default=0, description="Number of projects in this program")


class ProgramListResponse(PaginatedResponse[ProgramResponse]):
    """Schema for paginated program list response."""
    pass


class ProgramSummary(BaseSchema):
    """Summary schema for program with basic info."""
    
    id: UUID
    name: str
    business_sponsor: str
    start_date: date
    end_date: date
    project_count: int = Field(default=0, description="Number of projects in this program")