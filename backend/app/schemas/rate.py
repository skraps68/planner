"""
Rate-related Pydantic schemas.
"""
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin, PaginatedResponse


class RateBase(BaseSchema):
    """Base rate schema with common fields."""
    
    worker_type_id: UUID = Field(description="Worker type ID")
    rate_amount: Decimal = Field(gt=0, description="Rate amount (must be positive)")
    start_date: date = Field(description="Rate start date")
    end_date: Optional[date] = Field(default=None, description="Rate end date (null for current rate)")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after start_date."""
        if v is not None and 'start_date' in info.data and v <= info.data['start_date']:
            raise ValueError('End date must be after start date')
        return v


class RateCreate(RateBase):
    """Schema for creating a new rate."""
    pass


class RateUpdate(BaseSchema):
    """Schema for updating an existing rate."""
    
    worker_type_id: Optional[UUID] = Field(default=None, description="Worker type ID")
    rate_amount: Optional[Decimal] = Field(default=None, gt=0, description="Rate amount (must be positive)")
    start_date: Optional[date] = Field(default=None, description="Rate start date")
    end_date: Optional[date] = Field(default=None, description="Rate end date (null for current rate)")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after start_date."""
        if v is not None and 'start_date' in info.data and info.data['start_date'] is not None:
            if v <= info.data['start_date']:
                raise ValueError('End date must be after start date')
        return v


class RateResponse(RateBase, TimestampMixin):
    """Schema for rate response."""
    
    worker_type_name: Optional[str] = Field(default=None, description="Worker type name")
    is_current: Optional[bool] = Field(default=None, description="Whether this is the current rate")


class RateListResponse(PaginatedResponse[RateResponse]):
    """Schema for paginated rate list response."""
    pass


class RateHistory(BaseSchema):
    """Schema for rate history information."""
    
    id: UUID
    rate_amount: Decimal
    start_date: date
    end_date: Optional[date]
    is_current: bool
    created_at: date


class WorkerTypeRateHistory(BaseSchema):
    """Schema for worker type rate history."""
    
    worker_type_id: UUID
    worker_type_name: str
    current_rate: Optional[Decimal] = Field(default=None, description="Current rate amount")
    rate_history: list[RateHistory] = Field(description="Historical rates")


class RateEffectiveDate(BaseSchema):
    """Schema for checking rate on a specific date."""
    
    worker_type_id: UUID
    check_date: date
    effective_rate: Optional[Decimal] = Field(default=None, description="Effective rate on the date")
    rate_id: Optional[UUID] = Field(default=None, description="Rate record ID")
    is_active: bool = Field(description="Whether a rate is active on the date")