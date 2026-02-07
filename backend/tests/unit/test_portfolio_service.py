"""
Unit tests for portfolio service.
"""
import pytest
from datetime import date
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.portfolio import Portfolio
from app.models.program import Program
from app.services.portfolio import portfolio_service


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create test database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


class TestPortfolioService:
    """Test PortfolioService."""
    
    def test_create_portfolio_with_valid_data(self, db):
        """Test creating a portfolio with valid data."""
        portfolio = portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        assert portfolio.id is not None
        assert portfolio.name == "Test Portfolio"
        assert portfolio.description == "A test portfolio"
        assert portfolio.owner == "John Doe"
        assert portfolio.reporting_start_date == date(2024, 1, 1)
        assert portfolio.reporting_end_date == date(2024, 12, 31)
    
    def test_create_portfolio_with_invalid_dates_raises_error(self, db):
        """Test that creating a portfolio with invalid dates raises ValueError."""
        with pytest.raises(ValueError, match="Reporting start date must be before reporting end date"):
            portfolio_service.create_portfolio(
                db,
                name="Test Portfolio",
                description="A test portfolio",
                owner="John Doe",
                reporting_start_date=date(2024, 12, 31),
                reporting_end_date=date(2024, 1, 1)
            )
    
    def test_create_portfolio_duplicate_name_raises_error(self, db):
        """Test that creating a portfolio with duplicate name raises ValueError."""
        # Create first portfolio
        portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Try to create duplicate
        with pytest.raises(ValueError, match="already exists"):
            portfolio_service.create_portfolio(
                db,
                name="Test Portfolio",
                description="Another test portfolio",
                owner="Jane Doe",
                reporting_start_date=date(2024, 1, 1),
                reporting_end_date=date(2024, 12, 31)
            )
    
    def test_get_portfolio_by_id_exists(self, db):
        """Test getting a portfolio by ID when it exists."""
        portfolio = portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        retrieved = portfolio_service.get_portfolio(db, portfolio.id)
        
        assert retrieved is not None
        assert retrieved.id == portfolio.id
        assert retrieved.name == "Test Portfolio"
    
    def test_get_portfolio_by_id_not_exists(self, db):
        """Test getting a portfolio by ID when it doesn't exist."""
        non_existent_id = uuid4()
        retrieved = portfolio_service.get_portfolio(db, non_existent_id)
        
        assert retrieved is None
    
    def test_list_portfolios_with_pagination(self, db):
        """Test listing portfolios with pagination."""
        # Create multiple portfolios
        for i in range(5):
            portfolio_service.create_portfolio(
                db,
                name=f"Portfolio {i}",
                description=f"Description {i}",
                owner=f"Owner {i}",
                reporting_start_date=date(2024, 1, 1),
                reporting_end_date=date(2024, 12, 31)
            )
        
        # Test pagination
        portfolios = portfolio_service.list_portfolios(db, skip=0, limit=3)
        assert len(portfolios) == 3
        
        portfolios = portfolio_service.list_portfolios(db, skip=3, limit=3)
        assert len(portfolios) == 2
    
    def test_update_portfolio_with_partial_data(self, db):
        """Test updating a portfolio with partial data."""
        portfolio = portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Update only name and owner
        updated = portfolio_service.update_portfolio(
            db,
            portfolio.id,
            name="Updated Portfolio",
            owner="Jane Doe"
        )
        
        assert updated.name == "Updated Portfolio"
        assert updated.owner == "Jane Doe"
        assert updated.description == "A test portfolio"  # Unchanged
        assert updated.reporting_start_date == date(2024, 1, 1)  # Unchanged
    
    def test_update_portfolio_with_invalid_dates_raises_error(self, db):
        """Test that updating a portfolio with invalid dates raises ValueError."""
        portfolio = portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        with pytest.raises(ValueError, match="Reporting start date must be before reporting end date"):
            portfolio_service.update_portfolio(
                db,
                portfolio.id,
                reporting_start_date=date(2024, 12, 31),
                reporting_end_date=date(2024, 1, 1)
            )
    
    def test_update_portfolio_not_found_raises_error(self, db):
        """Test that updating a non-existent portfolio raises ValueError."""
        non_existent_id = uuid4()
        
        with pytest.raises(ValueError, match="not found"):
            portfolio_service.update_portfolio(
                db,
                non_existent_id,
                name="Updated Portfolio"
            )
    
    def test_delete_portfolio_without_programs_succeeds(self, db):
        """Test deleting a portfolio without programs succeeds."""
        portfolio = portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        result = portfolio_service.delete_portfolio(db, portfolio.id)
        
        assert result is True
        
        # Verify portfolio is deleted
        retrieved = portfolio_service.get_portfolio(db, portfolio.id)
        assert retrieved is None
    
    def test_delete_portfolio_with_programs_raises_error(self, db):
        """Test that deleting a portfolio with programs raises ValueError."""
        portfolio = portfolio_service.create_portfolio(
            db,
            name="Test Portfolio",
            description="A test portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Create a program associated with the portfolio
        program = Program(
            portfolio_id=portfolio.id,
            name="Test Program",
            description="A test program",
            business_sponsor="John Doe",
            program_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Refresh to get programs relationship
        db.refresh(portfolio)
        
        with pytest.raises(ValueError, match="associated program"):
            portfolio_service.delete_portfolio(db, portfolio.id)
        
        # Verify portfolio still exists
        db.rollback()
        retrieved = portfolio_service.get_portfolio(db, portfolio.id)
        assert retrieved is not None
    
    def test_delete_portfolio_not_found_raises_error(self, db):
        """Test that deleting a non-existent portfolio raises ValueError."""
        non_existent_id = uuid4()
        
        with pytest.raises(ValueError, match="not found"):
            portfolio_service.delete_portfolio(db, non_existent_id)
    
    def test_search_portfolios(self, db):
        """Test searching portfolios by name."""
        portfolio_service.create_portfolio(
            db,
            name="Alpha Portfolio",
            description="First portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        portfolio_service.create_portfolio(
            db,
            name="Beta Portfolio",
            description="Second portfolio",
            owner="Jane Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        portfolio_service.create_portfolio(
            db,
            name="Gamma Portfolio",
            description="Third portfolio",
            owner="Bob Smith",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Search for "Beta"
        results = portfolio_service.search_portfolios(db, "Beta")
        assert len(results) == 1
        assert results[0].name == "Beta Portfolio"
        
        # Search for "Portfolio" (should match all)
        results = portfolio_service.search_portfolios(db, "Portfolio")
        assert len(results) == 3
    
    def test_get_portfolios_by_owner(self, db):
        """Test getting portfolios by owner."""
        portfolio_service.create_portfolio(
            db,
            name="Portfolio 1",
            description="First portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        portfolio_service.create_portfolio(
            db,
            name="Portfolio 2",
            description="Second portfolio",
            owner="John Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        portfolio_service.create_portfolio(
            db,
            name="Portfolio 3",
            description="Third portfolio",
            owner="Jane Doe",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Get portfolios by John Doe
        results = portfolio_service.get_portfolios_by_owner(db, "John Doe")
        assert len(results) == 2
        
        # Get portfolios by Jane Doe
        results = portfolio_service.get_portfolios_by_owner(db, "Jane Doe")
        assert len(results) == 1
