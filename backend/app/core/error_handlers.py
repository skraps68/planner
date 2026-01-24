"""
Global error handlers for FastAPI application.

This module provides centralized error handling for all exceptions,
converting them to standardized JSON responses with appropriate HTTP status codes.
"""
import logging
import traceback
import uuid
from typing import Union

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlalchemy.exc import OperationalError as SQLAlchemyOperationalError

from app.core.exceptions import (
    AppException,
    AuthenticationError,
    AuthorizationError,
    BusinessRuleViolationError,
    DatabaseError,
    ResourceNotFoundError,
    ScopeAccessDeniedError,
    ValidationError,
)

# Configure logger
logger = logging.getLogger(__name__)


def create_error_response(
    status_code: int,
    message: str,
    error_code: str = "ERROR",
    details: dict = None,
    request_id: str = None
) -> JSONResponse:
    """
    Create standardized error response.
    
    Args:
        status_code: HTTP status code
        message: Error message
        error_code: Application error code
        details: Additional error details
        request_id: Request ID for tracking
        
    Returns:
        JSONResponse with error details
    """
    content = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        }
    }
    
    if details:
        content["error"]["details"] = details
    
    if request_id:
        content["request_id"] = request_id
    
    return JSONResponse(
        status_code=status_code,
        content=content
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    Handle custom application exceptions.
    
    Args:
        request: HTTP request
        exc: Application exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    # Log error details
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
    
    return create_error_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details,
        request_id=request_id
    )


async def authentication_error_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
    """
    Handle authentication errors with specific logging.
    
    Args:
        request: HTTP request
        exc: Authentication exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    # Log authentication failure
    logger.warning(
        f"Authentication failed: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else None,
            "error_code": exc.error_code
        }
    )
    
    return create_error_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details,
        request_id=request_id
    )


async def authorization_error_handler(request: Request, exc: AuthorizationError) -> JSONResponse:
    """
    Handle authorization errors with audit logging.
    
    Args:
        request: HTTP request
        exc: Authorization exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    # Extract user info if available
    user_id = getattr(request.state, "user_id", None)
    
    # Log authorization failure for audit
    logger.warning(
        f"Authorization denied: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "user_id": str(user_id) if user_id else None,
            "error_code": exc.error_code,
            "details": exc.details
        }
    )
    
    return create_error_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details,
        request_id=request_id
    )


async def scope_access_denied_handler(request: Request, exc: ScopeAccessDeniedError) -> JSONResponse:
    """
    Handle scope-based access denial with detailed logging.
    
    Args:
        request: HTTP request
        exc: Scope access denied exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    # Extract user info if available
    user_id = getattr(request.state, "user_id", None)
    
    # Log scope violation for security audit
    logger.warning(
        f"Scope access denied: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "user_id": str(user_id) if user_id else None,
            "resource_type": exc.details.get("resource_type"),
            "resource_id": exc.details.get("resource_id"),
            "error_code": exc.error_code
        }
    )
    
    return create_error_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details,
        request_id=request_id
    )


async def validation_error_handler(
    request: Request,
    exc: Union[ValidationError, RequestValidationError, PydanticValidationError]
) -> JSONResponse:
    """
    Handle validation errors from Pydantic and custom validators.
    
    Args:
        request: HTTP request
        exc: Validation exception
        
    Returns:
        JSON error response with field-level errors
    """
    request_id = str(uuid.uuid4())
    
    # Handle custom ValidationError
    if isinstance(exc, ValidationError):
        logger.info(
            f"Validation error: {exc.message}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "details": exc.details
            }
        )
        
        return create_error_response(
            status_code=exc.status_code,
            message=exc.message,
            error_code=exc.error_code,
            details=exc.details,
            request_id=request_id
        )
    
    # Handle Pydantic RequestValidationError
    if isinstance(exc, RequestValidationError):
        errors = []
        for error in exc.errors():
            field_path = " -> ".join(str(loc) for loc in error["loc"])
            errors.append({
                "field": field_path,
                "message": error["msg"],
                "type": error["type"]
            })
        
        logger.info(
            "Request validation failed",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "errors": errors
            }
        )
        
        return create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Request validation failed",
            error_code="VALIDATION_ERROR",
            details={"field_errors": errors},
            request_id=request_id
        )
    
    # Handle generic Pydantic ValidationError
    logger.info(
        "Validation error",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "error": str(exc)
        }
    )
    
    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message="Validation failed",
        error_code="VALIDATION_ERROR",
        details={"error": str(exc)},
        request_id=request_id
    )


async def business_rule_violation_handler(
    request: Request,
    exc: BusinessRuleViolationError
) -> JSONResponse:
    """
    Handle business rule violations.
    
    Args:
        request: HTTP request
        exc: Business rule violation exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    logger.info(
        f"Business rule violation: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "rule_code": exc.details.get("rule_code"),
            "details": exc.details
        }
    )
    
    return create_error_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details,
        request_id=request_id
    )


async def resource_not_found_handler(request: Request, exc: ResourceNotFoundError) -> JSONResponse:
    """
    Handle resource not found errors.
    
    Args:
        request: HTTP request
        exc: Resource not found exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    logger.info(
        f"Resource not found: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "resource_type": exc.details.get("resource_type"),
            "resource_id": exc.details.get("resource_id")
        }
    )
    
    return create_error_response(
        status_code=exc.status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details,
        request_id=request_id
    )


async def database_error_handler(request: Request, exc: DatabaseError) -> JSONResponse:
    """
    Handle database errors.
    
    Args:
        request: HTTP request
        exc: Database exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    logger.error(
        f"Database error: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "details": exc.details
        }
    )
    
    return create_error_response(
        status_code=exc.status_code,
        message="A database error occurred",
        error_code=exc.error_code,
        details={"error_type": exc.details.get("error_type")},
        request_id=request_id
    )


async def sqlalchemy_integrity_error_handler(
    request: Request,
    exc: SQLAlchemyIntegrityError
) -> JSONResponse:
    """
    Handle SQLAlchemy integrity constraint violations.
    
    Args:
        request: HTTP request
        exc: SQLAlchemy integrity error
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    logger.error(
        f"Database integrity error: {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "error": str(exc)
        }
    )
    
    # Parse constraint name if available
    error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
    
    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message="Database constraint violation",
        error_code="INTEGRITY_ERROR",
        details={"error": "A database constraint was violated. This may be due to duplicate data or invalid references."},
        request_id=request_id
    )


async def sqlalchemy_operational_error_handler(
    request: Request,
    exc: SQLAlchemyOperationalError
) -> JSONResponse:
    """
    Handle SQLAlchemy operational errors (connection issues, etc.).
    
    Args:
        request: HTTP request
        exc: SQLAlchemy operational error
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    logger.error(
        f"Database operational error: {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "error": str(exc)
        }
    )
    
    return create_error_response(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        message="Database service temporarily unavailable",
        error_code="DATABASE_UNAVAILABLE",
        details={"error_type": "OPERATIONAL_ERROR"},
        request_id=request_id
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions.
    
    Args:
        request: HTTP request
        exc: Generic exception
        
    Returns:
        JSON error response
    """
    request_id = str(uuid.uuid4())
    
    # Log full traceback for debugging
    logger.error(
        f"Unexpected error: {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc()
        }
    )
    
    # Don't expose internal error details to client
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message="An unexpected error occurred",
        error_code="INTERNAL_SERVER_ERROR",
        details={"error_type": type(exc).__name__},
        request_id=request_id
    )


def register_error_handlers(app):
    """
    Register all error handlers with FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    # Custom application exceptions
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(AuthenticationError, authentication_error_handler)
    app.add_exception_handler(AuthorizationError, authorization_error_handler)
    app.add_exception_handler(ScopeAccessDeniedError, scope_access_denied_handler)
    app.add_exception_handler(ValidationError, validation_error_handler)
    app.add_exception_handler(BusinessRuleViolationError, business_rule_violation_handler)
    app.add_exception_handler(ResourceNotFoundError, resource_not_found_handler)
    app.add_exception_handler(DatabaseError, database_error_handler)
    
    # Pydantic validation errors
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(PydanticValidationError, validation_error_handler)
    
    # SQLAlchemy errors
    app.add_exception_handler(SQLAlchemyIntegrityError, sqlalchemy_integrity_error_handler)
    app.add_exception_handler(SQLAlchemyOperationalError, sqlalchemy_operational_error_handler)
    
    # Catch-all for unexpected errors
    app.add_exception_handler(Exception, generic_exception_handler)
