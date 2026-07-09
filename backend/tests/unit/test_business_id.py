"""Unit tests for the business-id allocator."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.business_id import BusinessIdConfig
from app.services.business_id import allocate_business_id


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    session.add_all([
        BusinessIdConfig(entity_type="portfolio", base_id=10000000, next_sequence=1),
        BusinessIdConfig(entity_type="program", base_id=20000000, next_sequence=1),
        BusinessIdConfig(entity_type="project", base_id=30000000, next_sequence=1),
    ])
    session.commit()
    yield session
    session.close()


def test_first_ids_are_typed_and_zero_padded(db):
    assert allocate_business_id(db, "portfolio") == "010000001"
    assert allocate_business_id(db, "program") == "020000001"
    assert allocate_business_id(db, "project") == "030000001"


def test_sequences_increment_independently(db):
    assert allocate_business_id(db, "portfolio") == "010000001"
    assert allocate_business_id(db, "portfolio") == "010000002"
    assert allocate_business_id(db, "program") == "020000001"
    assert allocate_business_id(db, "portfolio") == "010000003"


def test_result_is_string_of_length_nine(db):
    bid = allocate_business_id(db, "portfolio")
    assert isinstance(bid, str) and len(bid) == 9
    assert bid.startswith("0")  # leading zero preserved


def test_unknown_entity_type_raises(db):
    with pytest.raises(ValueError):
        allocate_business_id(db, "widget")


def test_base_change_affects_future_ids_only(db):
    first = allocate_business_id(db, "portfolio")
    cfg = db.query(BusinessIdConfig).filter_by(entity_type="portfolio").one()
    cfg.base_id = 90000000
    db.flush()
    second = allocate_business_id(db, "portfolio")
    assert first == "010000001"
    assert second == "090000002"  # new base + continuing sequence
