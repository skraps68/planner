"""
Unit tests to verify version column increments on updates.

Tests that SQLAlchemy's version_id_col feature works correctly.
"""
import pytest
from datetime import date
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project


@pytest.fixture
def test_db():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class TestVersionIncrement:
    """Test suite for version increment behavior."""
    
    def test_portfolio_version_increments_on_update(self, test_db):
        """
        Test that portfolio version increments when updated.
        
        Validates: Requirements 1.3
        """
        # Create portfolio
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test Description",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        test_db.add(portfolio)
        test_db.commit()
        
        # Verify initial version
        assert portfolio.version == 1
        
        # Update portfolio
        portfolio.name = "Updated Portfolio"
        test_db.commit()
        
        # Verify version incremented
        assert portfolio.version == 2
    
    def test_program_version_increments_on_update(self, test_db):
        """
        Test that program version increments when updated.
        
        Validates: Requirements 1.3
        """
        # Create portfolio first
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test Description",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        test_db.add(portfolio)
        
        # Create program
        program = Program(
            id=uuid4(),
            portfolio_id=portfolio.id,
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        test_db.add(program)
        test_db.commit()
        
        # Verify initial version
        assert program.version == 1
        
        # Update program
        program.name = "Updated Program"
        test_db.commit()
        
        # Verify version incremented
        assert program.version == 2
    
    def test_multiple_updates_increment_version(self, test_db):
        """
        Test that version increments with each update.
        
        Validates: Requirements 1.3
        """
        # Create portfolio
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test Description",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        test_db.add(portfolio)
        test_db.commit()
        
        # Verify initial version
        assert portfolio.version == 1
        
        # Update multiple times
        for i in range(2, 6):
            portfolio.name = f"Updated Portfolio {i}"
            test_db.commit()
            assert portfolio.version == i
    
    def test_stale_data_error_on_version_mismatch(self, test_db):
        """
        Test that StaleDataError is raised when version doesn't match.
        
        Validates: Requirements 2.3
        """
        # Create portfolio
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test Description",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        test_db.add(portfolio)
        test_db.commit()
        
        portfolio_id = portfolio.id
        
        # Create a second session to simulate another user
        engine = test_db.get_bind()
        Session = sessionmaker(bind=engine)
        other_session = Session()
        
        try:
            # Load the same portfolio in the other session
            other_portfolio = other_session.query(Portfolio).filter_by(id=portfolio_id).first()
            
            # Update in the other session (simulating another user)
            other_portfolio.name = "Changed by another user"
            other_session.commit()
            
            # Now try to update the original portfolio object
            # This should raise StaleDataError because the version changed
            with pytest.raises(StaleDataError):
                portfolio.description = "My update"
                test_db.commit()
        finally:
            other_session.close()
