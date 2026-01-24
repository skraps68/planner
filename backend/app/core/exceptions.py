"""
Custom exception classes for the application.

This module defines all custom exceptions used throughout the application,
providing structured error handling with proper HTTP status codes and messages.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID


class AppException(Exception):
    """
    Base exception class for all application exceptions.
    
    Attributes:
        message: Human-readable error message
        status_code: HTTP status code
        error_code: Application-specific error code
        details: Additional error details
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)


# Authentication and Authorization Exceptions

class AuthenticationError(AppException):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=401, error_code="AUTH_FAILED", details=details)


class InvalidCredentialsError(AuthenticationError):
    """Raised when credentials are invalid."""
    
    def __init__(self, message: str = "Invalid username or password"):
        super().__init__(message, details={"error_code": "INVALID_CREDENTIALS"})


class TokenExpiredError(AuthenticationError):
    """Raised when JWT token has expired."""
    
    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, details={"error_code": "TOKEN_EXPIRED"})


class InvalidTokenError(AuthenticationError):
    """Raised when JWT token is invalid."""
    
    def __init__(self, message: str = "Invalid token"):
        super().__init__(message, details={"error_code": "INVALID_TOKEN"})


class AuthorizationError(AppException):
    """Raised when user lacks required permissions."""
    
    def __init__(
        self,
        message: str = "Insufficient permissions",
        required_permissions: Optional[List[str]] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        if required_permissions:
            error_details["required_permissions"] = required_permissions
        super().__init__(message, status_code=403, error_code="FORBIDDEN", details=error_details)


class ScopeAccessDeniedError(AuthorizationError):
    """Raised when user attempts to access resource outside their scope."""
    
    def __init__(
        self,
        resource_type: str,
        resource_id: UUID,
        message: Optional[str] = None
    ):
        msg = message or f"Access denied to {resource_type}"
        super().__init__(
            msg,
            details={
                "error_code": "SCOPE_ACCESS_DENIED",
                "resource_type": resource_type,
                "resource_id": str(resource_id)
            }
        )


class InsufficientPermissionsError(AuthorizationError):
    """Raised when user lacks specific permissions for an action."""
    
    def __init__(self, required_permissions: List[str], message: Optional[str] = None):
        msg = message or f"Required permissions: {', '.join(required_permissions)}"
        super().__init__(msg, required_permissions=required_permissions)


# Validation Exceptions

class ValidationError(AppException):
    """Raised when input validation fails."""
    
    def __init__(
        self,
        message: str = "Validation failed",
        field_errors: Optional[List[Dict[str, Any]]] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        if field_errors:
            error_details["field_errors"] = field_errors
        super().__init__(message, status_code=422, error_code="VALIDATION_ERROR", details=error_details)


class InvalidInputError(ValidationError):
    """Raised when input data is invalid."""
    
    def __init__(self, field: str, message: str, value: Any = None):
        field_errors = [{
            "field": field,
            "message": message,
            "value": value
        }]
        super().__init__(f"Invalid input for field '{field}': {message}", field_errors=field_errors)


class MissingRequiredFieldError(ValidationError):
    """Raised when required field is missing."""
    
    def __init__(self, field: str):
        field_errors = [{
            "field": field,
            "message": f"Field '{field}' is required"
        }]
        super().__init__(f"Missing required field: {field}", field_errors=field_errors)


class InvalidDateRangeError(ValidationError):
    """Raised when date range is invalid (start > end)."""
    
    def __init__(self, start_field: str = "start_date", end_field: str = "end_date"):
        field_errors = [
            {"field": start_field, "message": "Start date must be before end date"},
            {"field": end_field, "message": "End date must be after start date"}
        ]
        super().__init__("Invalid date range", field_errors=field_errors)


class InvalidPercentageError(ValidationError):
    """Raised when percentage value is out of valid range."""
    
    def __init__(self, field: str, value: float, min_val: float = 0.0, max_val: float = 100.0):
        message = f"Percentage must be between {min_val} and {max_val}, got {value}"
        super().__init__(message, field_errors=[{"field": field, "message": message, "value": value}])


class InvalidUUIDError(ValidationError):
    """Raised when UUID format is invalid."""
    
    def __init__(self, field: str, value: str):
        message = f"Invalid UUID format: {value}"
        super().__init__(message, field_errors=[{"field": field, "message": message, "value": value}])


# Business Rule Exceptions

class BusinessRuleViolationError(AppException):
    """Raised when business rule is violated."""
    
    def __init__(
        self,
        message: str,
        rule_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        if rule_code:
            error_details["rule_code"] = rule_code
        super().__init__(message, status_code=422, error_code="BUSINESS_RULE_VIOLATION", details=error_details)


class BudgetValidationError(BusinessRuleViolationError):
    """Raised when budget validation fails."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, rule_code="BUDGET_VALIDATION_FAILED", details=details)


class AllocationConflictError(BusinessRuleViolationError):
    """Raised when resource allocation exceeds 100%."""
    
    def __init__(
        self,
        resource_id: UUID,
        date: str,
        total_allocation: float,
        message: Optional[str] = None
    ):
        msg = message or f"Resource allocation exceeds 100% on {date}"
        super().__init__(
            msg,
            rule_code="ALLOCATION_CONFLICT",
            details={
                "resource_id": str(resource_id),
                "date": date,
                "total_allocation": total_allocation,
                "max_allocation": 100.0
            }
        )


class PhaseValidationError(BusinessRuleViolationError):
    """Raised when project phase validation fails."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, rule_code="PHASE_VALIDATION_FAILED", details=details)


class RateNotFoundError(BusinessRuleViolationError):
    """Raised when no valid rate is found for a date."""
    
    def __init__(self, worker_type_id: UUID, date: str):
        super().__init__(
            f"No valid rate found for worker type on {date}",
            rule_code="RATE_NOT_FOUND",
            details={
                "worker_type_id": str(worker_type_id),
                "date": date
            }
        )


class DuplicateResourceError(BusinessRuleViolationError):
    """Raised when attempting to create duplicate resource."""
    
    def __init__(self, resource_type: str, identifier: str):
        super().__init__(
            f"Duplicate {resource_type} with identifier: {identifier}",
            rule_code="DUPLICATE_RESOURCE",
            details={
                "resource_type": resource_type,
                "identifier": identifier
            }
        )


# Resource Not Found Exceptions

class ResourceNotFoundError(AppException):
    """Raised when requested resource is not found."""
    
    def __init__(
        self,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        identifier: Optional[str] = None,
        message: Optional[str] = None
    ):
        if message:
            msg = message
        elif resource_id:
            msg = f"{resource_type} with ID {resource_id} not found"
        elif identifier:
            msg = f"{resource_type} with identifier '{identifier}' not found"
        else:
            msg = f"{resource_type} not found"
        
        details = {"resource_type": resource_type}
        if resource_id:
            details["resource_id"] = str(resource_id)
        if identifier:
            details["identifier"] = identifier
        
        super().__init__(msg, status_code=404, error_code="RESOURCE_NOT_FOUND", details=details)


class ProgramNotFoundError(ResourceNotFoundError):
    """Raised when program is not found."""
    
    def __init__(self, program_id: UUID):
        super().__init__("Program", resource_id=program_id)


class ProjectNotFoundError(ResourceNotFoundError):
    """Raised when project is not found."""
    
    def __init__(self, project_id: UUID):
        super().__init__("Project", resource_id=project_id)


class ResourceEntityNotFoundError(ResourceNotFoundError):
    """Raised when resource entity is not found."""
    
    def __init__(self, resource_id: UUID):
        super().__init__("Resource", resource_id=resource_id)


class WorkerNotFoundError(ResourceNotFoundError):
    """Raised when worker is not found."""
    
    def __init__(self, worker_id: Optional[UUID] = None, external_id: Optional[str] = None):
        if external_id:
            super().__init__("Worker", identifier=external_id)
        else:
            super().__init__("Worker", resource_id=worker_id)


class UserNotFoundError(ResourceNotFoundError):
    """Raised when user is not found."""
    
    def __init__(self, user_id: Optional[UUID] = None, username: Optional[str] = None):
        if username:
            super().__init__("User", identifier=username)
        else:
            super().__init__("User", resource_id=user_id)


class AssignmentNotFoundError(ResourceNotFoundError):
    """Raised when resource assignment is not found."""
    
    def __init__(self, assignment_id: UUID):
        super().__init__("ResourceAssignment", resource_id=assignment_id)


# Data Import Exceptions

class ImportError(AppException):
    """Raised when data import fails."""
    
    def __init__(
        self,
        message: str = "Import failed",
        row_errors: Optional[List[Dict[str, Any]]] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        if row_errors:
            error_details["row_errors"] = row_errors
        super().__init__(message, status_code=422, error_code="IMPORT_ERROR", details=error_details)


class CSVParsingError(ImportError):
    """Raised when CSV parsing fails."""
    
    def __init__(self, message: str, line_number: Optional[int] = None):
        details = {"error_type": "CSV_PARSING_ERROR"}
        if line_number:
            details["line_number"] = line_number
        super().__init__(f"CSV parsing error: {message}", details=details)


class ImportValidationError(ImportError):
    """Raised when import data validation fails."""
    
    def __init__(self, message: str, row_errors: List[Dict[str, Any]]):
        super().__init__(f"Import validation failed: {message}", row_errors=row_errors)


# Database Exceptions

class DatabaseError(AppException):
    """Raised when database operation fails."""
    
    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, error_code="DATABASE_ERROR", details=details)


class IntegrityError(DatabaseError):
    """Raised when database integrity constraint is violated."""
    
    def __init__(self, message: str, constraint: Optional[str] = None):
        details = {"error_type": "INTEGRITY_ERROR"}
        if constraint:
            details["constraint"] = constraint
        super().__init__(f"Database integrity error: {message}", details=details)


class ConcurrencyError(DatabaseError):
    """Raised when concurrent modification conflict occurs."""
    
    def __init__(self, resource_type: str, resource_id: UUID):
        super().__init__(
            f"Concurrent modification detected for {resource_type}",
            details={
                "error_type": "CONCURRENCY_ERROR",
                "resource_type": resource_type,
                "resource_id": str(resource_id)
            }
        )


# External Service Exceptions

class ExternalServiceError(AppException):
    """Raised when external service call fails."""
    
    def __init__(
        self,
        service_name: str,
        message: str = "External service error",
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        error_details["service_name"] = service_name
        super().__init__(message, status_code=503, error_code="EXTERNAL_SERVICE_ERROR", details=error_details)


class CacheServiceError(ExternalServiceError):
    """Raised when cache service operation fails."""
    
    def __init__(self, message: str = "Cache service error"):
        super().__init__("Redis", message)


# Configuration Exceptions

class ConfigurationError(AppException):
    """Raised when configuration is invalid or missing."""
    
    def __init__(self, message: str, config_key: Optional[str] = None):
        details = {"error_type": "CONFIGURATION_ERROR"}
        if config_key:
            details["config_key"] = config_key
        super().__init__(message, status_code=500, error_code="CONFIGURATION_ERROR", details=details)
