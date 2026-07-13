"""ResourceType must serialize identically in DB, API, and frontend ('LABOR')."""
from app.models.resource import ResourceType
from app.schemas.resource import ResourceResponse


def test_enum_values_equal_names():
    assert ResourceType.LABOR.value == "LABOR"
    assert ResourceType.NON_LABOR.value == "NON_LABOR"


def test_response_serializes_uppercase():
    payload = {
        "id": "0e0e0e0e-0e0e-0e0e-0e0e-0e0e0e0e0e0e",
        "name": "Jane Doe",
        "resource_type": ResourceType.LABOR,
        "description": None,
        "version": 1,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    resp = ResourceResponse.model_validate(payload)
    assert resp.model_dump()["resource_type"] == "LABOR"


def test_request_accepts_uppercase():
    assert ResourceType("LABOR") is ResourceType.LABOR
