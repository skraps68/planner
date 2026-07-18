import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from app.models.base import Base
from app.models.resource import Resource, ResourceRole, ResourceType


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine)()


def test_resource_role_unique_name(db):
    db.add(ResourceRole(name="Engineer")); db.flush()
    db.add(ResourceRole(name="Engineer"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_labor_requires_role_check(db):
    role = ResourceRole(name="Engineer"); db.add(role); db.flush()
    # non-labor with a role -> rejected
    db.add(Resource(name="NL", resource_type=ResourceType.NON_LABOR, resource_role_id=role.id))
    with pytest.raises(IntegrityError):
        db.flush()
