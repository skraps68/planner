"""
Property-based tests for portfolio service.

These tests use Hypothesis to verify universal properties across all possible
portfolio and program configurations.

Feature: portfolio-entity
"""
from datetime import date, timedelta
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.services.portfolio import portfolio_service


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
def portfolio_with_programs(draw):
    """Generate a portfolio with a specified number of programs."""
    portfolio_data = draw(valid_portfolio_data())
    num_programs = draw(st.integers(min_value=1, max_value=5))
    programs = [draw(valid_program_data()) for _ in range(num_programs)]
    
    return {
        "portfolio": portfolio_data,
        "programs": programs,
        "num_programs": num_programs
    }


# Property Tests

@pytest.mark.property_test
class TestPortfolioServiceProperties:
    """Property-based tests for portfolio service."""
    
    @given(data=portfolio_with_programs())
    @settings(max_examples=100, deadline=None)
    def test_property_4_portfolio_deletion_protection(self, SessionLocal, data):
        """
        Property 4: Portfolio Deletion Protection
        
        For any Portfolio that has one or more associated Programs, attempting
        to delete the Portfolio should fail with a conflict error and the
        Portfolio should remain in the database.
        
        Validates: Requirements 2.5
        """
        # Get a fresh database session for this example
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create portfolio
            portfolio = portfolio_service.create_portfolio(
                db=db_session,
                **data["portfolio"]
            )
            
            # Create programs associated with the portfolio
            for program_data in data["programs"]:
                program = Program(
                    portfolio_id=portfolio.id,
                    **program_data
                )
                db_session.add(program)
            db_session.commit()
            
            # Refresh to get programs relationship
            db_session.refresh(portfolio)
            
            # Verify portfolio has programs
            assert len(portfolio.programs) == data["num_programs"]
            
            # Property: Attempting to delete portfolio with programs should fail
            with pytest.raises(ValueError) as exc_info:
                portfolio_service.delete_portfolio(db_session, portfolio.id)
            
            # Verify error message mentions programs
            assert "associated program" in str(exc_info.value).lower()
            
            # Verify portfolio still exists in database
            db_session.rollback()  # Rollback any partial changes
            existing_portfolio = portfolio_service.get_portfolio(db_session, portfolio.id)
            assert existing_portfolio is not None
            assert existing_portfolio.id == portfolio.id
        finally:
            db_session.close()
    
    @given(data=portfolio_with_programs())
    @settings(max_examples=100, deadline=None)
    def test_property_5_portfolio_program_relationship_query(self, SessionLocal, data):
        """
        Property 5: Portfolio-Program Relationship Query
        
        For any Portfolio with associated Programs, querying the Portfolio
        should return all Programs that have that Portfolio's ID as their
        portfolio_id.
        
        Validates: Requirements 2.6
        """
        # Get a fresh database session for this example
        db_session = get_fresh_db_session(SessionLocal)
        
        try:
            # Create portfolio
            portfolio = portfolio_service.create_portfolio(
                db=db_session,
                **data["portfolio"]
            )
            
            # Create programs associated with the portfolio
            program_ids = []
            for program_data in data["programs"]:
                program = Program(
                    portfolio_id=portfolio.id,
                    **program_data
                )
                db_session.add(program)
                db_session.flush()
                program_ids.append(program.id)
            db_session.commit()
            
            # Property: Querying portfolio should return all associated programs
            retrieved_portfolio = portfolio_service.get_portfolio(db_session, portfolio.id)
            
            assert retrieved_portfolio is not None
            assert len(retrieved_portfolio.programs) == data["num_programs"]
            
            # Verify all created programs are in the portfolio's programs relationship
            retrieved_program_ids = {p.id for p in retrieved_portfolio.programs}
            expected_program_ids = set(program_ids)
            
            assert retrieved_program_ids == expected_program_ids
            
            # Verify each program has the correct portfolio_id
            for program in retrieved_portfolio.programs:
                assert program.portfolio_id == portfolio.id
        finally:
            db_session.close()
