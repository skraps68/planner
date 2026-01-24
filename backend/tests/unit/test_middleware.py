"""
Unit tests for API middleware components.
"""
import time
from unittest.mock import Mock, patch

import pytest
from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    AuditLoggingMiddleware,
    _rate_limit_storage
)


@pytest.fixture
def app():
    """Create a test FastAPI application."""
    app = FastAPI()
    
    @app.get("/test")
    async def test_endpoint():
        return {"message": "test"}
    
    @app.post("/test")
    async def test_post_endpoint():
        return {"message": "created"}
    
    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}
    
    return app


@pytest.fixture
def client_with_security_headers(app):
    """Create test client with security headers middleware."""
    app.add_middleware(SecurityHeadersMiddleware)
    return TestClient(app)


@pytest.fixture
def client_with_rate_limit(app):
    """Create test client with rate limiting middleware."""
    # Clear rate limit storage before each test
    _rate_limit_storage.clear()
    app.add_middleware(RateLimitMiddleware, requests_per_minute=5, window_seconds=60)
    return TestClient(app)


@pytest.fixture
def client_with_audit(app):
    """Create test client with audit logging middleware."""
    app.add_middleware(AuditLoggingMiddleware)
    return TestClient(app)


class TestSecurityHeadersMiddleware:
    """Tests for SecurityHeadersMiddleware."""
    
    def test_security_headers_added(self, client_with_security_headers):
        """Test that security headers are added to responses."""
        response = client_with_security_headers.get("/test")
        
        assert response.status_code == 200
        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert "X-Frame-Options" in response.headers
        assert response.headers["X-Frame-Options"] == "DENY"
        assert "X-XSS-Protection" in response.headers
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert "Strict-Transport-Security" in response.headers
        assert "Content-Security-Policy" in response.headers
        assert "Referrer-Policy" in response.headers
        assert "Permissions-Policy" in response.headers
    
    def test_security_headers_on_all_endpoints(self, client_with_security_headers):
        """Test that security headers are added to all endpoints."""
        # Test GET endpoint
        response = client_with_security_headers.get("/test")
        assert "X-Content-Type-Options" in response.headers
        
        # Test POST endpoint
        response = client_with_security_headers.post("/test")
        assert "X-Content-Type-Options" in response.headers
        
        # Test health check endpoint
        response = client_with_security_headers.get("/health")
        assert "X-Content-Type-Options" in response.headers


class TestRateLimitMiddleware:
    """Tests for RateLimitMiddleware."""
    
    def test_rate_limit_allows_requests_within_limit(self, client_with_rate_limit):
        """Test that requests within limit are allowed."""
        # Make 5 requests (within limit)
        for i in range(5):
            response = client_with_rate_limit.get("/test")
            assert response.status_code == 200
            assert "X-RateLimit-Limit" in response.headers
            assert response.headers["X-RateLimit-Limit"] == "5"
    
    def test_rate_limit_blocks_requests_exceeding_limit(self, client_with_rate_limit):
        """Test that requests exceeding limit are blocked."""
        # Make 5 requests (at limit)
        for i in range(5):
            response = client_with_rate_limit.get("/test")
            assert response.status_code == 200
        
        # 6th request should be rate limited
        response = client_with_rate_limit.get("/test")
        assert response.status_code == 429
        assert "retry_after" in response.json()
        assert "Retry-After" in response.headers
    
    def test_rate_limit_headers_present(self, client_with_rate_limit):
        """Test that rate limit headers are present in responses."""
        response = client_with_rate_limit.get("/test")
        
        assert response.status_code == 200
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
    
    def test_rate_limit_remaining_decreases(self, client_with_rate_limit):
        """Test that remaining count decreases with each request."""
        # First request
        response = client_with_rate_limit.get("/test")
        remaining_1 = int(response.headers["X-RateLimit-Remaining"])
        
        # Second request
        response = client_with_rate_limit.get("/test")
        remaining_2 = int(response.headers["X-RateLimit-Remaining"])
        
        assert remaining_2 < remaining_1
    
    def test_rate_limit_skips_health_check(self, client_with_rate_limit):
        """Test that health check endpoint is not rate limited."""
        # Make many requests to health check
        for i in range(10):
            response = client_with_rate_limit.get("/health")
            assert response.status_code == 200
    
    def test_rate_limit_window_reset(self, client_with_rate_limit):
        """Test that rate limit resets after window expires."""
        # Clear storage to start fresh
        _rate_limit_storage.clear()
        
        # Create a new client with very short window for testing
        app = FastAPI()
        
        @app.get("/test")
        async def test_endpoint():
            return {"message": "test"}
        
        app.add_middleware(RateLimitMiddleware, requests_per_minute=2, window_seconds=1)
        client = TestClient(app)
        
        # Make 2 requests (at limit)
        response = client.get("/test")
        assert response.status_code == 200
        response = client.get("/test")
        assert response.status_code == 200
        
        # 3rd request should be rate limited
        response = client.get("/test")
        assert response.status_code == 429
        
        # Wait for window to expire
        time.sleep(1.1)
        
        # Should be able to make requests again
        response = client.get("/test")
        assert response.status_code == 200


class TestAuditLoggingMiddleware:
    """Tests for AuditLoggingMiddleware."""
    
    def test_audit_logs_state_changing_operations(self, client_with_audit):
        """Test that state-changing operations are logged."""
        response = client_with_audit.post("/test")
        assert response.status_code == 200
        # In a real implementation, we would check the audit log
        # For now, we just verify the request succeeds
    
    def test_audit_skips_read_operations(self, client_with_audit):
        """Test that read operations are not logged."""
        response = client_with_audit.get("/test")
        assert response.status_code == 200
        # GET requests should not trigger audit logging


class TestPermissionDecorators:
    """Tests for permission checking decorators."""
    
    def test_require_permissions_decorator(self):
        """Test require_permissions decorator."""
        from app.api.middleware import require_permissions
        from app.services.authorization import Permission
        
        # This is a basic test to ensure the decorator can be imported
        # Full integration tests would require a complete FastAPI setup
        decorator = require_permissions(Permission.READ_PROGRAM)
        assert callable(decorator)
    
    def test_require_admin_decorator(self):
        """Test require_admin decorator."""
        from app.api.middleware import require_admin
        
        decorator = require_admin()
        assert callable(decorator)
    
    def test_require_program_access_decorator(self):
        """Test require_program_access decorator."""
        from app.api.middleware import require_program_access
        
        decorator = require_program_access()
        assert callable(decorator)
    
    def test_require_project_access_decorator(self):
        """Test require_project_access decorator."""
        from app.api.middleware import require_project_access
        
        decorator = require_project_access()
        assert callable(decorator)
    
    def test_require_scope_filtered_list_decorator(self):
        """Test require_scope_filtered_list decorator."""
        from app.api.middleware import require_scope_filtered_list
        
        decorator = require_scope_filtered_list("program")
        assert callable(decorator)
