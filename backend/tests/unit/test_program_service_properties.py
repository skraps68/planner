"""
Property-based tests for program service.

These tests use Hypothesis to verify universal properties across all possible
program and portfolio configurations.

Feature: portfolio-entity
"""
from datetime import date, timedelta
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.services.program import program_service
from app.services.portfolio import portfolio_service
from app.schemas.program import ProgramCreate


# Test database setup - use session scope
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
        session.query(Program).delete()
        session.query(Portfolio).delete()
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
    
    return {
        "name": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "description": draw(st.text(min_size=1, max_size=1000, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "owner": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "reporting_start_date": start_date,
        "reporting_end_date": end_date,
    }


@st.composite
def valid_program_data(draw):
    """Generate valid program data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 31)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    
    return {
        "name": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "description": draw(st.text(min_size=1, max_size=1000, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "business_sponsor": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "program_manager": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "technical_lead": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "start_date": start_date,
        "end_date": end_date,
    }


@st.composite
def program_data_without_portfolio(draw):
    """Generate program data without portfolio_id."""
    program_data = draw(valid_program_data())
    # Explicitly exclude portfolio_id
    return program_data


# Property Tests

@pytest.mark.property_test
class TestProgramServiceProperties:
    """Property-based tests for program service."""
    
    @given(program_data=program_data_without_portfolio())
    @settings(max_examples=100, deadline=None)
    def test_property_2_program_portfolio_association_required(self, SessionLocal, program_data):
        """
        Property 2: Program Portfolio Association Required
        
        For any Program creation request without a portfolio_id or with a null
        portfolio_id, the system should reject the request with a validation error.
        
        Validates: Requirements 2.3
        """
        # Get a fresh database session for this example
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Property: Creating a ProgramCreate schema without portfolio_id should fail
            with pytest.raises(ValidationError) as exc_info:
                ProgramCreate(**program_data)
            
            # Verify the error is about missing portfolio_id
            errors = exc_info.value.errors()
            assert any(error['loc'] == ('portfolio_id',) and error['type'] == 'missing' for error in errors)
        finally:
            db_session.close()
    
    @given(program_data=valid_program_data())
    @settings(max_examples=100, deadline=None)
    def test_property_3_portfolio_reference_integrity(self, SessionLocal, program_data):
        """
        Property 3: Portfolio Reference Integrity
        
        For any Program creation request with a portfolio_id that does not
        reference an existing Portfolio, the system should reject the request
        with a referential integrity error.
        
        Validates: Requirements 2.4
        """
        # Get a fresh database session for this example
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Generate a random UUID that doesn't exist in the database
            non_existent_portfolio_id = uuid4()
            
            # Property: Creating a program with non-existent portfolio_id should fail
            with pytest.raises(ValueError) as exc_info:
                program_service.create_program(
                    db=db_session,
                    portfolio_id=non_existent_portfolio_id,
                    **program_data
                )
            
            # Verify error message mentions portfolio doesn't exist
            assert "portfolio" in str(exc_info.value).lower()
            assert "does not exist" in str(exc_info.value).lower()
        finally:
            db_session.close()
    
    @given(
        portfolio_data=valid_portfolio_data(),
        program_data=valid_program_data()
    )
    @settings(max_examples=100, deadline=None)
    def test_property_6_program_portfolio_relationship_query(self, SessionLocal, portfolio_data, program_data):
        """
        Property 6: Program-Portfolio Relationship Query
        
        For any Program with a portfolio_id, querying the Program should return
        the Portfolio that matches that portfolio_id.
        
        Validates: Requirements 2.7
        """
        # Get a fresh database session for this example
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create portfolio
            portfolio = portfolio_service.create_portfolio(
                db=db_session,
                **portfolio_data
            )
            
            # Create program with portfolio_id
            program = program_service.create_program(
                db=db_session,
                portfolio_id=portfolio.id,
                **program_data
            )
            
            # Property: Querying program should return its associated portfolio
            retrieved_program = program_service.get_program(db_session, program.id)
            
            assert retrieved_program is not None
            assert retrieved_program.portfolio_id == portfolio.id
            assert retrieved_program.portfolio is not None
            assert retrieved_program.portfolio.id == portfolio.id
            assert retrieved_program.portfolio.name == portfolio.name
        finally:
            db_session.close()
