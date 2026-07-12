"""Integration tests for the realtime router: ticket mint + SSE stream auth."""
import uuid
from unittest.mock import patch

import pytest

from app.api import deps
from app.main import app


class _FakeUser:
    def __init__(self):
        self.id = uuid.uuid4()
        self.username = "rt-test-user"


@pytest.fixture
def authed_client(client):
    user = _FakeUser()
    app.dependency_overrides[deps.get_current_user] = lambda: user
    yield client
    app.dependency_overrides.pop(deps.get_current_user, None)


def test_ticket_requires_auth(client):
    resp = client.post("/api/v1/realtime/ticket")
    assert resp.status_code in (401, 403)


def test_ticket_returns_token_when_authed(authed_client):
    with patch(
        "app.api.v1.endpoints.realtime.mint_ticket", return_value="T1"
    ):
        resp = authed_client.post("/api/v1/realtime/ticket")
    assert resp.status_code == 200
    assert resp.json() == {"ticket": "T1"}


def test_ticket_503_when_realtime_unavailable(authed_client):
    with patch(
        "app.api.v1.endpoints.realtime.mint_ticket", return_value=None
    ):
        resp = authed_client.post("/api/v1/realtime/ticket")
    assert resp.status_code == 503


def test_stream_rejects_bad_ticket(client):
    resp = client.get("/api/v1/realtime/stream?ticket=nope")
    assert resp.status_code == 401
