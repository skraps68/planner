import glob
import os


def test_actual_resource_id_migration_backfills_via_worker():
    matches = glob.glob(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "alembic",
            "versions",
            "*actual_resource_id*.py",
        )
    )
    assert matches, "actual resource_id migration not found"
    src = open(matches[0]).read()
    assert "resource_id" in src
    assert "workers" in src and "external_id" in src  # backfill path
    assert "resource_assignment_id" in src  # drop it
