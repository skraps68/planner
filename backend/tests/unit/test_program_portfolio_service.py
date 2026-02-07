"""
Unit tests for Program service portfolio relationship functionality.

Tests the portfolio_id requirement and validation in program operations.
"""
import pytest
from datetime import date
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.services.program import program_service
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


@pytest.fixture
def sample_portfolio(db):
    """Create a sample portfolio for testing."""
    portfolio = portfolio_service.create_portfolio(
        db,
        name="Test Portfolio",
        description="A test portfolio",
        owner="Test Owner",
        reporting_start_date=date(2024, 1, 1),
        reporting_end_date=date(2024, 12, 31)
    )
    return portfolio


class TestProgramPortfolioRelationship:
    """Test Program service portfolio relationship functionality."""
    
    def test_create_program_with_valid_portfolio_id(self, db, sample_portfolio):
        """Test creating a program with a valid portfolio_id."""
        program = program_service.create_program(
            db,
            portfolio_id=sample_portfolio.id,
            name="Test Program",
            business_sponsor="John Doe",
            program_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            description="A test program"
        )
        
        assert program.id is not None
        assert program.name == "Test Program"
        assert program.portfolio_id == sample_portfolio.id
        assert program.description == "A test program"
    
    def test_create_program_without_portfolio_id_fails(self, db):
        """Test that creating a program without portfolio_id fails."""
        # This should fail at the service level since portfolio_id is required
        with pytest.raises(TypeError):
            program_service.create_program(
                db,
                name="Test Program",
                business_sponsor="John Doe",
                program_manager="Jane Smith",
                technical_lead="Bob Johnson",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31)
            )
    
    def test_create_program_with_invalid_portfolio_id_fails(self, db):
        """Test that creating a program with an invalid portfolio_id fails."""
        non_existent_id = uuid4()
        
        with pytest.raises(ValueError, match="Portfolio.*does not exist"):
            program_service.create_program(
                db,
                portfolio_id=non_existent_id,
                name="Test Program",
                business_sponsor="John Doe",
                program_manager="Jane Smith",
                technical_lead="Bob Johnson",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31)
            )
    
    def test_get_program_includes_portfolio_relationship(self, db, sample_portfolio):
        """Test that getting a program includes the portfolio relationship."""
        # Create program
        program = program_service.create_program(
            db,
            portfolio_id=sample_portfolio.id,
            name="Test Program",
            business_sponsor="John Doe",
            program_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        
        # Retrieve program
        retrieved = program_service.get_program(db, program.id)
        
        assert retrieved is not None
        assert retrieved.id == program.id
        assert retrieved.portfolio_id == sample_portfolio.id
        assert retrieved.portfolio is not None
        assert retrieved.portfolio.id == sample_portfolio.id
        assert retrieved.portfolio.name == "Test Portfolio"
    
    def test_update_program_portfolio_id(self, db, sample_portfolio):
        """Test updating a program's portfolio_id."""
        # Create second portfolio
        portfolio2 = portfolio_service.create_portfolio(
            db,
            name="Second Portfolio",
            description="Another test portfolio",
            owner="Test Owner 2",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        
        # Create program with first portfolio
        program = program_service.create_program(
            db,
            portfolio_id=sample_portfolio.id,
            name="Test Program",
            business_sponsor="John Doe",
            program_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        
        # Update to second portfolio
        updated = program_service.update_program(
            db,
            program.id,
            portfolio_id=portfolio2.id
        )
        
        assert updated.portfolio_id == portfolio2.id
        
        # Verify the change persisted
        retrieved = program_service.get_program(db, program.id)
        assert retrieved.portfolio_id == portfolio2.id
    
    def test_update_program_with_invalid_portfolio_id_fails(self, db, sample_portfolio):
        """Test that updating a program with an invalid portfolio_id fails."""
        # Create program
        program = program_service.create_program(
            db,
            portfolio_id=sample_portfolio.id,
            name="Test Program",
            business_sponsor="John Doe",
            program_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        
        # Try to update with non-existent portfolio
        non_existent_id = uuid4()
        
        with pytest.raises(ValueError, match="Portfolio.*does not exist"):
            program_service.update_program(
                db,
                program.id,
                portfolio_id=non_existent_id
            )
