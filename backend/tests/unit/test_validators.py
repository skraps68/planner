"""
Tests for input validators.
"""
import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.core.validators import InputValidator, BusinessRuleValidator
from app.core.exceptions import (
    InvalidUUIDError,
    InvalidDateRangeError,
    InvalidPercentageError,
    InvalidInputError,
    MissingRequiredFieldError,
    ValidationError,
)


class TestInputValidator:
    """Test InputValidator class."""
    
    def test_validate_uuid_valid(self):
        """Test validating valid UUID."""
        test_uuid = uuid4()
        result = InputValidator.validate_uuid(str(test_uuid))
        assert result == test_uuid
    
    def test_validate_uuid_already_uuid(self):
        """Test validating UUID object."""
        test_uuid = uuid4()
        result = InputValidator.validate_uuid(test_uuid)
        assert result == test_uuid
    
    def test_validate_uuid_invalid(self):
        """Test validating invalid UUID."""
        with pytest.raises(InvalidUUIDError):
            InputValidator.validate_uuid("not-a-uuid")
    
    def test_validate_date_range_valid(self):
        """Test validating valid date range."""
        start = date(2024, 1, 1)
        end = date(2024, 12, 31)
        result_start, result_end = InputValidator.validate_date_range(start, end)
        assert result_start == start
        assert result_end == end
    
    def test_validate_date_range_invalid(self):
        """Test validating invalid date range."""
        start = date(2024, 12, 31)
        end = date(2024, 1, 1)
        with pytest.raises(InvalidDateRangeError):
            InputValidator.validate_date_range(start, end)
    
    def test_validate_date_range_equal_not_allowed(self):
        """Test validating equal dates when not allowed."""
        same_date = date(2024, 1, 1)
        with pytest.raises(InvalidDateRangeError):
            InputValidator.validate_date_range(same_date, same_date, allow_equal=False)
    
    def test_validate_date_range_equal_allowed(self):
        """Test validating equal dates when allowed."""
        same_date = date(2024, 1, 1)
        result_start, result_end = InputValidator.validate_date_range(
            same_date, same_date, allow_equal=True
        )
        assert result_start == same_date
        assert result_end == same_date
    
    def test_validate_date_range_none_values(self):
        """Test validating date range with None values."""
        result_start, result_end = InputValidator.validate_date_range(None, None)
        assert result_start is None
        assert result_end is None
    
    def test_validate_percentage_valid(self):
        """Test validating valid percentage."""
        result = InputValidator.validate_percentage(50.0, "test_field")
        assert result == Decimal("50.0")
    
    def test_validate_percentage_zero(self):
        """Test validating zero percentage."""
        result = InputValidator.validate_percentage(0, "test_field")
        assert result == Decimal("0")
    
    def test_validate_percentage_hundred(self):
        """Test validating 100 percentage."""
        result = InputValidator.validate_percentage(100, "test_field")
        assert result == Decimal("100")
    
    def test_validate_percentage_out_of_range_high(self):
        """Test validating percentage above 100."""
        with pytest.raises(InvalidPercentageError):
            InputValidator.validate_percentage(150, "test_field")
    
    def test_validate_percentage_out_of_range_low(self):
        """Test validating negative percentage."""
        with pytest.raises(InvalidPercentageError):
            InputValidator.validate_percentage(-10, "test_field")
    
    def test_validate_percentage_none_not_allowed(self):
        """Test validating None percentage when not allowed."""
        with pytest.raises(MissingRequiredFieldError):
            InputValidator.validate_percentage(None, "test_field", allow_none=False)
    
    def test_validate_percentage_none_allowed(self):
        """Test validating None percentage when allowed."""
        result = InputValidator.validate_percentage(None, "test_field", allow_none=True)
        assert result is None
    
    def test_validate_budget_components_valid(self):
        """Test validating valid budget components."""
        capital = Decimal("60.00")
        expense = Decimal("40.00")
        total = Decimal("100.00")
        result = InputValidator.validate_budget_components(capital, expense, total)
        assert result == (capital, expense, total)
    
    def test_validate_budget_components_no_total(self):
        """Test validating budget components without total."""
        capital = Decimal("60.00")
        expense = Decimal("40.00")
        result_capital, result_expense, result_total = InputValidator.validate_budget_components(
            capital, expense
        )
        assert result_capital == capital
        assert result_expense == expense
        assert result_total == Decimal("100.00")
    
    def test_validate_budget_components_mismatch(self):
        """Test validating budget components that don't sum correctly."""
        capital = Decimal("60.00")
        expense = Decimal("30.00")
        total = Decimal("100.00")
        with pytest.raises(ValidationError):
            InputValidator.validate_budget_components(capital, expense, total)
    
    def test_sanitize_string_basic(self):
        """Test basic string sanitization."""
        result = InputValidator.sanitize_string("  test string  ")
        assert result == "test string"
    
    def test_sanitize_string_no_strip(self):
        """Test string sanitization without stripping."""
        result = InputValidator.sanitize_string("  test  ", strip_whitespace=False)
        assert result == "  test  "
    
    def test_sanitize_string_sql_injection(self):
        """Test detecting SQL injection patterns."""
        with pytest.raises(ValidationError):
            InputValidator.sanitize_string("SELECT * FROM users")
    
    def test_sanitize_string_xss(self):
        """Test detecting XSS patterns."""
        with pytest.raises(ValidationError):
            InputValidator.sanitize_string("<script>alert('xss')</script>")
    
    def test_sanitize_string_max_length(self):
        """Test enforcing max length."""
        with pytest.raises(InvalidInputError):
            InputValidator.sanitize_string("a" * 100, max_length=50)
    
    def test_sanitize_string_none(self):
        """Test sanitizing None."""
        result = InputValidator.sanitize_string(None)
        assert result is None
    
    def test_validate_required_fields_all_present(self):
        """Test validating all required fields present."""
        data = {"name": "Test", "email": "test@example.com"}
        InputValidator.validate_required_fields(data, ["name", "email"])
        # Should not raise
    
    def test_validate_required_fields_missing(self):
        """Test validating with missing required fields."""
        data = {"name": "Test"}
        with pytest.raises(ValidationError):
            InputValidator.validate_required_fields(data, ["name", "email"])
    
    def test_validate_positive_amount_valid(self):
        """Test validating positive amount."""
        result = InputValidator.validate_positive_amount(100.50, "amount")
        assert result == Decimal("100.50")
    
    def test_validate_positive_amount_zero_allowed(self):
        """Test validating zero amount when allowed."""
        result = InputValidator.validate_positive_amount(0, "amount", allow_zero=True)
        assert result == Decimal("0")
    
    def test_validate_positive_amount_zero_not_allowed(self):
        """Test validating zero amount when not allowed."""
        with pytest.raises(InvalidInputError):
            InputValidator.validate_positive_amount(0, "amount", allow_zero=False)
    
    def test_validate_positive_amount_negative(self):
        """Test validating negative amount."""
        with pytest.raises(InvalidInputError):
            InputValidator.validate_positive_amount(-10, "amount")
    
    def test_validate_email_valid(self):
        """Test validating valid email."""
        result = InputValidator.validate_email("test@example.com")
        assert result == "test@example.com"
    
    def test_validate_email_invalid(self):
        """Test validating invalid email."""
        with pytest.raises(InvalidInputError):
            InputValidator.validate_email("not-an-email")
    
    def test_validate_list_not_empty_valid(self):
        """Test validating non-empty list."""
        result = InputValidator.validate_list_not_empty([1, 2, 3], "items")
        assert result == [1, 2, 3]
    
    def test_validate_list_not_empty_empty(self):
        """Test validating empty list."""
        with pytest.raises(InvalidInputError):
            InputValidator.validate_list_not_empty([], "items")
    
    def test_validate_unique_list_valid(self):
        """Test validating list with unique values."""
        result = InputValidator.validate_unique_list([1, 2, 3], "items")
        assert result == [1, 2, 3]
    
    def test_validate_unique_list_duplicates(self):
        """Test validating list with duplicates."""
        with pytest.raises(ValidationError):
            InputValidator.validate_unique_list([1, 2, 2, 3], "items")


class TestBusinessRuleValidator:
    """Test BusinessRuleValidator class."""
    
    def test_validate_project_dates_within_program_valid(self):
        """Test validating project dates within program dates."""
        program_start = date(2024, 1, 1)
        program_end = date(2024, 12, 31)
        project_start = date(2024, 3, 1)
        project_end = date(2024, 9, 30)
        
        BusinessRuleValidator.validate_project_dates_within_program(
            project_start, project_end, program_start, program_end
        )
        # Should not raise
    
    def test_validate_project_dates_before_program(self):
        """Test validating project start before program start."""
        program_start = date(2024, 1, 1)
        program_end = date(2024, 12, 31)
        project_start = date(2023, 12, 1)
        project_end = date(2024, 9, 30)
        
        with pytest.raises(ValidationError):
            BusinessRuleValidator.validate_project_dates_within_program(
                project_start, project_end, program_start, program_end
            )
    
    def test_validate_project_dates_after_program(self):
        """Test validating project end after program end."""
        program_start = date(2024, 1, 1)
        program_end = date(2024, 12, 31)
        project_start = date(2024, 3, 1)
        project_end = date(2025, 1, 31)
        
        with pytest.raises(ValidationError):
            BusinessRuleValidator.validate_project_dates_within_program(
                project_start, project_end, program_start, program_end
            )
    
    def test_validate_phase_dates_valid(self):
        """Test validating valid phase dates."""
        planning_start = date(2024, 1, 1)
        planning_end = date(2024, 2, 28)
        execution_start = date(2024, 3, 1)
        execution_end = date(2024, 12, 31)
        
        BusinessRuleValidator.validate_phase_dates(
            planning_start, planning_end, execution_start, execution_end
        )
        # Should not raise
    
    def test_validate_phase_dates_overlap(self):
        """Test validating overlapping phase dates."""
        planning_start = date(2024, 1, 1)
        planning_end = date(2024, 3, 15)
        execution_start = date(2024, 3, 1)
        execution_end = date(2024, 12, 31)
        
        with pytest.raises(ValidationError):
            BusinessRuleValidator.validate_phase_dates(
                planning_start, planning_end, execution_start, execution_end
            )
    
    def test_validate_phase_dates_no_planning(self):
        """Test validating phase dates without planning phase."""
        execution_start = date(2024, 3, 1)
        execution_end = date(2024, 12, 31)
        
        BusinessRuleValidator.validate_phase_dates(
            None, None, execution_start, execution_end
        )
        # Should not raise
    
    def test_validate_assignment_within_project_dates_valid(self):
        """Test validating assignment within project dates."""
        assignment_date = date(2024, 6, 15)
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        BusinessRuleValidator.validate_assignment_within_project_dates(
            assignment_date, project_start, project_end
        )
        # Should not raise
    
    def test_validate_assignment_before_project(self):
        """Test validating assignment before project start."""
        assignment_date = date(2023, 12, 15)
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        with pytest.raises(ValidationError):
            BusinessRuleValidator.validate_assignment_within_project_dates(
                assignment_date, project_start, project_end
            )
    
    def test_validate_assignment_after_project(self):
        """Test validating assignment after project end."""
        assignment_date = date(2025, 1, 15)
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        with pytest.raises(ValidationError):
            BusinessRuleValidator.validate_assignment_within_project_dates(
                assignment_date, project_start, project_end
            )
