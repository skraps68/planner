from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.exceptions import ValidationError
from app.models.actual import Actual
from app.models.base import Base
from app.models.nonlabor_plan import (
    NonLaborCostTreatment,
    NonLaborForecastBasis,
    NonLaborOccurrenceSource,
    NonLaborPlanLine,
    NonLaborPlanMethod,
    NonLaborPlanOccurrence,
    NonLaborPlanStatus,
)
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.services.project import project_service


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def create_project_graph(db):
    portfolio = Portfolio(
        name="Portfolio",
        description="Test",
        owner="Owner",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2027, 12, 31),
    )
    program = Program(
        portfolio=portfolio,
        name="Program",
        business_sponsor="Sponsor",
        program_manager="Manager",
        technical_lead="Lead",
        start_date=date(2026, 1, 1),
        end_date=date(2027, 12, 31),
    )
    project = Project(
        program=program,
        name="Project",
        business_sponsor="Sponsor",
        project_manager="Manager",
        technical_lead="Lead",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        cost_center_code="CC-DATE-CHECK",
        currency_code="USD",
    )
    project.phases.extend([
        ProjectPhase(
            name="Design",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            labor_capital_budget=Decimal("0"),
            labor_expense_budget=Decimal("0"),
            nonlabor_capital_budget=Decimal("0"),
            nonlabor_expense_budget=Decimal("0"),
            total_budget=Decimal("0"),
        ),
        ProjectPhase(
            name="Build",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            labor_capital_budget=Decimal("0"),
            labor_expense_budget=Decimal("0"),
            nonlabor_capital_budget=Decimal("0"),
            nonlabor_expense_budget=Decimal("0"),
            total_budget=Decimal("0"),
        ),
    ])
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def constraint(preview, constraint_id):
    return next(item for item in preview["constraints"] if item["id"] == constraint_id)


def test_preview_reports_phase_conflict_without_mutating_dates(db):
    project = create_project_graph(db)

    preview = project_service.preview_date_change(
        db,
        project.id,
        proposed_start=date(2026, 1, 1),
        proposed_end=date(2026, 5, 31),
    )

    assert preview["can_proceed"] is False
    assert constraint(preview, "phase_timeline")["status"] == "fail"
    assert project.end_date == date(2026, 12, 31)
    assert project.phases[-1].end_date == date(2026, 12, 31)


def test_preview_reports_labor_cost_plan_and_actual_conflicts(db):
    project = create_project_graph(db)
    resource = Resource(
        name="Cloud service",
        resource_type=ResourceType.NON_LABOR,
    )
    db.add(resource)
    db.flush()
    db.add(ResourceAssignment(
        project_id=project.id,
        resource_id=resource.id,
        assignment_date=date(2026, 11, 1),
        capital_percentage=Decimal("0"),
        expense_percentage=Decimal("50"),
    ))
    plan_line = NonLaborPlanLine(
        project_id=project.id,
        resource_id=resource.id,
        name="Subscription",
        forecast_basis=NonLaborForecastBasis.CASH,
        method=NonLaborPlanMethod.MANUAL,
        cost_treatment=NonLaborCostTreatment.EXPENSE,
        currency_code="USD",
        total_amount=Decimal("250"),
        status=NonLaborPlanStatus.ACTIVE,
    )
    plan_line.occurrences.append(NonLaborPlanOccurrence(
        occurrence_date=date(2026, 10, 1),
        base_amount=Decimal("250"),
        source=NonLaborOccurrenceSource.MANUAL,
    ))
    db.add(plan_line)
    db.add(Actual(
        project_id=project.id,
        resource_id=resource.id,
        actual_date=date(2026, 9, 1),
        allocation_percentage=None,
        actual_cost=Decimal("100"),
        capital_amount=Decimal("0"),
        expense_amount=Decimal("100"),
    ))
    db.commit()

    preview = project_service.preview_date_change(
        db,
        project.id,
        proposed_start=date(2026, 1, 1),
        proposed_end=date(2026, 8, 31),
    )

    assert constraint(preview, "labor_assignments")["status"] == "fail"
    assert constraint(preview, "nonlabor_cost_plans")["details"]["outside_amount"] == "250.0000"
    assert constraint(preview, "actuals")["status"] == "fail"


def test_update_revalidates_and_rejects_before_any_write(db):
    project = create_project_graph(db)

    with pytest.raises(ValidationError) as exc_info:
        project_service.update_project(
            db,
            project.id,
            end_date=date(2026, 5, 31),
        )

    assert exc_info.value.error_code == "PROJECT_DATE_CONSTRAINTS"
    db.refresh(project)
    assert project.end_date == date(2026, 12, 31)
    assert project.phases[-1].end_date == date(2026, 12, 31)

