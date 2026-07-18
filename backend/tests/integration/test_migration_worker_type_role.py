import glob, os


def test_refactor_migration_exists_and_transforms():
    matches = glob.glob(os.path.join(os.path.dirname(__file__), "..", "..",
        "alembic", "versions", "*worker_type_resource_role*.py"))
    assert matches, "refactor migration not found"
    src = open(matches[0]).read()
    assert "resource_roles" in src
    assert "resource_role_id" in src
    assert "Employee" in src and "Fixed Price Contractor" in src
    assert "Default" in src
    assert "ck_resources_labor_role" in src
