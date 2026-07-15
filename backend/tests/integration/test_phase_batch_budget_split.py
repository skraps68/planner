"""Integration test: phase service batch update persists four-way budgets."""
from decimal import Decimal
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.services.phase_service import phase_service


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def _project(db):
    """Build real chain: Portfolio -> Program -> Project (Project.program_id is NOT NULL)."""
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

    p = Project(
        program_id=program.id,
        name="P",
        business_sponsor="s",
        project_manager="m",
        technical_lead="t",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        cost_center_code="CC-BATCH-SPLIT",
    )
    db.add(p)
    db.flush()
    return p


def test_batch_update_persists_four_budget_fields(db_session):
    project = _project(db_session)
    phases = [{
        "id": None, "name": "Only", "start_date": date(2026, 1, 1), "end_date": date(2026, 12, 31),
        "description": None,
        "labor_capital_budget": Decimal("100"), "labor_expense_budget": Decimal("50"),
        "nonlabor_capital_budget": Decimal("30"), "nonlabor_expense_budget": Decimal("20"),
        "total_budget": Decimal("200"),
    }]
    result = phase_service.update_project_phases(db_session, project.id, phases)
    assert len(result) == 1
    p = result[0]
    assert p.labor_capital_budget == Decimal("100")
    assert p.nonlabor_expense_budget == Decimal("20")
    assert p.capital_budget == Decimal("130")   # derived hybrid
    assert p.total_budget == Decimal("200")
