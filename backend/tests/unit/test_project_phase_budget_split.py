"""Test ProjectPhase budget split into labor/non-labor with derived hybrids."""
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project, ProjectPhase


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def _make_project(db):
    """Build real chain: Portfolio -> Program -> Project."""
    portfolio = Portfolio(
        name="P1",
        description="Test portfolio",
        owner="owner",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    db.add(portfolio)
    db.flush()

    program = Program(
        portfolio_id=portfolio.id,
        name="Prog1",
        business_sponsor="sponsor",
        program_manager="manager",
        technical_lead="lead",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(program)
    db.flush()

    project = Project(
        program_id=program.id,
        name="P",
        business_sponsor="s",
        project_manager="m",
        technical_lead="t",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        cost_center_code="CC-PHASE-SPLIT",
    )
    db.add(project)
    db.flush()
    return project


def test_phase_four_budget_columns_and_derived_hybrids(db_session):
    project = _make_project(db_session)
    phase = ProjectPhase(
        project_id=project.id,
        name="Ph",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 6, 30),
        labor_capital_budget=Decimal("100.00"),
        labor_expense_budget=Decimal("50.00"),
        nonlabor_capital_budget=Decimal("30.00"),
        nonlabor_expense_budget=Decimal("20.00"),
        total_budget=Decimal("200.00"),
    )
    db_session.add(phase)
    db_session.flush()
    assert phase.capital_budget == Decimal("130.00")   # 100 + 30
    assert phase.expense_budget == Decimal("70.00")     # 50 + 20


def test_phase_budget_sum_constraint_rejects_mismatch(db_session):
    project = _make_project(db_session)
    phase = ProjectPhase(
        project_id=project.id,
        name="Ph",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 6, 30),
        labor_capital_budget=Decimal("100.00"),
        labor_expense_budget=Decimal("50.00"),
        nonlabor_capital_budget=Decimal("30.00"),
        nonlabor_expense_budget=Decimal("20.00"),
        total_budget=Decimal("999.00"),  # != 200
    )
    db_session.add(phase)
    with pytest.raises(IntegrityError):
        db_session.flush()
