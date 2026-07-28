"""Schemas for non-labor forecast plans and external references."""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field, field_validator

from app.models.nonlabor_plan import (
    NonLaborCostTreatment,
    NonLaborForecastBasis,
    NonLaborFrequency,
    NonLaborOccurrenceSource,
    NonLaborPeriodPlacement,
    NonLaborPlanMethod,
    NonLaborPlanStatus,
)

from .base import BaseSchema, TimestampMixin, VersionedSchema


class ExternalReferenceTypeCreate(BaseSchema):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=1000)


class ExternalReferenceTypeUpdate(VersionedSchema):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(
        default=None, min_length=1, max_length=1000
    )
    is_active: Optional[bool] = None


class ExternalReferenceTypeResponse(
    ExternalReferenceTypeCreate,
    TimestampMixin,
    VersionedSchema,
):
    is_active: bool
    reference_count: int = 0


class ExternalReferenceInput(BaseSchema):
    reference_type_id: UUID
    value: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9]+$")

    @field_validator("value")
    @classmethod
    def validate_alphanumeric(cls, value: str) -> str:
        if not value.isalnum() or not value.isascii():
            raise ValueError(
                "Reference values must contain only ASCII letters and numbers"
            )
        return value


class ExternalReferenceResponse(TimestampMixin, VersionedSchema):
    reference_type_id: UUID
    reference_type_name: str
    value: str


class NonLaborOccurrenceInput(BaseSchema):
    occurrence_date: date
    amount: Decimal = Field(ge=0)


class NonLaborPlanDefinition(BaseSchema):
    method: NonLaborPlanMethod
    total_amount: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )
    schedule_start: Optional[date] = None
    schedule_end: Optional[date] = None
    frequency: Optional[NonLaborFrequency] = None
    period_placement: Optional[NonLaborPeriodPlacement] = None
    manual_occurrences: List[NonLaborOccurrenceInput] = Field(
        default_factory=list
    )


class NonLaborPlanPreviewRequest(NonLaborPlanDefinition):
    project_id: Optional[UUID] = None


class NonLaborPlanOccurrenceResponse(TimestampMixin, VersionedSchema):
    occurrence_date: date
    base_amount: Decimal
    override_amount: Optional[Decimal]
    effective_amount: Decimal
    source: NonLaborOccurrenceSource


class NonLaborPlanPreviewResponse(BaseSchema):
    occurrences: List[NonLaborOccurrenceInput]
    occurrence_count: int
    exact_total: Decimal
    warnings: List[str] = Field(default_factory=list)


class NonLaborPlanLineCreate(NonLaborPlanDefinition):
    project_id: UUID
    resource_id: UUID
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    cost_treatment: NonLaborCostTreatment
    references: List[ExternalReferenceInput] = Field(default_factory=list)


class NonLaborPlanLineUpdate(NonLaborPlanDefinition, VersionedSchema):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    cost_treatment: Optional[NonLaborCostTreatment] = None
    references: Optional[List[ExternalReferenceInput]] = None


class NonLaborPlanLineResponse(TimestampMixin, VersionedSchema):
    project_id: UUID
    project_name: str
    project_start_date: date
    project_end_date: date
    resource_id: UUID
    resource_name: str
    name: str
    description: Optional[str]
    forecast_basis: NonLaborForecastBasis
    method: NonLaborPlanMethod
    cost_treatment: NonLaborCostTreatment
    currency_code: str
    total_amount: Decimal
    schedule_start: Optional[date]
    schedule_end: Optional[date]
    frequency: Optional[NonLaborFrequency]
    period_placement: Optional[NonLaborPeriodPlacement]
    status: NonLaborPlanStatus
    occurrences: List[NonLaborPlanOccurrenceResponse]
    references: List[ExternalReferenceResponse]
    warnings: List[str] = Field(default_factory=list)


class NonLaborOccurrenceOverrideRequest(VersionedSchema):
    amount: Optional[Decimal] = Field(
        default=None,
        ge=0,
    )
