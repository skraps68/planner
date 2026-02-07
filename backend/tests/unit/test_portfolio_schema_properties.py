"""
Property-based tests for portfolio schemas.

These tests use Hypothesis to verify universal properties across all possible
portfolio configurations.

Feature: portfolio-entity
"""
from datetime import date, timedelta

import pytest
from hypothesis import given, strategies as st, settings
from pydantic import ValidationError

from app.schemas.portfolio import PortfolioCreate


# Hypothesis strategies for generating test data

@st.composite
def portfolios_with_missing_fields(draw):
    """Generate portfolio data with at least one required field missing or invalid."""
    # Generate valid data first
    name = draw(st.one_of(
        st.just(""),  # Empty string
        st.just(None),  # None
        st.just("   "),  # Whitespace only
        st.text(min_size=1, max_size=255)  # Valid name
    ))
    
    description = draw(st.one_of(
        st.just(""),  # Empty string
        st.just(None),  # None
        st.just("   "),  # Whitespace only
        st.text(min_size=1, max_size=1000)  # Valid description
    ))
    
    owner = draw(st.one_of(
        st.just(""),  # Empty string
        st.just(None),  # None
        st.just("   "),  # Whitespace only
        st.text(min_size=1, max_size=255)  # Valid owner
    ))
    
    start_date = draw(st.one_of(
        st.just(None),  # None
        st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))
    ))
    
    end_date = draw(st.one_of(
        st.just(None),  # None
        st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))
    ))
    
    # Build portfolio dict, excluding None values to test missing fields
    portfolio_data = {}
    
    if name is not None:
        portfolio_data["name"] = name
    if description is not None:
        portfolio_data["description"] = description
    if owner is not None:
        portfolio_data["owner"] = owner
    if start_date is not None:
        portfolio_data["reporting_start_date"] = start_date
    if end_date is not None:
        portfolio_data["reporting_end_date"] = end_date
    
    # Ensure at least one field is missing, empty, or whitespace
    has_invalid = (
        name in ["", None, "   "] or
        description in ["", None, "   "] or
        owner in ["", None, "   "] or
        start_date is None or
        end_date is None or
        "name" not in portfolio_data or
        "description" not in portfolio_data or
        "owner" not in portfolio_data or
        "reporting_start_date" not in portfolio_data or
        "reporting_end_date" not in portfolio_data
    )
    
    # Only return if we have at least one invalid field
    if has_invalid:
        return portfolio_data
    else:
        # Force an invalid field by removing name
        portfolio_data.pop("name", None)
        return portfolio_data


# Property Tests

@pytest.mark.property_test
class TestPortfolioSchemaProperties:
    """Property-based tests for portfolio schemas."""
    
    @given(portfolio_data=portfolios_with_missing_fields())
    @settings(max_examples=100, deadline=None)
    def test_property_1_required_field_validation(self, portfolio_data):
        """
        Property 1: Required Field Validation
        
        For any Portfolio creation request with any required field (name, description,
        owner, reporting_start_date, reporting_end_date) that is empty, null, or
        whitespace-only, the system should reject the request with a validation error.
        
        Validates: Requirements 1.7, 1.8, 1.9, 1.10, 1.11
        """
        # Property: Any portfolio with missing or invalid required fields should fail validation
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**portfolio_data)
        
        # Verify that the validation error is raised
        assert exc_info.value is not None
        
        # Verify that the error contains information about the validation failure
        errors = exc_info.value.errors()
        assert len(errors) > 0, "Expected validation errors but got none"


@st.composite
def invalid_portfolio_data(draw):
    """Generate invalid portfolio data for API testing."""
    # Choose which type of invalid data to generate
    invalid_type = draw(st.sampled_from([
        "missing_name",
        "missing_description",
        "missing_owner",
        "missing_start_date",
        "missing_end_date",
        "empty_name",
        "empty_description",
        "empty_owner",
        "whitespace_name",
        "whitespace_description",
        "whitespace_owner",
        "invalid_date_range",
        "name_too_long",
        "description_too_long",
        "owner_too_long",
    ]))
    
    # Generate base valid data
    base_data = {
        "name": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "description": draw(st.text(min_size=1, max_size=1000, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "owner": draw(st.text(min_size=1, max_size=255, alphabet=st.characters(blacklist_categories=('Cs',)))),
        "reporting_start_date": draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 31))),
        "reporting_end_date": draw(st.dates(min_value=date(2020, 1, 2), max_value=date(2030, 12, 31))),
    }
    
    # Make it invalid based on the chosen type
    if invalid_type == "missing_name":
        del base_data["name"]
    elif invalid_type == "missing_description":
        del base_data["description"]
    elif invalid_type == "missing_owner":
        del base_data["owner"]
    elif invalid_type == "missing_start_date":
        del base_data["reporting_start_date"]
    elif invalid_type == "missing_end_date":
        del base_data["reporting_end_date"]
    elif invalid_type == "empty_name":
        base_data["name"] = ""
    elif invalid_type == "empty_description":
        base_data["description"] = ""
    elif invalid_type == "empty_owner":
        base_data["owner"] = ""
    elif invalid_type == "whitespace_name":
        base_data["name"] = "   "
    elif invalid_type == "whitespace_description":
        base_data["description"] = "   "
    elif invalid_type == "whitespace_owner":
        base_data["owner"] = "   "
    elif invalid_type == "invalid_date_range":
        # End date before start date
        base_data["reporting_end_date"] = base_data["reporting_start_date"] - timedelta(days=1)
    elif invalid_type == "name_too_long":
        base_data["name"] = "a" * 256
    elif invalid_type == "description_too_long":
        base_data["description"] = "a" * 1001
    elif invalid_type == "owner_too_long":
        base_data["owner"] = "a" * 256
    
    # Convert dates to ISO format strings for API
    if "reporting_start_date" in base_data:
        base_data["reporting_start_date"] = base_data["reporting_start_date"].isoformat()
    if "reporting_end_date" in base_data:
        base_data["reporting_end_date"] = base_data["reporting_end_date"].isoformat()
    
    return base_data


@pytest.mark.property_test
class TestPortfolioAPIValidationProperties:
    """Property-based tests for portfolio API validation."""
    
    @given(invalid_data=invalid_portfolio_data())
    @settings(max_examples=100, deadline=None)
    def test_property_7_api_validation_errors(self, invalid_data):
        """
        Property 7: API Validation Error Responses
        
        For any POST or PUT request to Portfolio endpoints with invalid data
        (missing required fields, invalid date ranges, invalid data types),
        the system should return a 400 Bad Request status with validation
        error details.
        
        Note: This test validates schema-level validation. The actual API
        integration test will be in test_portfolio_api.py once the API
        endpoints are implemented.
        
        Validates: Requirements 3.6, 3.8
        """
        # Property: Any invalid portfolio data should fail schema validation
        with pytest.raises(ValidationError) as exc_info:
            PortfolioCreate(**invalid_data)
        
        # Verify that the validation error is raised
        assert exc_info.value is not None
        
        # Verify that the error contains information about the validation failure
        errors = exc_info.value.errors()
        assert len(errors) > 0, "Expected validation errors but got none"
        
        # Verify that each error has the expected structure
        for error in errors:
            assert "type" in error, "Error should have a type field"
            assert "loc" in error, "Error should have a location field"
            assert "msg" in error, "Error should have a message field"
