"""Create-path integration: new entities receive typed business ids."""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.business_id import BusinessIdConfig
from app.services.portfolio import portfolio_service


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


def test_created_portfolio_gets_business_id(db):
    p = portfolio_service.create_portfolio(
        db,
        name="P1",
        description="d",
        owner="o",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    assert p.business_id == "010000001"

    p2 = portfolio_service.create_portfolio(
        db,
        name="P2",
        description="d",
        owner="o",
        reporting_start_date=date(2026, 1, 1),
        reporting_end_date=date(2026, 12, 31),
    )
    assert p2.business_id == "010000002"
