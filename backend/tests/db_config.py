"""
Centralized test database configuration.

This module provides a single source of truth for test database configuration,
ensuring consistency across all test files and supporting both SQLite and PostgreSQL.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base


# Determine which database to use for testing
# Can be overridden with TEST_DATABASE_URL environment variable
TEST_DB_TYPE = os.getenv("TEST_DB_TYPE", "sqlite")  # "sqlite" or "postgresql"

if TEST_DB_TYPE == "postgresql":
    # PostgreSQL test database configuration
    TEST_DATABASE_URL = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/planner_test"
    )
    # PostgreSQL doesn't need check_same_thread
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
else:
    # SQLite test database configuration (default)
    # Use in-memory for unit tests (fast, isolated)
    # Use file-based for integration tests (persistent across requests)
    TEST_DATABASE_URL = os.getenv(
        "TEST_DATABASE_URL",
        "sqlite:///:memory:"
    )
    # SQLite needs check_same_thread=False for testing
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

# Create session factory
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_test_db_url() -> str:
    """Get the test database URL."""
    return TEST_DATABASE_URL


def get_test_engine():
    """Get the test database engine."""
    return engine


def get_test_session():
    """Get a test database session."""
    return TestingSessionLocal()


def create_test_db():
    """Create all tables in the test database."""
    Base.metadata.create_all(bind=engine)


def drop_test_db():
    """Drop all tables from the test database."""
    Base.metadata.drop_all(bind=engine)


def reset_test_db():
    """Reset the test database (drop and recreate all tables)."""
    drop_test_db()
    create_test_db()


# Database compatibility notes:
# 
# 1. UUID/GUID Types:
#    - Our GUID type in app.models.base handles both PostgreSQL UUID and SQLite CHAR(36)
#    - Always use uuid.UUID objects in Python code
#    - The type adapter handles conversion automatically
#
# 2. JSON Types:
#    - Our JSON type in app.models.base handles both PostgreSQL JSONB and SQLite TEXT
#    - Always use Python dicts/lists in code
#    - The type adapter handles serialization automatically
#
# 3. Date/DateTime Types:
#    - Use Python date and datetime objects
#    - Both databases handle these natively
#    - Avoid database-specific date functions in queries
#
# 4. String Types:
#    - Use SQLAlchemy String type with length limits
#    - Both databases handle VARCHAR similarly
#
# 5. Numeric Types:
#    - Use SQLAlchemy Numeric with precision/scale
#    - Use Python Decimal for monetary values
#    - Both databases handle these correctly
#
# 6. Boolean Types:
#    - Use SQLAlchemy Boolean type
#    - Both databases handle these (SQLite uses 0/1)
#
# 7. Constraints:
#    - CheckConstraint works on both databases
#    - ForeignKey works on both databases
#    - UniqueConstraint works on both databases
#
# 8. Transactions:
#    - Both databases support transactions
#    - Always use db.commit() and db.rollback()
#    - SQLite has some limitations with concurrent writes
#
# 9. Query Compatibility:
#    - Avoid database-specific SQL functions
#    - Use SQLAlchemy ORM methods when possible
#    - Test queries on both databases if using raw SQL
#
# 10. Performance Considerations:
#     - SQLite is faster for tests (in-memory)
#     - PostgreSQL is required for production
#     - Use SQLite for unit tests, PostgreSQL for integration tests (optional)
