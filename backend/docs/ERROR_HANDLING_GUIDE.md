# Error Handling and Validation Guide

## Overview

This guide documents the comprehensive error handling and validation system implemented in the application. The system provides structured error responses, custom exception classes, input validation, and security measures.

## Architecture

### Components

1. **Custom Exceptions** (`app/core/exceptions.py`)
   - Hierarchical exception classes for different error types
   - Consistent error codes and HTTP status codes
   - Detailed error information with context

2. **Error Handlers** (`app/core/error_handlers.py`)
   - Global exception handlers registered with FastAPI
   - Standardized JSON error responses
   - Comprehensive logging for debugging and auditing

3. **Input Validators** (`app/core/validators.py`)
   - Input validation and sanitization utilities
   - Business rule validation
   - Security checks (SQL injection, XSS prevention)

4. **Updated Dependencies** (`app/api/deps.py`)
   - Authentication and authorization dependencies using custom exceptions
   - Scope validation with proper error handling

5. **Updated Middleware** (`app/api/middleware.py`)
   - Security headers, rate limiting, and audit logging
   - Permission decorators using custom exceptions

## Custom Exception Classes

### Base Exception

```python
from app.core.exceptions import AppException

# All custom exceptions inherit from AppException
raise AppException(
    message="Something went wrong",
    status_code=500,
    error_code="CUSTOM_ERROR",
    details={"key": "value"}
)
```

### Authentication Exceptions

```python
from app.core.exceptions import (
    AuthenticationError,
    InvalidCredentialsError,
    TokenExpiredError,
    InvalidTokenError
)

# Generic authentication error
raise AuthenticationError("Authentication failed")

# Specific authentication errors
raise InvalidCredentialsError()  # 401
raise TokenExpiredError()  # 401
raise InvalidTokenError()  # 401
```

### Authorization Exceptions

```python
from app.core.exceptions import (
    AuthorizationError,
    ScopeAccessDeniedError,
    InsufficientPermissionsError
)

# Generic authorization error
raise AuthorizationError("Insufficient permissions")

# Scope-based access denial
raise ScopeAccessDeniedError("Program", program_id)

# Permission-based denial
raise InsufficientPermissionsError(
    required_permissions=["read:program", "write:program"]
)
```

### Validation Exceptions

```python
from app.core.exceptions import (
    ValidationError,
    InvalidInputError,
    InvalidDateRangeError,
    InvalidPercentageError,
    InvalidUUIDError,
    MissingRequiredFieldError
)

# Generic validation error
raise ValidationError(
    "Validation failed",
    field_errors=[
        {"field": "email", "message": "Invalid format"}
    ]
)

# Specific validation errors
raise InvalidInputError("email", "Invalid format", "not-an-email")
raise InvalidDateRangeError("start_date", "end_date")
raise InvalidPercentageError("allocation", 150.0)
raise InvalidUUIDError("project_id", "not-a-uuid")
raise MissingRequiredFieldError("name")
```

### Business Rule Exceptions

```python
from app.core.exceptions import (
    BusinessRuleViolationError,
    BudgetValidationError,
    AllocationConflictError,
    PhaseValidationError,
    RateNotFoundError,
    DuplicateResourceError
)

# Generic business rule violation
raise BusinessRuleViolationError(
    "Budget exceeded",
    rule_code="BUDGET_LIMIT"
)

# Specific business rule violations
raise AllocationConflictError(resource_id, "2024-01-15", 120.0)
raise RateNotFoundError(worker_type_id, "2024-01-15")
raise DuplicateResourceError("Worker", "EMP001")
```

### Resource Not Found Exceptions

```python
from app.core.exceptions import (
    ResourceNotFoundError,
    ProgramNotFoundError,
    ProjectNotFoundError,
    WorkerNotFoundError,
    UserNotFoundError
)

# Generic resource not found
raise ResourceNotFoundError("CustomEntity", resource_id=entity_id)

# Specific resource not found
raise ProgramNotFoundError(program_id)
raise ProjectNotFoundError(project_id)
raise WorkerNotFoundError(worker_id=worker_id)
raise WorkerNotFoundError(external_id="EMP001")
raise UserNotFoundError(username="john.doe")
```

### Import Exceptions

```python
from app.core.exceptions import (
    ImportError as ImportException,
    CSVParsingError,
    ImportValidationError
)

# Generic import error
raise ImportException(
    "Import failed",
    row_errors=[
        {"row": 1, "error": "Invalid data"}
    ]
)

# Specific import errors
raise CSVParsingError("Invalid CSV format", line_number=5)
raise ImportValidationError(
    "Validation failed",
    row_errors=[...]
)
```

## Input Validation

### Using InputValidator

```python
from app.core.validators import InputValidator

# Validate UUID
program_id = InputValidator.validate_uuid(program_id_str, "program_id")

# Validate date range
start, end = InputValidator.validate_date_range(
    start_date,
    end_date,
    allow_equal=False
)

# Validate percentage
allocation = InputValidator.validate_percentage(
    value,
    "allocation_percentage",
    min_value=0.0,
    max_value=100.0
)

# Validate budget components
capital, expense, total = InputValidator.validate_budget_components(
    capital_budget,
    expense_budget,
    total_budget
)

# Sanitize string input
clean_text = InputValidator.sanitize_string(
    user_input,
    max_length=255,
    check_sql_injection=True,
    check_xss=True
)

# Validate required fields
InputValidator.validate_required_fields(
    data,
    ["name", "email", "start_date"]
)

# Validate positive amount
amount = InputValidator.validate_positive_amount(
    value,
    "budget",
    allow_zero=True
)

# Validate email
email = InputValidator.validate_email(email_str)
```

### Using BusinessRuleValidator

```python
from app.core.validators import BusinessRuleValidator

# Validate project dates within program
BusinessRuleValidator.validate_project_dates_within_program(
    project_start,
    project_end,
    program_start,
    program_end
)

# Validate phase dates
BusinessRuleValidator.validate_phase_dates(
    planning_start,
    planning_end,
    execution_start,
    execution_end
)

# Validate assignment within project dates
BusinessRuleValidator.validate_assignment_within_project_dates(
    assignment_date,
    project_start,
    project_end
)
```

## Error Response Format

All errors return a standardized JSON response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field_errors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "value": "not-an-email"
        }
      ],
      "additional_context": "value"
    }
  },
  "request_id": "uuid-for-tracking"
}
```

### HTTP Status Codes

- **400 Bad Request**: Invalid input or malformed request
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Insufficient permissions or scope access denied
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation errors or business rule violations
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server errors
- **503 Service Unavailable**: External service or database unavailable

## Using Custom Exceptions in Services

### Example: Actuals Service

```python
from app.core.exceptions import (
    ProjectNotFoundError,
    WorkerNotFoundError,
    RateNotFoundError,
    AllocationConflictError,
    BusinessRuleViolationError
)

def create_actual(db, project_id, worker_id, ...):
    # Validate project exists
    project = project_repository.get(db, project_id)
    if not project:
        raise ProjectNotFoundError(project_id)
    
    # Validate worker exists
    worker = worker_repository.get(db, worker_id)
    if not worker:
        raise WorkerNotFoundError(worker_id=worker_id)
    
    # Validate allocation
    if total_allocation > 100:
        raise AllocationConflictError(
            worker_id,
            str(date),
            total_allocation
        )
    
    # Validate rate exists
    rate = rate_repository.get_active_rate(db, worker_type_id, date)
    if not rate:
        raise RateNotFoundError(worker_type_id, str(date))
    
    # Business rule validation
    if worker.name != provided_name:
        raise BusinessRuleViolationError(
            f"Worker name mismatch",
            rule_code="WORKER_NAME_MISMATCH"
        )
```

## Using Custom Exceptions in API Endpoints

### Example: Program Endpoint

```python
from fastapi import APIRouter, Depends
from app.api.deps import get_current_active_user, check_program_access
from app.core.exceptions import ProgramNotFoundError

@router.get("/{program_id}")
async def get_program(
    program_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Scope validation happens in dependency
    # Exceptions are automatically handled by global error handlers
    
    program = program_repository.get(db, program_id)
    if not program:
        raise ProgramNotFoundError(program_id)
    
    return program
```

## Security Features

### SQL Injection Prevention

The `InputValidator.sanitize_string()` method checks for common SQL injection patterns:

```python
# These will raise ValidationError
InputValidator.sanitize_string("SELECT * FROM users")
InputValidator.sanitize_string("'; DROP TABLE users; --")
InputValidator.sanitize_string("1' OR '1'='1")
```

### XSS Prevention

The sanitizer also checks for XSS patterns:

```python
# These will raise ValidationError
InputValidator.sanitize_string("<script>alert('xss')</script>")
InputValidator.sanitize_string("javascript:alert('xss')")
InputValidator.sanitize_string("<iframe src='evil.com'>")
```

### Rate Limiting

Rate limiting is enforced at the middleware level:

- Default: 100 requests per minute per IP
- Returns 429 status code when exceeded
- Includes `Retry-After` header

## Logging and Monitoring

### Error Logging

All errors are logged with appropriate context:

```python
logger.error(
    f"Application error: {exc.error_code} - {exc.message}",
    extra={
        "request_id": request_id,
        "path": request.url.path,
        "method": request.method,
        "error_code": exc.error_code,
        "status_code": exc.status_code,
        "details": exc.details
    }
)
```

### Audit Logging

Authorization failures are logged for security auditing:

```python
logger.warning(
    f"Authorization denied: {exc.message}",
    extra={
        "request_id": request_id,
        "user_id": str(user_id),
        "resource_type": exc.details.get("resource_type"),
        "resource_id": exc.details.get("resource_id")
    }
)
```

## Testing

### Testing Custom Exceptions

```python
import pytest
from app.core.exceptions import ProjectNotFoundError

def test_project_not_found():
    project_id = uuid4()
    
    with pytest.raises(ProjectNotFoundError):
        service.get_project(db, project_id)
```

### Testing Validation

```python
from app.core.validators import InputValidator
from app.core.exceptions import InvalidPercentageError

def test_invalid_percentage():
    with pytest.raises(InvalidPercentageError):
        InputValidator.validate_percentage(150, "allocation")
```

## Best Practices

1. **Use Specific Exceptions**: Always use the most specific exception class available
2. **Provide Context**: Include relevant details in exception details dictionary
3. **Don't Catch and Re-raise Generic Exceptions**: Let custom exceptions propagate to global handlers
4. **Validate Early**: Validate input at the service layer before processing
5. **Log Appropriately**: Use appropriate log levels (error, warning, info)
6. **Test Error Paths**: Write tests for error conditions, not just happy paths
7. **Document Error Codes**: Keep error codes consistent and documented
8. **Use Validators**: Leverage the validation utilities for consistent validation logic

## Migration Guide

### Updating Existing Code

To update existing code to use the new error handling system:

1. **Replace HTTPException with Custom Exceptions**:
   ```python
   # Old
   raise HTTPException(status_code=404, detail="Project not found")
   
   # New
   raise ProjectNotFoundError(project_id)
   ```

2. **Remove Try-Catch Blocks for Custom Exceptions**:
   ```python
   # Old
   try:
       result = service.do_something()
   except CustomServiceError as e:
       raise HTTPException(status_code=400, detail=str(e))
   
   # New
   result = service.do_something()  # Let exception propagate
   ```

3. **Use Validators for Input Validation**:
   ```python
   # Old
   if not isinstance(program_id, UUID):
       raise HTTPException(status_code=400, detail="Invalid UUID")
   
   # New
   program_id = InputValidator.validate_uuid(program_id, "program_id")
   ```

## Summary

The error handling and validation system provides:

- ✅ Consistent error responses across the API
- ✅ Detailed error information for debugging
- ✅ Security measures (SQL injection, XSS prevention)
- ✅ Comprehensive logging and auditing
- ✅ Type-safe exception handling
- ✅ Easy-to-use validation utilities
- ✅ Scope-aware authorization errors
- ✅ Business rule validation
- ✅ Extensive test coverage

For more information, see:
- `app/core/exceptions.py` - Exception class definitions
- `app/core/error_handlers.py` - Global error handlers
- `app/core/validators.py` - Validation utilities
- `tests/unit/test_error_handlers.py` - Exception tests
- `tests/unit/test_validators.py` - Validator tests
