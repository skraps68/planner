"""
Pytest configuration and fixtures.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.base import Base
from app.api import deps

# Import centralized test database configuration
from tests.db_config import TEST_DB_TYPE

# Integration tests use file-based SQLite or PostgreSQL
# This allows the database to persist across API requests
if TEST_DB_TYPE == "postgresql":
    SQLALCHEMY_DATABASE_URL = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/planner_test"
    )
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
else:
    # Use file-based SQLite for integration tests (not in-memory)
    SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def db():
    """Create test database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create test client."""
    app.dependency_overrides[deps.get_db] = override_get_db  # Override deps.get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()