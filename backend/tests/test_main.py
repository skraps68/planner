"""
Test main application endpoints.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert "docs_url" in data


def test_health_endpoint():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_api_v1_endpoint():
    """Test API v1 info endpoint."""
    response = client.get("/api/v1/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "endpoints" in data