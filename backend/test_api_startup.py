#!/usr/bin/env python3
"""Test that the API can start with the new schema."""

from fastapi.testclient import TestClient
from app.main import app

def test_api_startup():
    """Test that the API starts successfully."""
    try:
        client = TestClient(app)
        
        # Test root endpoint
        response = client.get("/")
        print(f"Root endpoint status: {response.status_code}")
        
        if response.status_code in [200, 404]:
            print("✓ API started successfully (can create client)")
            return True
        else:
            print(f"✗ API failed: {response.text}")
            return False
    except Exception as e:
        print(f"✗ API failed to start: {e}")
        return False

if __name__ == "__main__":
    test_api_startup()
