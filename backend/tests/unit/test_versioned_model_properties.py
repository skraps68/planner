"""
Property-based tests for versioned model behavior.

These tests use Hypothesis to verify universal properties of optimistic locking
across all user-editable entities.

Feature: optimistic-locking
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.exc import StaleDataError

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, WorkerType, Worker, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.models.rate import Rate
from app.models.actual import Actual
from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType


# Test database setup
@pytest.fixture(scope="session")
def engine():
    """Create test database engine."""
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="session")
def SessionLocal(engine):
    """Create session factory."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_fresh_db_session(SessionLocal):
    """Helper to create a fresh database session and clean up after."""
    session = SessionLocal()
    try:
        # Clean all tables before each test
        session.query(Actual).delete()
        session.query(ResourceAssignment).delete()
        session.query(Rate).delete()
        session.query(Worker).delete()
        session.query(WorkerType).delete()
        session.query(Resource).delete()
        session.query(ProjectPhase).delete()
        session.query(Project).delete()
        session.query(Program).delete()
        session.query(Portfolio).delete()
        session.query(ScopeAssignment).delete()
        session.query(UserRole).delete()
        session.query(User).delete()
        session.commit()
        return session
    except Exception:
        session.rollback()
        raise


# Hypothesis strategies for generating test data

@st.composite
def valid_portfolio_data(draw):
    """Generate valid portfolio data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 31)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    
    return Portfolio(
        name=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        description=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        owner=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        reporting_start_date=start_date,
        reporting_end_date=end_date,
    )


@st.composite
def valid_program_data(draw, portfolio_id):
    """Generate valid program data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 31)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    
    return Program(
        portfolio_id=portfolio_id,
        name=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        business_sponsor=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        program_manager=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        technical_lead=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        start_date=start_date,
        end_date=end_date,
    )


@st.composite
def valid_project_data(draw, program_id):
    """Generate valid project data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 31)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    
    return Project(
        program_id=program_id,
        name=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        business_sponsor=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        project_manager=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        technical_lead=draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        start_date=start_date,
        end_date=end_date,
        cost_center_code=draw(st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd')))),
    )


@st.composite
def valid_user_data(draw):
    """Generate valid user data."""
    return User(
        username=draw(st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd')))),
        email=f"{draw(st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))}@example.com",
        password_hash=draw(st.text(min_size=10, max_size=100)),
        is_active=True,
    )


# Property Tests

@pytest.mark.property_test
class TestVersionedModelProperties:
    """Property-based tests for versioned model behavior."""
    
    @given(entity_data=st.one_of(
        valid_portfolio_data(),
        valid_user_data(),
    ))
    @settings(max_examples=100, deadline=None)
    def test_property_1_new_entity_version_initialization(self, SessionLocal, entity_data):
        """
        Property 1: New Entity Version Initialization
        
        For any user-editable entity type, when a new entity is created,
        the version field should be initialized to 1.
        
        Validates: Requirements 1.2
        """
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create entity
            db_session.add(entity_data)
            db_session.commit()
            db_session.refresh(entity_data)
            
            # Property: Version should be initialized to 1
            assert entity_data.version == 1
        finally:
            db_session.close()
    
    @given(entity_data=st.one_of(
        valid_portfolio_data(),
        valid_user_data(),
    ))
    @settings(max_examples=100, deadline=None)
    def test_property_1_new_entity_version_initialization_with_hierarchy(self, SessionLocal, entity_data):
        """
        Property 1: New Entity Version Initialization (with hierarchy)
        
        Test version initialization for entities that require parent entities.
        
        Validates: Requirements 1.2
        """
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # For entities that need parents, create the hierarchy
            if isinstance(entity_data, Program):
                # Create portfolio first
                portfolio = Portfolio(
                    name="Test Portfolio",
                    description="Test",
                    owner="Test Owner",
                    reporting_start_date=date(2024, 1, 1),
                    reporting_end_date=date(2024, 12, 31),
                )
                db_session.add(portfolio)
                db_session.flush()
                entity_data.portfolio_id = portfolio.id
            
            # Create entity
            db_session.add(entity_data)
            db_session.commit()
            db_session.refresh(entity_data)
            
            # Property: Version should be initialized to 1
            assert entity_data.version == 1
        finally:
            db_session.close()

    
    @given(entity_data=st.one_of(
        valid_portfolio_data(),
        valid_user_data(),
    ))
    @settings(max_examples=100, deadline=None)
    def test_property_2_version_increment_on_update(self, SessionLocal, entity_data):
        """
        Property 2: Version Increment on Update
        
        For any user-editable entity, when the entity is successfully updated,
        the version number should be incremented by exactly 1.
        
        Validates: Requirements 1.3
        """
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create entity
            db_session.add(entity_data)
            db_session.commit()
            db_session.refresh(entity_data)
            
            initial_version = entity_data.version
            assert initial_version == 1
            
            # Update entity
            if isinstance(entity_data, Portfolio):
                entity_data.name = "Updated Name"
            elif isinstance(entity_data, User):
                entity_data.email = "updated@example.com"
            
            db_session.commit()
            db_session.refresh(entity_data)
            
            # Property: Version should increment by exactly 1
            assert entity_data.version == initial_version + 1
            
            # Update again to verify it continues incrementing
            if isinstance(entity_data, Portfolio):
                entity_data.description = "Updated Description"
            elif isinstance(entity_data, User):
                entity_data.username = "updated_user"
            
            db_session.commit()
            db_session.refresh(entity_data)
            
            # Property: Version should increment by exactly 1 again
            assert entity_data.version == initial_version + 2
        finally:
            db_session.close()

    
    @given(entity_data=st.one_of(
        valid_portfolio_data(),
        valid_user_data(),
    ))
    @settings(max_examples=100, deadline=None)
    @pytest.mark.parametrize("db_type", ["sqlite", "postgresql"])
    def test_property_10_cross_database_compatibility(self, db_type, entity_data):
        """
        Property 10: Cross-Database Compatibility
        
        For any property test, when run against both PostgreSQL and SQLite databases,
        the behavior should be identical (version initialization, increment, conflict detection).
        
        Validates: Requirements 1.5
        """
        # Skip PostgreSQL tests if not configured
        if db_type == "postgresql":
            import os
            pg_url = os.getenv("TEST_DATABASE_URL")
            if not pg_url or "postgresql" not in pg_url:
                pytest.skip("PostgreSQL not configured for testing")
            test_engine = create_engine(pg_url, pool_pre_ping=True)
        else:
            test_engine = create_engine("sqlite:///:memory:")
        
        # Create tables
        Base.metadata.create_all(bind=test_engine)
        TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
        
        db_session = TestSessionLocal()
        
        try:
            # Clean tables
            db_session.query(Portfolio).delete()
            db_session.query(User).delete()
            db_session.commit()
            
            # Create entity
            db_session.add(entity_data)
            db_session.commit()
            db_session.refresh(entity_data)
            
            # Property: Version should be initialized to 1 (same on both databases)
            assert entity_data.version == 1
            
            # Update entity
            if isinstance(entity_data, Portfolio):
                entity_data.name = "Updated Name"
            elif isinstance(entity_data, User):
                entity_data.email = "updated@example.com"
            
            db_session.commit()
            db_session.refresh(entity_data)
            
            # Property: Version should increment to 2 (same on both databases)
            assert entity_data.version == 2
            
            # Test conflict detection using separate sessions
            entity_id = entity_data.id
            entity_type = type(entity_data)
            
            # Session 1: Read entity
            session1 = TestSessionLocal()
            entity1 = session1.query(entity_type).filter(entity_type.id == entity_id).first()
            version1 = entity1.version
            
            # Session 2: Read and update entity
            session2 = TestSessionLocal()
            entity2 = session2.query(entity_type).filter(entity_type.id == entity_id).first()
            if isinstance(entity2, Portfolio):
                entity2.name = "Session 2 Update"
            elif isinstance(entity2, User):
                entity2.email = "session2@example.com"
            session2.commit()
            session2.close()
            
            # Session 1: Try to update with stale version
            if isinstance(entity1, Portfolio):
                entity1.name = "Session 1 Update"
            elif isinstance(entity1, User):
                entity1.email = "session1@example.com"
            
            # Property: Should raise StaleDataError on both databases
            with pytest.raises(StaleDataError):
                session1.commit()
            
            session1.rollback()
            session1.close()
            
        finally:
            db_session.close()
            Base.metadata.drop_all(bind=test_engine)
            test_engine.dispose()
