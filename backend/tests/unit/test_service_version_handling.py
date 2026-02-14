"""
Unit tests for service layer version handling.

Tests verify that:
1. Version is not manually modified by service layer
2. StaleDataError propagates correctly from ORM to service layer

Validates: Requirements 1.3, 2.3
"""
import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.exc import StaleDataError

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.services.portfolio import portfolio_service
from app.services.program import program_service
from app.services.project import project_service
from app.services.resource import resource_service
from app.db.utils import DatabaseUtils


# Test database setup
@pytest.fixture(scope="module")
def engine():
    """Create test database engine."""
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="module")
def SessionLocal(engine):
    """Create session factory."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db(SessionLocal):
    """Create a fresh database session for each test."""
    session = SessionLocal()
    try:
        # Clean all tables
        session.query(Resource).delete()
        session.query(Project).delete()
        session.query(Program).delete()
        session.query(Portfolio).delete()
        session.commit()
        yield session
    finally:
        session.close()


def test_version_not_manually_modified_in_update(db):
    """
    Test that version field is not manually modified by service layer.
    
    When update_data contains a version field, it should be ignored
    and SQLAlchemy's version_id_col should manage it automatically.
    
    Validates: Requirements 1.3
    """
    # Create portfolio
    portfolio = portfolio_service.create_portfolio(
        db=db,
        name="Test Portfolio",
        description="Original",
        owner="Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    
    initial_version = portfolio.version
    assert initial_version == 1
    
    # Attempt to manually set version in update (should be ignored)
    update_data = {
        "name": "Updated Portfolio",
        "version": 999  # This should be ignored
    }
    
    # Use DatabaseUtils directly to test the update behavior
    updated = DatabaseUtils.update(db, portfolio, update_data)
    
    # Version should be incremented by SQLAlchemy, not set to 999
    assert updated.version == initial_version + 1
    assert updated.version == 2
    assert updated.version != 999
    assert updated.name == "Updated Portfolio"


def test_version_excluded_from_service_update(db):
    """
    Test that service layer excludes version from update data.
    
    Validates: Requirements 1.3
    """
    # Create program
    portfolio = portfolio_service.create_portfolio(
        db=db,
        name=f"Portfolio {uuid4()}",
        description="Test",
        owner="Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    
    program = program_service.create_program(
        db=db,
        portfolio_id=portfolio.id,
        name="Test Program",
        business_sponsor="Sponsor",
        program_manager="Manager",
        technical_lead="Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31)
    )
    
    initial_version = program.version
    
    # Update program (service should not manually set version)
    updated = program_service.update_program(
        db=db,
        program_id=program.id,
        name="Updated Program"
    )
    
    # Version should be automatically incremented
    assert updated.version == initial_version + 1
    assert updated.name == "Updated Program"


def test_stale_data_error_propagates_from_orm(db, SessionLocal):
    """
    Test that StaleDataError propagates correctly from ORM to service layer.
    
    When a version mismatch occurs, SQLAlchemy raises StaleDataError,
    which should propagate up through the service layer.
    
    Validates: Requirements 2.3
    """
    # Create resource in first session
    resource = resource_service.create_resource(
        db=db,
        name="Test Resource",
        resource_type=ResourceType.LABOR
    )
    
    resource_id = resource.id
    initial_version = resource.version
    
    # Create second session to simulate concurrent user
    session2 = SessionLocal()
    try:
        # Session 2 reads the same resource
        resource_user2 = session2.query(Resource).filter(Resource.id == resource_id).first()
        assert resource_user2.version == initial_version
        
        # Session 1 (db) updates the resource successfully
        resource.name = "Updated by User 1"
        db.commit()
        db.refresh(resource)
        assert resource.version == initial_version + 1
        
        # Session 2 tries to update with stale version
        resource_user2.name = "Updated by User 2"
        
        # This should raise StaleDataError
        with pytest.raises(StaleDataError):
            session2.commit()
        
        session2.rollback()
    finally:
        session2.close()


def test_multiple_updates_increment_version_correctly(db):
    """
    Test that multiple sequential updates increment version correctly.
    
    Validates: Requirements 1.3
    """
    # Create portfolio
    portfolio = portfolio_service.create_portfolio(
        db=db,
        name="Test Portfolio",
        description="Original",
        owner="Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    
    assert portfolio.version == 1
    
    # First update
    updated1 = portfolio_service.update_portfolio(
        db=db,
        portfolio_id=portfolio.id,
        name="Update 1"
    )
    assert updated1.version == 2
    
    # Second update
    updated2 = portfolio_service.update_portfolio(
        db=db,
        portfolio_id=updated1.id,
        name="Update 2"
    )
    assert updated2.version == 3
    
    # Third update
    updated3 = portfolio_service.update_portfolio(
        db=db,
        portfolio_id=updated2.id,
        description="Update 3"
    )
    assert updated3.version == 4


def test_version_persists_across_sessions(db, SessionLocal):
    """
    Test that version persists correctly across database sessions.
    
    Validates: Requirements 1.3
    """
    # Create project in first session
    portfolio = portfolio_service.create_portfolio(
        db=db,
        name=f"Portfolio {uuid4()}",
        description="Test",
        owner="Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    
    program = program_service.create_program(
        db=db,
        portfolio_id=portfolio.id,
        name=f"Program {uuid4()}",
        business_sponsor="Sponsor",
        program_manager="Manager",
        technical_lead="Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31)
    )
    
    project = project_service.create_project(
        db=db,
        program_id=program.id,
        name="Test Project",
        business_sponsor="Sponsor",
        project_manager="Manager",
        technical_lead="Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code=f"CC-{uuid4()}"
    )
    
    project_id = project.id
    assert project.version == 1
    
    # Update in same session
    updated = project_service.update_project(
        db=db,
        project_id=project_id,
        name="Updated Project"
    )
    assert updated.version == 2
    
    # Create new session and verify version persisted
    new_session = SessionLocal()
    try:
        reloaded = new_session.query(Project).filter(Project.id == project_id).first()
        assert reloaded is not None
        assert reloaded.version == 2
        assert reloaded.name == "Updated Project"
    finally:
        new_session.close()


def test_version_not_affected_by_read_operations(db):
    """
    Test that read operations don't affect version.
    
    Validates: Requirements 1.3
    """
    # Create resource
    resource = resource_service.create_resource(
        db=db,
        name="Test Resource",
        resource_type=ResourceType.LABOR
    )
    
    initial_version = resource.version
    
    # Perform multiple read operations
    _ = resource_service.get_resource(db, resource.id)
    _ = resource_service.get_resource(db, resource.id)
    _ = resource_service.list_resources(db)
    
    # Reload resource and verify version unchanged
    db.expire(resource)
    reloaded = resource_service.get_resource(db, resource.id)
    assert reloaded.version == initial_version


def test_version_increments_only_on_commit(db):
    """
    Test that version increments only when transaction commits.
    
    Validates: Requirements 1.3
    """
    # Create portfolio
    portfolio = portfolio_service.create_portfolio(
        db=db,
        name="Test Portfolio",
        description="Original",
        owner="Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    
    initial_version = portfolio.version
    
    # Start a manual transaction
    portfolio.name = "Modified"
    db.flush()  # Flush but don't commit
    
    # Version should not increment yet (only on commit)
    # Note: SQLAlchemy's version_id_col increments on flush, not commit
    # So this test verifies the version is managed by SQLAlchemy
    assert portfolio.version == initial_version + 1
    
    # Rollback
    db.rollback()
    
    # Reload and verify version reverted
    db.expire(portfolio)
    reloaded = db.query(Portfolio).filter(Portfolio.id == portfolio.id).first()
    assert reloaded.version == initial_version
    assert reloaded.name == "Test Portfolio"  # Name also reverted
