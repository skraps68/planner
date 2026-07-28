"""Service-level coverage for the non-labor plan lifecycle."""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.nonlabor_plan import (
    ExternalReferenceType,
    NonLaborCostTreatment,
    NonLaborFrequency,
    NonLaborPeriodPlacement,
    NonLaborPlanMethod,
    NonLaborPlanStatus,
)
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.schemas.nonlabor_plan import (
    ExternalReferenceInput,
    NonLaborPlanLineCreate,
    NonLaborPlanLineUpdate,
)
from app.services.nonlabor_plan import nonlabor_plan_service
from app.services.resource import resource_service
from app.services.scope_validator import scope_validator_service


@pytest.fixture()
def nonlabor_context(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    db: Session = session_factory()

    portfolio = Portfolio(
        name="Non-labor Portfolio",
        description="Test portfolio",
        owner="Owner",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    db.add(portfolio)
    db.flush()
    program = Program(
        portfolio_id=portfolio.id,
        name="Non-labor Program",
        business_sponsor="Sponsor",
        program_manager="Manager",
        technical_lead="Lead",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(program)
    db.flush()
    project = Project(
        program_id=program.id,
        name="Non-labor Project",
        business_sponsor="Sponsor",
        project_manager="Manager",
        technical_lead="Lead",
        start_date=date(2026, 1, 15),
        end_date=date(2026, 12, 15),
        cost_center_code="NONLABOR-PLAN",
    )
    resource = Resource(
        name="Software Subscription",
        resource_type=ResourceType.NON_LABOR,
        description="External software cost",
    )
    reference_type = ExternalReferenceType(
        name="Contract ID",
        description="Contract identifier",
    )
    db.add_all([project, resource, reference_type])
    db.commit()

    monkeypatch.setattr(
        scope_validator_service,
        "can_access_project",
        lambda *_args, **_kwargs: True,
    )
    monkeypatch.setattr(
        scope_validator_service,
        "get_user_accessible_projects",
        lambda *_args, **_kwargs: [project.id],
    )

    yield db, project, resource, reference_type, uuid4()

    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _create_input(project, resource, reference_type):
    return NonLaborPlanLineCreate(
        project_id=project.id,
        resource_id=resource.id,
        name="Annual license",
        description="Paid monthly",
        cost_treatment=NonLaborCostTreatment.EXPENSE,
        method=NonLaborPlanMethod.STRAIGHT_LINE,
        total_amount=Decimal("100.00"),
        schedule_start=date(2026, 1, 1),
        schedule_end=date(2026, 3, 10),
        frequency=NonLaborFrequency.MONTHLY,
        period_placement=NonLaborPeriodPlacement.PERIOD_END,
        references=[
            ExternalReferenceInput(
                reference_type_id=reference_type.id,
                value="contract123",
            )
        ],
    )


def test_create_list_and_timeline_warning(nonlabor_context):
    db, project, resource, reference_type, user_id = nonlabor_context

    plan = nonlabor_plan_service.create(
        db,
        _create_input(project, resource, reference_type),
        user_id,
    )

    assert plan.total_amount == Decimal("100.0000")
    assert [item.occurrence_date for item in plan.occurrences] == [
        date(2026, 1, 31),
        date(2026, 2, 28),
        date(2026, 3, 10),
    ]
    assert (
        plan.reference_links[0].external_reference.normalized_value
        == "CONTRACT123"
    )
    assert nonlabor_plan_service.timeline_warnings(
        project,
        [
            type("Occurrence", (), {"occurrence_date": date(2026, 1, 1)})(),
            type("Occurrence", (), {"occurrence_date": date(2027, 1, 1)})(),
        ],
    ) == [
        "One or more cash flows occur before the project start date "
        "(Project date range: 2026-01-15 to 2026-12-15).",
        "One or more cash flows occur after the project end date "
        "(Project date range: 2026-01-15 to 2026-12-15).",
    ]

    listed = nonlabor_plan_service.list(
        db,
        user_id,
        project_id=project.id,
    )
    assert [item.id for item in listed] == [plan.id]


def test_create_rejects_duplicate_external_references(nonlabor_context):
    db, project, resource, reference_type, user_id = nonlabor_context
    plan_input = _create_input(project, resource, reference_type)
    plan_input.references.append(
        ExternalReferenceInput(
            reference_type_id=reference_type.id,
            value="CONTRACT123",
        )
    )

    with pytest.raises(ValueError, match="same external reference twice"):
        nonlabor_plan_service.create(db, plan_input, user_id)

    db.rollback()


def test_update_preserves_generated_override_and_reuses_reference(
    nonlabor_context,
):
    db, project, resource, reference_type, user_id = nonlabor_context
    plan = nonlabor_plan_service.create(
        db,
        _create_input(project, resource, reference_type),
        user_id,
    )
    february = next(
        item
        for item in plan.occurrences
        if item.occurrence_date == date(2026, 2, 28)
    )
    plan = nonlabor_plan_service.set_override(
        db,
        plan.id,
        february.id,
        Decimal("50"),
        plan.version,
        user_id,
    )

    updated = nonlabor_plan_service.update(
        db,
        plan.id,
        NonLaborPlanLineUpdate(
            version=plan.version,
            name="Revised annual license",
            description="Revised schedule",
            cost_treatment=NonLaborCostTreatment.CAPITAL,
            method=NonLaborPlanMethod.STRAIGHT_LINE,
            total_amount=Decimal("120"),
            schedule_start=date(2026, 1, 1),
            schedule_end=date(2026, 3, 10),
            frequency=NonLaborFrequency.MONTHLY,
            period_placement=NonLaborPeriodPlacement.PERIOD_END,
            references=[
                ExternalReferenceInput(
                    reference_type_id=reference_type.id,
                    value="CONTRACT123",
                )
            ],
        ),
        user_id,
    )

    retained = next(
        item
        for item in updated.occurrences
        if item.occurrence_date == date(2026, 2, 28)
    )
    assert retained.base_amount == Decimal("40.0000")
    assert retained.override_amount == Decimal("50.0000")
    assert retained.effective_amount == Decimal("50.0000")
    assert updated.name == "Revised annual license"
    assert updated.cost_treatment == NonLaborCostTreatment.CAPITAL
    assert db.query(ExternalReferenceType).count() == 1


def test_cancel_excludes_plan_from_active_list(nonlabor_context):
    db, project, resource, reference_type, user_id = nonlabor_context
    plan = nonlabor_plan_service.create(
        db,
        _create_input(project, resource, reference_type),
        user_id,
    )

    cancelled = nonlabor_plan_service.cancel(
        db,
        plan.id,
        plan.version,
        user_id,
    )

    assert cancelled.status == NonLaborPlanStatus.CANCELLED
    assert (
        nonlabor_plan_service.list(
            db,
            user_id,
            project_id=project.id,
        )
        == []
    )
    assert (
        nonlabor_plan_service.list(
            db,
            user_id,
            project_id=project.id,
            include_cancelled=True,
        )[0].id
        == plan.id
    )


def test_update_detects_stale_version(nonlabor_context):
    db, project, resource, reference_type, user_id = nonlabor_context
    plan = nonlabor_plan_service.create(
        db,
        _create_input(project, resource, reference_type),
        user_id,
    )

    with pytest.raises(RuntimeError, match="changed by another user"):
        nonlabor_plan_service.update(
            db,
            plan.id,
            NonLaborPlanLineUpdate(
                version=plan.version + 1,
                method=NonLaborPlanMethod.MANUAL,
                manual_occurrences=[],
            ),
            user_id,
        )


def test_nonlabor_resource_default_references_can_be_replaced(
    nonlabor_context,
):
    db, _project, resource, reference_type, _user_id = nonlabor_context

    updated = resource_service.update_resource(
        db,
        resource.id,
        external_references=[
            ExternalReferenceInput(
                reference_type_id=reference_type.id,
                value="RESOURCE123",
            )
        ],
    )

    assert len(updated.external_reference_links) == 1
    reference = updated.external_reference_links[0].external_reference
    assert reference.value == "RESOURCE123"
    assert reference.normalized_value == "RESOURCE123"

    cleared = resource_service.update_resource(
        db,
        resource.id,
        external_references=[],
    )
    assert cleared.external_reference_links == []
