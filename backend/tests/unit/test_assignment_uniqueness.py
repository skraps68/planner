"""Focused coverage for resource/project/date assignment uniqueness."""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.services.assignment import assignment_service


@pytest.fixture
def assignment_context():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    db: Session = session_factory()

    portfolio = Portfolio(
        id=uuid4(),
        name="Uniqueness Portfolio",
        description="Test portfolio",
        owner="Test Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31),
    )
    program = Program(
        id=uuid4(),
        portfolio_id=portfolio.id,
        name="Uniqueness Program",
        business_sponsor="Sponsor",
        program_manager="Manager",
        technical_lead="Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
    )
    project = Project(
        id=uuid4(),
        program_id=program.id,
        name="Uniqueness Project",
        business_sponsor="Sponsor",
        project_manager="Manager",
        technical_lead="Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="UNIQUE-001",
    )
    resource = Resource(
        id=uuid4(),
        name="Uniqueness Resource",
        resource_type=ResourceType.NON_LABOR,
        description="Test resource",
    )
    db.add_all([portfolio, program, project, resource])
    db.commit()

    yield db, resource, project

    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def create_assignment(
    db: Session,
    resource: Resource,
    project: Project,
    day: int,
):
    return assignment_service.create_assignment(
        db,
        resource_id=resource.id,
        project_id=project.id,
        assignment_date=date(2024, 6, day),
        capital_percentage=Decimal("20"),
        expense_percentage=Decimal("0"),
    )


def test_service_rejects_duplicate_resource_project_date(assignment_context):
    db, resource, project = assignment_context
    create_assignment(db, resource, project, 15)

    with pytest.raises(
        ValueError,
        match="already assigned to this project on 2024-06-15",
    ):
        create_assignment(db, resource, project, 15)


def test_same_pair_on_different_dates_remains_valid(assignment_context):
    db, resource, project = assignment_context

    first = create_assignment(db, resource, project, 15)
    second = create_assignment(db, resource, project, 16)

    assert first.id != second.id


def test_database_rejects_duplicate_assignment_cell(assignment_context):
    db, resource, project = assignment_context
    create_assignment(db, resource, project, 15)

    db.add(ResourceAssignment(
        id=uuid4(),
        resource_id=resource.id,
        project_id=project.id,
        assignment_date=date(2024, 6, 15),
        capital_percentage=Decimal("10"),
        expense_percentage=Decimal("0"),
    ))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_service_translates_database_race_to_clear_error(
    assignment_context,
    monkeypatch,
):
    db, resource, project = assignment_context
    create_assignment(db, resource, project, 15)
    monkeypatch.setattr(
        assignment_service.repository,
        "get_by_resource_project_date",
        lambda *_args, **_kwargs: None,
    )

    with pytest.raises(
        ValueError,
        match="already assigned to this project on 2024-06-15",
    ):
        create_assignment(db, resource, project, 15)
