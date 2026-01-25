"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.api.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    AuditLoggingMiddleware
)
from app.core.config import settings
from app.core.error_handlers import register_error_handlers

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Program and Project Management System API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Register global error handlers
register_error_handlers(app)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiting middleware (disabled in test/development environments)
# In production: 100 requests per minute per IP
# In development/test: 10000 requests per minute (effectively unlimited)
rate_limit = 10000 if settings.ENVIRONMENT in ["development", "test"] else 100
app.add_middleware(RateLimitMiddleware, requests_per_minute=rate_limit, window_seconds=60)

# Add audit logging middleware
app.add_middleware(AuditLoggingMiddleware)

# Set up CORS middleware
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "message": "Program and Project Management System API",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}