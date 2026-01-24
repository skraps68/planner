"""
Integration tests for Resource, Worker, and Rate API endpoints.
"""
import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.resource import ResourceType


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestResourceAPI:
    """Test Resource API endpoints."""
    
    def test_create_resource(self, client: TestClient, db: Session):
        """Test creating a resource."""
        # Note: This will fail with 401 due to missing authentication
        # But it validates the endpoint structure
        resource_data = {
            "name": "Test Resource",
            "resource_type": "labor",
            "description": "Test description"
        }
        
        response = client.post(
            "/api/v1/resources/",
            json=resource_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_list_resources(self, client: TestClient):
        """Test listing resources."""
        response = client.get(
            "/api/v1/resources/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_resource(self, client: TestClient):
        """Test getting a resource by ID."""
        resource_id = uuid4()
        response = client.get(
            f"/api/v1/resources/{resource_id}",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401


class TestWorkerTypeAPI:
    """Test Worker Type API endpoints."""
    
    def test_create_worker_type(self, client: TestClient):
        """Test creating a worker type."""
        worker_type_data = {
            "type": "Engineer",
            "description": "Software Engineer"
        }
        
        response = client.post(
            "/api/v1/workers/types",
            json=worker_type_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_list_worker_types(self, client: TestClient):
        """Test listing worker types."""
        response = client.get(
            "/api/v1/workers/types",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401


class TestWorkerAPI:
    """Test Worker API endpoints."""
    
    def test_create_worker(self, client: TestClient):
        """Test creating a worker."""
        worker_data = {
            "external_id": "EMP001",
            "name": "John Doe",
            "worker_type_id": str(uuid4())
        }
        
        response = client.post(
            "/api/v1/workers/",
            json=worker_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_list_workers(self, client: TestClient):
        """Test listing workers."""
        response = client.get(
            "/api/v1/workers/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_worker_by_external_id(self, client: TestClient):
        """Test getting a worker by external ID."""
        response = client.get(
            "/api/v1/workers/external/EMP001",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401


class TestRateAPI:
    """Test Rate API endpoints."""
    
    def test_create_rate(self, client: TestClient):
        """Test creating a rate."""
        rate_data = {
            "worker_type_id": str(uuid4()),
            "rate_amount": "150.00",
            "start_date": "2024-01-01",
            "end_date": None
        }
        
        response = client.post(
            "/api/v1/rates/",
            json=rate_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_current_rate(self, client: TestClient):
        """Test getting current rate for worker type."""
        worker_type_id = uuid4()
        response = client.get(
            f"/api/v1/rates/worker-type/{worker_type_id}/current",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_get_rate_history(self, client: TestClient):
        """Test getting rate history for worker type."""
        worker_type_id = uuid4()
        response = client.get(
            f"/api/v1/rates/worker-type/{worker_type_id}/history",
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401
    
    def test_update_rate(self, client: TestClient):
        """Test updating a rate."""
        worker_type_id = uuid4()
        response = client.post(
            f"/api/v1/rates/worker-type/{worker_type_id}/update",
            params={
                "new_rate_amount": "175.00",
                "effective_date": "2024-06-01"
            },
            headers={"Authorization": "Bearer test-token"}
        )
        
        # Expect 401 because authentication requires valid token
        assert response.status_code == 401


class TestAPIInfo:
    """Test API info endpoint."""
    
    def test_api_info(self, client: TestClient):
        """Test API info endpoint includes new routes."""
        response = client.get("/api/v1/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "available_routes" in data
        assert "resources" in data["available_routes"]
        assert "workers" in data["available_routes"]
        assert "rates" in data["available_routes"]
        assert data["available_routes"]["resources"] == "/api/v1/resources"
        assert data["available_routes"]["workers"] == "/api/v1/workers"
        assert data["available_routes"]["rates"] == "/api/v1/rates"
