import importlib.util, glob, os

def test_phase_budget_migration_module_exists_and_backfills_into_labor():
    matches = glob.glob(os.path.join(
        os.path.dirname(__file__), "..", "..", "alembic", "versions",
        "*phase_labor_nonlabor_budget*.py"))
    assert matches, "phase budget migration file not found"
    spec = importlib.util.spec_from_file_location("mig", matches[0])
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    assert hasattr(mod, "upgrade") and hasattr(mod, "downgrade")
    src = open(matches[0]).read()
    # backfill maps old capital/expense into the LABOR columns, non-labor = 0
    assert "labor_capital_budget = capital_budget" in src
    assert "labor_expense_budget = expense_budget" in src
    assert "check_budget_sum" in src
