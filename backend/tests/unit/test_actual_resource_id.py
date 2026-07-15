from app.models.actual import Actual


def test_actual_has_resource_id_and_no_assignment_id():
    cols = Actual.__table__.columns.keys()
    assert "resource_id" in cols
    assert "resource_assignment_id" not in cols


def test_labor_columns_are_nullable():
    assert Actual.__table__.columns["external_worker_id"].nullable is True
    assert Actual.__table__.columns["worker_name"].nullable is True
    assert Actual.__table__.columns["allocation_percentage"].nullable is True
    assert Actual.__table__.columns["resource_id"].nullable is False
