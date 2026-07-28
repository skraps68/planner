"""Non-labor forecast plans, dated occurrences, and external references."""
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID


class NonLaborForecastBasis(str, Enum):
    CASH = "CASH"


class NonLaborPlanMethod(str, Enum):
    MANUAL = "MANUAL"
    STRAIGHT_LINE = "STRAIGHT_LINE"


class NonLaborCostTreatment(str, Enum):
    CAPITAL = "CAPITAL"
    EXPENSE = "EXPENSE"


class NonLaborFrequency(str, Enum):
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class NonLaborPeriodPlacement(str, Enum):
    PERIOD_START = "PERIOD_START"
    PERIOD_END = "PERIOD_END"


class NonLaborPlanStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class NonLaborOccurrenceSource(str, Enum):
    MANUAL = "MANUAL"
    GENERATED = "GENERATED"


class ExternalReferenceType(BaseModel):
    """Admin-managed type for external non-labor identifiers."""

    __tablename__ = "external_reference_types"

    name = Column(String(100), nullable=False, index=True)
    description = Column(String(1000), nullable=False)
    is_active = Column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    references = relationship(
        "ExternalReference", back_populates="reference_type"
    )

    __table_args__ = (UniqueConstraint("name"),)


class ExternalReference(BaseModel):
    """Reusable external identifier with a system-generated internal UUID."""

    __tablename__ = "external_references"

    reference_type_id = Column(
        GUID(),
        ForeignKey("external_reference_types.id"),
        nullable=False,
        index=True,
    )
    value = Column(String(32), nullable=False)
    normalized_value = Column(String(32), nullable=False, index=True)

    reference_type = relationship(
        "ExternalReferenceType", back_populates="references"
    )

    __table_args__ = (
        UniqueConstraint(
            "reference_type_id",
            "normalized_value",
            name="uq_external_reference_type_value",
        ),
    )


class NonLaborPlanLine(BaseModel):
    """A named cash forecast definition for one project/resource pair."""

    __tablename__ = "nonlabor_plan_lines"

    project_id = Column(
        GUID(), ForeignKey("projects.id"), nullable=False, index=True
    )
    resource_id = Column(
        GUID(), ForeignKey("resources.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    forecast_basis = Column(
        SQLEnum(NonLaborForecastBasis),
        nullable=False,
        default=NonLaborForecastBasis.CASH,
    )
    method = Column(SQLEnum(NonLaborPlanMethod), nullable=False)
    cost_treatment = Column(SQLEnum(NonLaborCostTreatment), nullable=False)
    currency_code = Column(
        String(3), nullable=False, default="USD", server_default="USD"
    )
    total_amount = Column(Numeric(19, 4), nullable=False)
    schedule_start = Column(Date, nullable=True)
    schedule_end = Column(Date, nullable=True)
    frequency = Column(SQLEnum(NonLaborFrequency), nullable=True)
    period_placement = Column(SQLEnum(NonLaborPeriodPlacement), nullable=True)
    status = Column(
        SQLEnum(NonLaborPlanStatus),
        nullable=False,
        default=NonLaborPlanStatus.ACTIVE,
    )
    created_by_user_id = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(GUID(), ForeignKey("users.id"), nullable=True)

    project = relationship("Project", back_populates="nonlabor_plan_lines")
    resource = relationship("Resource", back_populates="nonlabor_plan_lines")
    occurrences = relationship(
        "NonLaborPlanOccurrence",
        back_populates="plan_line",
        cascade="all, delete-orphan",
        order_by="NonLaborPlanOccurrence.occurrence_date",
    )
    reference_links = relationship(
        "NonLaborPlanLineReference",
        back_populates="plan_line",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "total_amount >= 0", name="check_nonlabor_plan_total_nonnegative"
        ),
        CheckConstraint(
            "(method = 'MANUAL') OR "
            "(schedule_start IS NOT NULL AND schedule_end IS NOT NULL "
            "AND frequency IS NOT NULL AND period_placement IS NOT NULL)",
            name="check_nonlabor_plan_schedule_fields",
        ),
        CheckConstraint(
            "schedule_start IS NULL OR schedule_end IS NULL OR "
            "schedule_start <= schedule_end",
            name="check_nonlabor_plan_dates",
        ),
    )


class NonLaborPlanOccurrence(BaseModel):
    """One exact dated amount belonging to a non-labor plan line."""

    __tablename__ = "nonlabor_plan_occurrences"

    plan_line_id = Column(
        GUID(),
        ForeignKey("nonlabor_plan_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    occurrence_date = Column(Date, nullable=False, index=True)
    base_amount = Column(Numeric(19, 4), nullable=False)
    override_amount = Column(Numeric(19, 4), nullable=True)
    source = Column(SQLEnum(NonLaborOccurrenceSource), nullable=False)

    plan_line = relationship("NonLaborPlanLine", back_populates="occurrences")

    __table_args__ = (
        CheckConstraint(
            "base_amount >= 0",
            name="check_nonlabor_occurrence_base_nonnegative",
        ),
        CheckConstraint(
            "override_amount IS NULL OR override_amount >= 0",
            name="check_nonlabor_occurrence_override_nonnegative",
        ),
        UniqueConstraint(
            "plan_line_id",
            "occurrence_date",
            name="uq_nonlabor_plan_occurrence_date",
        ),
    )

    @property
    def effective_amount(self):
        return (
            self.override_amount
            if self.override_amount is not None
            else self.base_amount
        )


class ResourceExternalReference(BaseModel):
    """Default external reference associated with a non-labor resource."""

    __tablename__ = "resource_external_references"

    resource_id = Column(
        GUID(),
        ForeignKey("resources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_reference_id = Column(
        GUID(),
        ForeignKey("external_references.id"),
        nullable=False,
        index=True,
    )

    resource = relationship(
        "Resource", back_populates="external_reference_links"
    )
    external_reference = relationship("ExternalReference")

    __table_args__ = (
        UniqueConstraint(
            "resource_id",
            "external_reference_id",
            name="uq_resource_external_reference",
        ),
    )


class NonLaborPlanLineReference(BaseModel):
    """External reference attached to a specific non-labor plan line."""

    __tablename__ = "nonlabor_plan_line_references"

    plan_line_id = Column(
        GUID(),
        ForeignKey("nonlabor_plan_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_reference_id = Column(
        GUID(),
        ForeignKey("external_references.id"),
        nullable=False,
        index=True,
    )

    plan_line = relationship(
        "NonLaborPlanLine", back_populates="reference_links"
    )
    external_reference = relationship("ExternalReference")

    __table_args__ = (
        UniqueConstraint(
            "plan_line_id",
            "external_reference_id",
            name="uq_nonlabor_plan_line_reference",
        ),
    )
