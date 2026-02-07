"""
Unit tests for Portfolio Pydantic schemas.
"""
import pytest
from datetime import date
from uuid import uuid4
from pydantic import ValidationError

from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioUpdate,
    PortfolioResponse,
    PortfolioSummary
)


class TestPortfolioSchemas:
    """Test portfolio-related schemas."""
    
    def test_portfolio_create_valid(self):
        """Test PortfolioCreate validation with valid data."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        portfolio = PortfolioCreate(**portfolio_data)
        assert portfolio.name == "Strategic Portfolio"
        assert portfolio.description == "A portfolio for strategic initiatives"
        assert portfolio.owner == "John Doe"
        assert portfolio.reporting_start_date == date(2024, 1, 1)
        assert portfolio.reporting_end_date == date(2024, 12, 31)
    
    def test_portfolio_create_missing_name(self):
        """Test PortfolioCreate validation with missing name."""
        portfolio_data = {
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("name",) for error in errors)
    
    def test_portfolio_create_empty_name(self):
        """Test PortfolioCreate validation with empty name."""
        portfolio_data = {
            "name": "",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
    
    def test_portfolio_create_whitespace_name(self):
        """Test PortfolioCreate validation with whitespace-only name."""
        portfolio_data = {
            "name": "   ",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        # After stripping whitespace, the name becomes empty
        assert any("name" in str(error["loc"]) for error in errors)
    
    def test_portfolio_create_missing_description(self):
        """Test PortfolioCreate validation with missing description."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("description",) for error in errors)
    
    def test_portfolio_create_empty_description(self):
        """Test PortfolioCreate validation with empty description."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any("description" in str(error["loc"]) for error in errors)
    
    def test_portfolio_create_missing_owner(self):
        """Test PortfolioCreate validation with missing owner."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("owner",) for error in errors)
    
    def test_portfolio_create_missing_start_date(self):
        """Test PortfolioCreate validation with missing start date."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("reporting_start_date",) for error in errors)
    
    def test_portfolio_create_missing_end_date(self):
        """Test PortfolioCreate validation with missing end date."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any(error["loc"] == ("reporting_end_date",) for error in errors)
    
    def test_portfolio_create_invalid_date_range(self):
        """Test date range validation - end date before start date."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 12, 31),
            "reporting_end_date": date(2024, 1, 1),  # End before start
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        assert "Reporting end date must be after reporting start date" in str(exc_info.value)
    
    def test_portfolio_create_equal_dates(self):
        """Test date range validation - end date equal to start date."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 6, 15),
            "reporting_end_date": date(2024, 6, 15),  # Same as start
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        assert "Reporting end date must be after reporting start date" in str(exc_info.value)
    
    def test_portfolio_create_name_too_long(self):
        """Test field length validation - name exceeds max length."""
        portfolio_data = {
            "name": "a" * 256,  # Exceeds 255 character limit
            "description": "A portfolio for strategic initiatives",
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) and "at most 255 characters" in str(error["msg"]) for error in errors)
    
    def test_portfolio_create_description_too_long(self):
        """Test field length validation - description exceeds max length."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "a" * 1001,  # Exceeds 1000 character limit
            "owner": "John Doe",
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any("description" in str(error["loc"]) and "at most 1000 characters" in str(error["msg"]) for error in errors)
    
    def test_portfolio_create_owner_too_long(self):
        """Test field length validation - owner exceeds max length."""
        portfolio_data = {
            "name": "Strategic Portfolio",
            "description": "A portfolio for strategic initiatives",
            "owner": "a" * 256,  # Exceeds 255 character limit
            "reporting_start_date": date(2024, 1, 1),
            "reporting_end_date": date(2024, 12, 31),
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        errors = exc_info.value.errors()
        assert any("owner" in str(error["loc"]) and "at most 255 characters" in str(error["msg"]) for error in errors)
    
    def test_portfolio_update_partial(self):
        """Test PortfolioUpdate with partial data."""
        update_data = {
            "name": "Updated Portfolio Name",
            "description": "Updated description"
        }
        portfolio_update = PortfolioUpdate(**update_data)
        assert portfolio_update.name == "Updated Portfolio Name"
        assert portfolio_update.description == "Updated description"
        assert portfolio_update.owner is None
        assert portfolio_update.reporting_start_date is None
        assert portfolio_update.reporting_end_date is None
    
    def test_portfolio_update_all_fields(self):
        """Test PortfolioUpdate with all fields."""
        update_data = {
            "name": "Updated Portfolio",
            "description": "Updated description",
            "owner": "Jane Smith",
            "reporting_start_date": date(2025, 1, 1),
            "reporting_end_date": date(2025, 12, 31),
        }
        portfolio_update = PortfolioUpdate(**update_data)
        assert portfolio_update.name == "Updated Portfolio"
        assert portfolio_update.description == "Updated description"
        assert portfolio_update.owner == "Jane Smith"
        assert portfolio_update.reporting_start_date == date(2025, 1, 1)
        assert portfolio_update.reporting_end_date == date(2025, 12, 31)
    
    def test_portfolio_update_invalid_date_range(self):
        """Test PortfolioUpdate date range validation."""
        update_data = {
            "reporting_start_date": date(2025, 12, 31),
            "reporting_end_date": date(2025, 1, 1),  # End before start
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioUpdate(**update_data)
        assert "Reporting end date must be after reporting start date" in str(exc_info.value)
    
    def test_portfolio_update_empty_fields(self):
        """Test PortfolioUpdate validation with empty fields."""
        update_data = {
            "name": "",
        }
        with pytest.raises(ValidationError) as exc_info:
            PortfolioUpdate(**update_data)
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
