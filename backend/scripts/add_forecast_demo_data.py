"""
Seed forecast demo data so the financials graphs show both Actuals and Forecast.

Forecast is derived from resource assignments dated AFTER the report's as-of date
(today). The base seed data only contains historical (past) assignments, so with a
current clock the forecast portion is always zero. This script adds future-dated
assignments (and widens the target projects/phases to cover them) for a couple of
projects that already have historical actuals, giving a clear Budget vs
Actuals + Forecast picture.

Idempotent: it first removes any assignments it previously added (those dated after
today for the target projects), then re-adds a fresh window starting tomorrow.

Run:  docker-compose exec app python scripts/add_forecast_demo_data.py
"""
import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource
from app.models.resource_assignment import ResourceAssignment

# Projects to enrich (must already exist from the base seed) and the labor
# resources to assign, with a capital/expense split per resource.
TARGETS = {
    "Mobile Application Development": [
        ("John Smith", Decimal("60.00"), Decimal("20.00")),
        ("Bob Johnson", Decimal("50.00"), Decimal("30.00")),
        ("Charlie Brown", Decimal("30.00"), Decimal("50.00")),
    ],
    "Web Portal Redesign": [
        ("Jane Doe", Decimal("70.00"), Decimal("20.00")),
        ("Alice Williams", Decimal("40.00"), Decimal("40.00")),
    ],
}

FORECAST_DAYS = 120  # length of the future assignment window

# Phase budget overrides (capital, expense) applied after seeding so the demo data
# shows both variance polarities: Mobile App stays under budget (positive variance),
# Web Portal is squeezed below its actuals + forecast (negative variance).
PHASE_BUDGET_OVERRIDES = {
    "Web Portal Redesign": (Decimal("55000.00"), Decimal("45000.00")),
}


def add_forecast_demo_data():
    db = SessionLocal()
    try:
        today = date.today()
        window_start = today + timedelta(days=1)
        window_end = today + timedelta(days=FORECAST_DAYS)
        print(f"Today is {today}. Adding forecast window {window_start} .. {window_end}")

        total_added = 0
        for project_name, resource_specs in TARGETS.items():
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                print(f"  SKIP: project '{project_name}' not found")
                continue

            # Idempotency: drop any future assignments previously added for this project
            removed = (
                db.query(ResourceAssignment)
                .filter(
                    ResourceAssignment.project_id == project.id,
                    ResourceAssignment.assignment_date > today,
                )
                .delete(synchronize_session=False)
            )
            if removed:
                print(f"  {project_name}: removed {removed} existing future assignment(s)")

            # Widen the project so the future window falls inside its span
            if project.end_date < window_end:
                project.end_date = window_end

            # Extend the latest phase to cover the window so phase-level forecast works too
            last_phase = (
                db.query(ProjectPhase)
                .filter(ProjectPhase.project_id == project.id)
                .order_by(ProjectPhase.end_date.desc())
                .first()
            )
            if last_phase and last_phase.end_date < window_end:
                last_phase.end_date = window_end

            # Resolve resources by name
            resources = []
            for name, cap, exp in resource_specs:
                res = db.query(Resource).filter(Resource.name == name).first()
                if res:
                    resources.append((res, cap, exp))
                else:
                    print(f"    WARN: resource '{name}' not found; skipping")

            if not resources:
                print(f"  {project_name}: no resolvable resources; skipping")
                continue

            added = 0
            for i in range(FORECAST_DAYS):
                assignment_date = window_start + timedelta(days=i)
                for res, cap, exp in resources:
                    db.add(
                        ResourceAssignment(
                            id=uuid4(),
                            resource_id=res.id,
                            project_id=project.id,
                            assignment_date=assignment_date,
                            capital_percentage=cap,
                            expense_percentage=exp,
                        )
                    )
                    added += 1

            total_added += added
            print(
                f"  {project_name}: added {added} future assignment(s) "
                f"for {len(resources)} resource(s); project end -> {project.end_date}"
            )

            # Apply budget override so this project lands over budget (negative variance)
            override = PHASE_BUDGET_OVERRIDES.get(project_name)
            if override:
                cap, exp = override
                phases = db.query(ProjectPhase).filter(ProjectPhase.project_id == project.id).all()
                for idx, phase in enumerate(phases):
                    # Put the full override on the first phase, zero the rest
                    phase.capital_budget = cap if idx == 0 else Decimal("0.00")
                    phase.expense_budget = exp if idx == 0 else Decimal("0.00")
                    phase.total_budget = phase.capital_budget + phase.expense_budget
                print(f"  {project_name}: phase budgets overridden to {cap + exp} total")

        db.commit()
        print(f"Done. Added {total_added} future assignment(s) total.")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    add_forecast_demo_data()
