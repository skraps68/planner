"""Smoke test: the cost-center migration adds/drops the column as expected."""
from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic" / "versions" / "c0570e17c0de_add_worker_cost_center.py"
)


def test_migration_adds_cost_center_column():
    src = MIGRATION.read_text()
    assert "down_revision = '27f01e1d45e6'" in src
    assert "add_column" in src and "cost_center_code" in src and "workers" in src
    assert "server_default" in src


def test_migration_downgrade_drops_column():
    src = MIGRATION.read_text()
    assert "drop_column" in src and "cost_center_code" in src
