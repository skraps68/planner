"""
Property-based tests for successful updates with matching versions.

Feature: optimistic-locking
Property 4: Successful Update with Matching Version
Validates: Requirements 2.2
"""
import pytest
from hypothesis import given, strategies as st, settings, assume
from decimal import Decimal
from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.models.rate import Rate
from app.models.actual import Actual
from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.services.portfolio import portfolio_service
from app.services.program import program_service
from app.services.project import project_service
from app.services.phase_service import phase_service
from app.services.resource import resource_service, worker_type_service, worker_service, rate_service
from app.services.assignment import assignment_service
from app.services.actuals import actuals_service
from app.services.role_management import role_management_service


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
def valid_name(draw):
    """Generate valid entity names."""
    return draw(st.text(min_size=1, max_size=50, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd'),
        whitelist_characters=' -_'
    )))


@st.composite
def valid_date_range(draw):
    """Generate valid date ranges."""
    start = draw(st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2030, 12, 31)
    ))
    end = draw(st.dates(
        min_value=start + timedelta(days=1),
        max_value=start + timedelta(days=365)
    ))
    return start, end


@st.composite
def valid_percentage(draw):
    """Generate valid percentage (0-100)."""
    return Decimal(str(draw(st.integers(min_value=0, max_value=100))))


# Feature: optimistic-locking, Property 4: Successful Update with Matching Version
@given(
    name_update=valid_name(),
    description=st.text(max_size=200)
)
@settings(max_examples=100, deadline=None)
def test_portfolio_update_with_matching_version(
    SessionLocal,
    name_update: str,
    description: str
):
    """
    Property: For any portfolio, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create portfolio
        start, end = date(2024, 1, 1), date(2024, 12, 31)
        portfolio = portfolio_service.create_portfolio(
            db=db,
            name=f"Test Portfolio {uuid4()}",
            description="Original description",
            owner="Test Owner",
            reporting_start_date=start,
            reporting_end_date=end
        )
        
        initial_version = portfolio.version
        assert initial_version == 1, "New portfolio should have version 1"
        
        # Update with matching version
        updated = portfolio_service.update_portfolio(
            db=db,
            portfolio_id=portfolio.id,
            name=name_update,
            description=description
        )
        
        # Verify update succeeded
        assert updated.id == portfolio.id
        assert updated.name == name_update
        assert updated.description == description
        assert updated.version == initial_version + 1, "Version should increment by 1"
    finally:
        db.close()


@given(
    name_update=valid_name()
)
@settings(max_examples=100, deadline=None)
def test_program_update_with_matching_version(
    SessionLocal,
    name_update: str
):
    """
    Property: For any program, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create portfolio first
        portfolio = portfolio_service.create_portfolio(
            db=db,
            name=f"Portfolio {uuid4()}",
            description="Test",
            owner="Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Create program
        start, end = date(2024, 1, 1), date(2024, 12, 31)
        program = program_service.create_program(
            db=db,
            portfolio_id=portfolio.id,
            name=f"Test Program {uuid4()}",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=start,
            end_date=end
        )
        
        initial_version = program.version
        
        # Update with matching version
        updated = program_service.update_program(
            db=db,
            program_id=program.id,
            name=name_update
        )
        
        # Verify update succeeded
        assert updated.id == program.id
        assert updated.name == name_update
        assert updated.version == initial_version + 1
    finally:
        db.close()


@given(
    name_update=valid_name()
)
@settings(max_examples=100, deadline=None)
def test_project_update_with_matching_version(
    SessionLocal,
    name_update: str
):
    """
    Property: For any project, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create portfolio and program
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
        
        # Create project
        project = project_service.create_project(
            db=db,
            program_id=program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Sponsor",
            project_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4()}"
        )
        
        initial_version = project.version
        
        # Update with matching version
        updated = project_service.update_project(
            db=db,
            project_id=project.id,
            name=name_update
        )
        
        # Verify update succeeded
        assert updated.id == project.id
        assert updated.name == name_update
        assert updated.version == initial_version + 1
    finally:
        db.close()


@given(
    name_update=valid_name()
)
@settings(max_examples=100, deadline=None)
def test_resource_update_with_matching_version(
    SessionLocal,
    name_update: str
):
    """
    Property: For any resource, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create resource
        resource = resource_service.create_resource(
            db=db,
            name=f"Test Resource {uuid4()}",
            resource_type=ResourceType.LABOR,
            description="Original description"
        )
        
        initial_version = resource.version
        
        # Update with matching version
        updated = resource_service.update_resource(
            db=db,
            resource_id=resource.id,
            name=name_update
        )
        
        # Verify update succeeded
        assert updated.id == resource.id
        assert updated.name == name_update
        assert updated.version == initial_version + 1
    finally:
        db.close()


@given(
    type_update=valid_name()
)
@settings(max_examples=100, deadline=None)
def test_worker_type_update_with_matching_version(
    SessionLocal,
    type_update: str
):
    """
    Property: For any worker type, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create worker type
        worker_type = worker_type_service.create_worker_type(
            db=db,
            type=f"Type {uuid4()}",
            description="Original description"
        )
        
        initial_version = worker_type.version
        
        # Update with matching version
        updated = worker_type_service.update_worker_type(
            db=db,
            worker_type_id=worker_type.id,
            type=type_update
        )
        
        # Verify update succeeded
        assert updated.id == worker_type.id
        assert updated.type == type_update
        assert updated.version == initial_version + 1
    finally:
        db.close()


@given(
    name_update=valid_name()
)
@settings(max_examples=100, deadline=None)
def test_worker_update_with_matching_version(
    SessionLocal,
    name_update: str
):
    """
    Property: For any worker, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create worker type first
        worker_type = worker_type_service.create_worker_type(
            db=db,
            type=f"Type {uuid4()}",
            description="Test type"
        )
        
        # Create worker
        worker = worker_service.create_worker(
            db=db,
            external_id=f"EXT-{uuid4()}",
            name=f"Worker {uuid4()}",
            worker_type_id=worker_type.id
        )
        
        initial_version = worker.version
        
        # Update with matching version
        updated = worker_service.update_worker(
            db=db,
            worker_id=worker.id,
            name=name_update
        )
        
        # Verify update succeeded
        assert updated.id == worker.id
        assert updated.name == name_update
        assert updated.version == initial_version + 1
    finally:
        db.close()


@given(
    capital_pct=valid_percentage(),
    expense_pct=valid_percentage()
)
@settings(max_examples=100, deadline=None)
def test_assignment_update_with_matching_version(
    SessionLocal,
    capital_pct: Decimal,
    expense_pct: Decimal
):
    """
    Property: For any resource assignment, when an update request is sent with a version
    number that matches the current database version, the update should succeed
    and return the updated entity with an incremented version.
    
    Validates: Requirements 2.2
    """
    # Ensure percentages don't exceed 100
    assume(capital_pct + expense_pct <= 100)
    
    db = get_fresh_db_session(SessionLocal)
    try:
        # Create necessary entities
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
            name=f"Project {uuid4()}",
            business_sponsor="Sponsor",
            project_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4()}"
        )
        
        resource = resource_service.create_resource(
            db=db,
            name=f"Resource {uuid4()}",
            resource_type=ResourceType.LABOR
        )
        
        # Create assignment
        assignment = assignment_service.create_assignment(
            db=db,
            resource_id=resource.id,
            project_id=project.id,
            assignment_date=date(2024, 6, 15),
            capital_percentage=Decimal("30"),
            expense_percentage=Decimal("20")
        )
        
        initial_version = assignment.version
        
        # Update with matching version
        updated = assignment_service.update_assignment(
            db=db,
            assignment_id=assignment.id,
            capital_percentage=capital_pct,
            expense_percentage=expense_pct
        )
        
        # Verify update succeeded
        assert updated.id == assignment.id
        assert updated.capital_percentage == capital_pct
        assert updated.expense_percentage == expense_pct
        assert updated.version == initial_version + 1
    finally:
        db.close()
