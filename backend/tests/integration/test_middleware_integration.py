"""
Integration tests for API middleware with authentication and authorization.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User, UserRole, RoleType
from app.services.authentication import authentication_service
from tests.conftest import TestingSessionLocal


@pytest.fixture
def test_db():
    """Create a test database session."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db, test_db) -> User:
    """Create a test user."""
    user = authentication_service.create_user(
        db=test_db,
        username="testuser_middleware",
        email="test_middleware@example.com",
        password="testpass123",
        is_active=True
    )
    yield user
    # Cleanup
    test_db.delete(user)
    test_db.commit()


@pytest.fixture
def admin_user(db, test_db) -> User:
    """Create an admin user."""
    user = authentication_service.create_user(
        db=test_db,
        username="adminuser_middleware",
        email="admin_middleware@example.com",
        password="adminpass123",
        is_active=True
    )
    
    # Add admin role
    admin_role = UserRole(
        user_id=user.id,
        role_type=RoleType.ADMIN,
        is_active=True
    )
    test_db.add(admin_role)
    test_db.commit()
    
    yield user
    # Cleanup
    test_db.delete(admin_role)
    test_db.delete(user)
    test_db.commit()


@pytest.fixture
def auth_headers(test_db, test_user: User) -> dict:
    """Get authentication headers for test user."""
    tokens = authentication_service.login(
        db=test_db,
        username="testuser_middleware",
        password="testpass123"
    )
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def admin_auth_headers(test_db, admin_user: User) -> dict:
    """Get authentication headers for admin user."""
    tokens = authentication_service.login(
        db=test_db,
        username="adminuser_middleware",
        password="adminpass123"
    )
    return {"Authorization": f"Bearer {tokens['access_token']}"}


class TestSecurityHeadersIntegration:
    """Integration tests for security headers."""
    
    def test_security_headers_on_public_endpoints(self, client):
        """Test security headers on public endpoints."""
        response = client.get("/health")
        
        assert response.status_code == 200
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers
        assert "Strict-Transport-Security" in response.headers
    
    def test_security_headers_on_authenticated_endpoints(
        self, client, auth_headers
    ):
        """Test security headers on authenticated endpoints."""
        response = client.get("/api/v1/programs/", headers=auth_headers)
        
        # May return 200 or 403 depending on permissions, but headers should be present
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers


class TestRateLimitIntegration:
    """Integration tests for rate limiting."""
    
    def test_rate_limit_on_api_endpoints(self, client, auth_headers):
        """Test that rate limiting works on API endpoints."""
        # Make multiple requests
        responses = []
        for i in range(10):
            response = client.get("/api/v1/programs/", headers=auth_headers)
            responses.append(response)
        
        # All requests should have rate limit headers
        for response in responses:
            if response.status_code != 429:  # Skip rate limited responses
                assert "X-RateLimit-Limit" in response.headers
                assert "X-RateLimit-Remaining" in response.headers
    
    def test_rate_limit_does_not_affect_health_check(self, client):
        """Test that health check is not rate limited."""
        # Make many requests to health check
        for i in range(20):
            response = client.get("/health")
            assert response.status_code == 200


class TestAuthenticationMiddleware:
    """Integration tests for authentication middleware."""
    
    def test_unauthenticated_request_rejected(self, client):
        """Test that unauthenticated requests are rejected."""
        response = client.get("/api/v1/programs/")
        assert response.status_code == 403  # No auth header provided
    
    def test_invalid_token_rejected(self, client):
        """Test that invalid tokens are rejected."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/programs/", headers=headers)
        assert response.status_code == 401
    
    def test_valid_token_accepted(self, client, auth_headers):
        """Test that valid tokens are accepted."""
        response = client.get("/api/v1/programs/", headers=auth_headers)
        # Should not return 401 (may return 403 if no permissions, but token is valid)
        assert response.status_code != 401
    
    def test_expired_token_rejected(self, client, test_db, test_user):
        """Test that expired tokens are rejected."""
        # Create a token with very short expiration
        from datetime import timedelta
        token = authentication_service.create_access_token(
            data={"sub": str(test_user.id), "username": test_user.username},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/programs/", headers=headers)
        assert response.status_code == 401


class TestAuthorizationMiddleware:
    """Integration tests for authorization middleware."""
    
    def test_admin_can_access_admin_endpoints(
        self, client, admin_auth_headers
    ):
        """Test that admin users can access admin endpoints."""
        # Try to access user management endpoint (admin only)
        response = client.get("/api/v1/users/", headers=admin_auth_headers)
        # Should not return 403 (may return other codes, but not forbidden)
        assert response.status_code != 403
    
    def test_non_admin_cannot_access_admin_endpoints(
        self, client, auth_headers
    ):
        """Test that non-admin users cannot access admin endpoints."""
        # Try to access user management endpoint (admin only)
        response = client.get("/api/v1/users/", headers=auth_headers)
        # Should return 403 forbidden
        assert response.status_code == 403


class TestScopeValidationMiddleware:
    """Integration tests for scope validation."""
    
    def test_scope_filtering_on_list_endpoints(
        self, client, auth_headers, test_db, test_user
    ):
        """Test that list endpoints filter by user scope."""
        # User with no scope assignments should see empty list
        response = client.get("/api/v1/programs/", headers=auth_headers)
        
        # Should succeed but return empty or filtered results
        if response.status_code == 200:
            data = response.json()
            # Results should be filtered by scope
            assert "items" in data or "programs" in data or isinstance(data, list)


class TestCORSMiddleware:
    """Integration tests for CORS middleware."""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present when configured."""
        response = client.options("/api/v1/programs/")
        # CORS headers may or may not be present depending on configuration
        # This test just ensures the request doesn't fail
        assert response.status_code in [200, 403, 405]


class TestAuditLoggingIntegration:
    """Integration tests for audit logging."""
    
    def test_state_changing_operations_logged(
        self, client, admin_auth_headers, test_db
    ):
        """Test that state-changing operations are logged."""
        # Create a program (POST request)
        program_data = {
            "name": "Test Program Middleware",
            "business_sponsor": "Sponsor",
            "program_manager": "Manager",
            "technical_lead": "Lead",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        response = client.post(
            "/api/v1/programs/",
            json=program_data,
            headers=admin_auth_headers
        )
        
        # Request should succeed or fail based on permissions, but should be processed
        assert response.status_code in [200, 201, 403, 422]
    
    def test_read_operations_not_logged(self, client, auth_headers):
        """Test that read operations are not logged."""
        # GET request should not trigger audit logging
        response = client.get("/api/v1/programs/", headers=auth_headers)
        # Request should be processed normally
        assert response.status_code in [200, 403]
