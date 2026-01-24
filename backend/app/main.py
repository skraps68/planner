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

# Add rate limiting middleware (100 requests per minute per IP)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, window_seconds=60)

# Add audit logging middleware
app.add_middleware(AuditLoggingMiddleware)

# Set up CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
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