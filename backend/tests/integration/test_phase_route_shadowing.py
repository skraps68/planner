"""
Regression test: GET /projects/{id}/phases must serve the four-way budget split.

The projects router used to define its own GET /{project_id}/phases with
response_model=List[ProjectPhaseResponse] (deprecated schema, no labor/non-labor
fields). Registered before the phases router, it shadowed phases.py's
list_phases and silently stripped the four budget columns from the response —
the UI then rendered them as $0 while total_budget looked correct.
"""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import deps
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from tests.conftest import TestingSessionLocal


def _mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.username = "testuser"
    user.is_active = True
    return user


@pytest.fixture
def auth_override():
    app.dependency_overrides[deps.get_current_user] = _mock_user
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def project_with_split_phase(client):  # client fixture creates tables + get_db override
    db = TestingSessionLocal()
    try:
        portfolio = Portfolio(
            name=f"Pf-{uuid4().hex[:8]}", description="d", owner="o",
            reporting_start_date=date(2026, 1, 1), reporting_end_date=date(2026, 12, 31),
        )
        db.add(portfolio)
        db.flush()
        program = Program(
            portfolio_id=portfolio.id, name=f"Pg-{uuid4().hex[:8]}",
            description="d", program_manager="pm", business_sponsor="bs",
            technical_lead="tl",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        db.add(program)
        db.flush()
        project = Project(
            program_id=program.id, name=f"Pj-{uuid4().hex[:8]}",
            business_sponsor="bs", project_manager="pm", technical_lead="tl",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}",
        )
        db.add(project)
        db.flush()
        phase = ProjectPhase(
            project_id=project.id, name="Default Phase",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            labor_capital_budget=Decimal("350000.00"),
            labor_expense_budget=Decimal("250000.00"),
            nonlabor_capital_budget=Decimal("0.00"),
            nonlabor_expense_budget=Decimal("0.00"),
            total_budget=Decimal("600000.00"),
        )
        db.add(phase)
        db.commit()
        yield project.id
    finally:
        db.close()


def test_list_phases_serves_four_way_budget_fields(client, auth_override, project_with_split_phase):
    resp = client.get(
        f"/api/v1/projects/{project_with_split_phase}/phases",
        headers={"Authorization": "Bearer fake"},
    )
    assert resp.status_code == 200
    phases = resp.json()
    assert len(phases) == 1
    ph = phases[0]
    # The four-way fields must be present and correct — not stripped by a
    # shadowing route serving the deprecated ProjectPhaseResponse schema.
    assert Decimal(str(ph["labor_capital_budget"])) == Decimal("350000.00")
    assert Decimal(str(ph["labor_expense_budget"])) == Decimal("250000.00")
    assert Decimal(str(ph["nonlabor_capital_budget"])) == Decimal("0.00")
    assert Decimal(str(ph["nonlabor_expense_budget"])) == Decimal("0.00")
    assert Decimal(str(ph["total_budget"])) == Decimal("600000.00")
    # Derived reads stay available for old consumers.
    assert Decimal(str(ph["capital_budget"])) == Decimal("350000.00")
    assert Decimal(str(ph["expense_budget"])) == Decimal("250000.00")
