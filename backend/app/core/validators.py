"""
Input validation and sanitization utilities.

This module provides comprehensive validation functions for business rules,
data integrity, and security constraints.
"""
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from app.core.exceptions import (
    InvalidDateRangeError,
    InvalidInputError,
    InvalidPercentageError,
    InvalidUUIDError,
    MissingRequiredFieldError,
    ValidationError,
)


class InputValidator:
    """Utility class for input validation and sanitization."""
    
    # SQL injection patterns to detect
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
        r"(--|;|\/\*|\*\/|xp_|sp_)",
        r"(\bUNION\b.*\bSELECT\b)",
        r"(\bOR\b.*=.*)",
    ]
    
    # XSS patterns to detect
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe",
        r"<object",
        r"<embed",
    ]
    
    @staticmethod
    def validate_uuid(value: Any, field_name: str = "id") -> UUID:
        """
        Validate and convert UUID string to UUID object.
        
        Args:
            value: Value to validate
            field_name: Name of the field for error messages
            
        Returns:
            UUID object
            
        Raises:
            InvalidUUIDError: If value is not a valid UUID
        """
        if isinstance(value, UUID):
            return value
        
        if not isinstance(value, str):
            raise InvalidUUIDError(field_name, str(value))
        
        try:
            return UUID(value)
        except (ValueError, AttributeError):
            raise InvalidUUIDError(field_name, value)
    
    @staticmethod
    def validate_date_range(
        start_date: Optional[date],
        end_date: Optional[date],
        start_field: str = "start_date",
        end_field: str = "end_date",
        allow_equal: bool = False
    ) -> Tuple[Optional[date], Optional[date]]:
        """
        Validate that start_date is before end_date.
        
        Args:
            start_date: Start date
            end_date: End date
            start_field: Name of start date field
            end_field: Name of end date field
            allow_equal: Whether to allow start_date == end_date
            
        Returns:
            Tuple of (start_date, end_date)
            
        Raises:
            InvalidDateRangeError: If date range is invalid
        """
        if start_date is None or end_date is None:
            return start_date, end_date
        
        if allow_equal:
            if start_date > end_date:
                raise InvalidDateRangeError(start_field, end_field)
        else:
            if start_date >= end_date:
                raise InvalidDateRangeError(start_field, end_field)
        
        return start_date, end_date
    
    @staticmethod
    def validate_percentage(
        value: Any,
        field_name: str,
        min_value: float = 0.0,
        max_value: float = 100.0,
        allow_none: bool = False
    ) -> Optional[Decimal]:
        """
        Validate percentage value is within valid range.
        
        Args:
            value: Value to validate
            field_name: Name of the field
            min_value: Minimum allowed value
            max_value: Maximum allowed value
            allow_none: Whether None is allowed
            
        Returns:
            Decimal value
            
        Raises:
            InvalidPercentageError: If value is out of range
            MissingRequiredFieldError: If value is None and not allowed
        """
        if value is None:
            if allow_none:
                return None
            raise MissingRequiredFieldError(field_name)
        
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise InvalidInputError(field_name, "Must be a valid number", value)
        
        if decimal_value < Decimal(str(min_value)) or decimal_value > Decimal(str(max_value)):
            raise InvalidPercentageError(field_name, float(decimal_value), min_value, max_value)
        
        return decimal_value
    
    @staticmethod
    def validate_budget_components(
        capital: Decimal,
        expense: Decimal,
        total: Optional[Decimal] = None,
        tolerance: Decimal = Decimal('0.01')
    ) -> Tuple[Decimal, Decimal, Decimal]:
        """
        Validate that capital + expense = total budget.
        
        Args:
            capital: Capital budget amount
            expense: Expense budget amount
            total: Total budget (if None, calculated from capital + expense)
            tolerance: Allowed difference for rounding
            
        Returns:
            Tuple of (capital, expense, total)
            
        Raises:
            ValidationError: If budget components don't sum correctly
        """
        calculated_total = capital + expense
        
        if total is not None:
            difference = abs(calculated_total - total)
            if difference > tolerance:
                raise ValidationError(
                    "Budget components must sum to total budget",
                    field_errors=[
                        {"field": "capital_budget", "message": f"Capital: {capital}"},
                        {"field": "expense_budget", "message": f"Expense: {expense}"},
                        {"field": "total_budget", "message": f"Total: {total}, Expected: {calculated_total}"}
                    ]
                )
        else:
            total = calculated_total
        
        return capital, expense, total
    
    @staticmethod
    def validate_allocation_percentage(
        allocation: Decimal,
        field_name: str = "allocation_percentage"
    ) -> Decimal:
        """
        Validate allocation percentage is between 0 and 100.
        
        Args:
            allocation: Allocation percentage
            field_name: Name of the field
            
        Returns:
            Validated allocation percentage
            
        Raises:
            InvalidPercentageError: If allocation is out of range
        """
        return InputValidator.validate_percentage(
            allocation,
            field_name,
            min_value=0.0,
            max_value=100.0,
            allow_none=False
        )
    
    @staticmethod
    def sanitize_string(
        value: Optional[str],
        max_length: Optional[int] = None,
        strip_whitespace: bool = True,
        check_sql_injection: bool = True,
        check_xss: bool = True
    ) -> Optional[str]:
        """
        Sanitize string input for security and data quality.
        
        Args:
            value: String to sanitize
            max_length: Maximum allowed length
            strip_whitespace: Whether to strip leading/trailing whitespace
            check_sql_injection: Whether to check for SQL injection patterns
            check_xss: Whether to check for XSS patterns
            
        Returns:
            Sanitized string
            
        Raises:
            ValidationError: If string contains malicious patterns
        """
        if value is None:
            return None
        
        if not isinstance(value, str):
            value = str(value)
        
        # Strip whitespace
        if strip_whitespace:
            value = value.strip()
        
        # Check for SQL injection patterns
        if check_sql_injection:
            for pattern in InputValidator.SQL_INJECTION_PATTERNS:
                if re.search(pattern, value, re.IGNORECASE):
                    raise ValidationError(
                        "Input contains potentially malicious SQL patterns",
                        details={"pattern_matched": pattern}
                    )
        
        # Check for XSS patterns
        if check_xss:
            for pattern in InputValidator.XSS_PATTERNS:
                if re.search(pattern, value, re.IGNORECASE):
                    raise ValidationError(
                        "Input contains potentially malicious script patterns",
                        details={"pattern_matched": pattern}
                    )
        
        # Enforce max length
        if max_length and len(value) > max_length:
            raise InvalidInputError(
                "value",
                f"String exceeds maximum length of {max_length}",
                value[:50] + "..." if len(value) > 50 else value
            )
        
        return value
    
    @staticmethod
    def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> None:
        """
        Validate that all required fields are present and not None.
        
        Args:
            data: Dictionary of data to validate
            required_fields: List of required field names
            
        Raises:
            MissingRequiredFieldError: If any required field is missing
        """
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            raise ValidationError(
                f"Missing required fields: {', '.join(missing_fields)}",
                field_errors=[
                    {"field": field, "message": "This field is required"}
                    for field in missing_fields
                ]
            )
    
    @staticmethod
    def validate_positive_amount(
        value: Any,
        field_name: str,
        allow_zero: bool = True
    ) -> Decimal:
        """
        Validate that amount is positive (or zero if allowed).
        
        Args:
            value: Value to validate
            field_name: Name of the field
            allow_zero: Whether zero is allowed
            
        Returns:
            Decimal value
            
        Raises:
            InvalidInputError: If value is negative or invalid
        """
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise InvalidInputError(field_name, "Must be a valid number", value)
        
        if allow_zero:
            if decimal_value < Decimal('0'):
                raise InvalidInputError(field_name, "Must be zero or positive", value)
        else:
            if decimal_value <= Decimal('0'):
                raise InvalidInputError(field_name, "Must be positive", value)
        
        return decimal_value
    
    @staticmethod
    def validate_email(email: str, field_name: str = "email") -> str:
        """
        Validate email format.
        
        Args:
            email: Email address to validate
            field_name: Name of the field
            
        Returns:
            Validated email
            
        Raises:
            InvalidInputError: If email format is invalid
        """
        email = email.strip().lower()
        
        # Basic email regex pattern
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if not re.match(email_pattern, email):
            raise InvalidInputError(field_name, "Invalid email format", email)
        
        return email
    
    @staticmethod
    def validate_date_not_in_past(
        value: date,
        field_name: str,
        allow_today: bool = True
    ) -> date:
        """
        Validate that date is not in the past.
        
        Args:
            value: Date to validate
            field_name: Name of the field
            allow_today: Whether today's date is allowed
            
        Returns:
            Validated date
            
        Raises:
            InvalidInputError: If date is in the past
        """
        today = date.today()
        
        if allow_today:
            if value < today:
                raise InvalidInputError(field_name, "Date cannot be in the past", str(value))
        else:
            if value <= today:
                raise InvalidInputError(field_name, "Date must be in the future", str(value))
        
        return value
    
    @staticmethod
    def validate_list_not_empty(
        value: Optional[List[Any]],
        field_name: str
    ) -> List[Any]:
        """
        Validate that list is not empty.
        
        Args:
            value: List to validate
            field_name: Name of the field
            
        Returns:
            Validated list
            
        Raises:
            InvalidInputError: If list is None or empty
        """
        if value is None or len(value) == 0:
            raise InvalidInputError(field_name, "List cannot be empty", value)
        
        return value
    
    @staticmethod
    def validate_unique_list(
        value: List[Any],
        field_name: str
    ) -> List[Any]:
        """
        Validate that list contains unique values.
        
        Args:
            value: List to validate
            field_name: Name of the field
            
        Returns:
            Validated list
            
        Raises:
            ValidationError: If list contains duplicates
        """
        if len(value) != len(set(value)):
            duplicates = [item for item in value if value.count(item) > 1]
            raise ValidationError(
                f"List contains duplicate values",
                field_errors=[{
                    "field": field_name,
                    "message": "List must contain unique values",
                    "duplicates": list(set(duplicates))
                }]
            )
        
        return value


class BusinessRuleValidator:
    """Validator for business-specific rules."""
    
    @staticmethod
    def validate_project_dates_within_program(
        project_start: date,
        project_end: date,
        program_start: date,
        program_end: date
    ) -> None:
        """
        Validate that project dates fall within program dates.
        
        Args:
            project_start: Project start date
            project_end: Project end date
            program_start: Program start date
            program_end: Program end date
            
        Raises:
            ValidationError: If project dates are outside program dates
        """
        errors = []
        
        if project_start < program_start:
            errors.append({
                "field": "start_date",
                "message": f"Project start date ({project_start}) cannot be before program start date ({program_start})"
            })
        
        if project_end > program_end:
            errors.append({
                "field": "end_date",
                "message": f"Project end date ({project_end}) cannot be after program end date ({program_end})"
            })
        
        if errors:
            raise ValidationError(
                "Project dates must fall within program dates",
                field_errors=errors
            )
    
    @staticmethod
    def validate_phase_dates(
        planning_start: Optional[date],
        planning_end: Optional[date],
        execution_start: date,
        execution_end: date
    ) -> None:
        """
        Validate that planning phase precedes execution phase.
        
        Args:
            planning_start: Planning phase start date
            planning_end: Planning phase end date
            execution_start: Execution phase start date
            execution_end: Execution phase end date
            
        Raises:
            ValidationError: If phase dates are invalid
        """
        # Validate execution phase dates
        InputValidator.validate_date_range(
            execution_start,
            execution_end,
            "execution_start_date",
            "execution_end_date"
        )
        
        # If planning phase exists, validate it
        if planning_start and planning_end:
            InputValidator.validate_date_range(
                planning_start,
                planning_end,
                "planning_start_date",
                "planning_end_date"
            )
            
            # Planning must precede execution
            if planning_end >= execution_start:
                raise ValidationError(
                    "Planning phase must end before execution phase starts",
                    field_errors=[
                        {"field": "planning_end_date", "message": f"Planning ends: {planning_end}"},
                        {"field": "execution_start_date", "message": f"Execution starts: {execution_start}"}
                    ]
                )
    
    @staticmethod
    def validate_rate_temporal_validity(
        start_date: date,
        end_date: Optional[date]
    ) -> None:
        """
        Validate rate temporal validity.
        
        Args:
            start_date: Rate start date
            end_date: Rate end date (None for current rate)
            
        Raises:
            ValidationError: If dates are invalid
        """
        if end_date is not None:
            InputValidator.validate_date_range(
                start_date,
                end_date,
                "start_date",
                "end_date",
                allow_equal=True
            )
    
    @staticmethod
    def validate_assignment_within_project_dates(
        assignment_date: date,
        project_start: date,
        project_end: date
    ) -> None:
        """
        Validate that assignment date falls within project dates.
        
        Args:
            assignment_date: Assignment date
            project_start: Project start date
            project_end: Project end date
            
        Raises:
            ValidationError: If assignment date is outside project dates
        """
        if assignment_date < project_start or assignment_date > project_end:
            raise ValidationError(
                f"Assignment date ({assignment_date}) must be within project dates ({project_start} to {project_end})",
                field_errors=[{
                    "field": "assignment_date",
                    "message": f"Must be between {project_start} and {project_end}"
                }]
            )


# Create singleton instances
input_validator = InputValidator()
business_rule_validator = BusinessRuleValidator()
