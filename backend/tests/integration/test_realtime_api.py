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
    client.user = user  # expose for assertions on the minting identity
    yield client
    app.dependency_overrides.pop(deps.get_current_user, None)


def test_ticket_requires_auth(client):
    resp = client.post("/api/v1/realtime/ticket")
    assert resp.status_code in (401, 403)


def test_ticket_returns_token_when_authed(authed_client):
    with patch(
        "app.api.v1.endpoints.realtime.mint_ticket", return_value="T1"
    ) as mint:
        resp = authed_client.post("/api/v1/realtime/ticket")
    assert resp.status_code == 200
    assert resp.json() == {"ticket": "T1"}
    mint.assert_called_once_with(str(authed_client.user.id))


def test_ticket_503_when_realtime_unavailable(authed_client):
    with patch(
        "app.api.v1.endpoints.realtime.mint_ticket", return_value=None
    ):
        resp = authed_client.post("/api/v1/realtime/ticket")
    assert resp.status_code == 503


def test_stream_rejects_bad_ticket(client):
    resp = client.get("/api/v1/realtime/stream?ticket=nope")
    assert resp.status_code == 401


class _FakePubSub:
    """Async pubsub stub whose get_message simulates a redis outage."""

    def __init__(self):
        self.unsubscribed = False
        self.closed = False

    async def subscribe(self, channel):
        pass

    async def get_message(self, **kwargs):
        raise ConnectionError("redis down")

    async def unsubscribe(self, channel):
        self.unsubscribed = True

    async def aclose(self):
        self.closed = True


class _FakeAsyncRedis:
    def __init__(self, ps):
        self._ps = ps
        self.closed = False

    def pubsub(self):
        return self._ps

    async def aclose(self):
        self.closed = True


def test_stream_ends_cleanly_when_redis_errors_mid_stream(client):
    ps = _FakePubSub()
    fake_conn = _FakeAsyncRedis(ps)
    with patch(
        "app.api.v1.endpoints.realtime.consume_ticket",
        return_value=str(uuid.uuid4()),
    ), patch(
        "app.api.v1.endpoints.realtime._accessible_scope",
        return_value=(True, set()),
    ), patch(
        "app.api.v1.endpoints.realtime.make_async_redis",
        return_value=fake_conn,
    ):
        resp = client.get("/api/v1/realtime/stream?ticket=T")
    # Redis raising mid-stream ends the stream cleanly (no server error)
    # after the connected prelude, and cleanup still ran.
    assert resp.status_code == 200
    assert ": connected" in resp.text
    assert ps.unsubscribed is True
    assert ps.closed is True
    assert fake_conn.closed is True


class TestVisible:
    """Scope filtering for individual change events (pure function)."""

    def test_global_scope_sees_everything(self):
        from app.api.v1.endpoints.realtime import _visible

        event = {"scope_ids": ["p-1", "p-2"]}
        assert _visible(event, has_global=True, accessible=set()) is True

    def test_empty_or_missing_scope_ids_is_broadcast(self):
        from app.api.v1.endpoints.realtime import _visible

        assert _visible({"scope_ids": []}, False, {"p-1"}) is True
        assert _visible({}, False, {"p-1"}) is True
        assert _visible({"scope_ids": None}, False, set()) is True

    def test_intersecting_scope_ids_visible(self):
        from app.api.v1.endpoints.realtime import _visible

        event = {"scope_ids": ["p-other", "p-1"]}
        assert _visible(event, False, {"p-1", "p-2"}) is True

    def test_disjoint_scope_ids_not_visible(self):
        from app.api.v1.endpoints.realtime import _visible

        event = {"scope_ids": ["p-other", "p-else"]}
        assert _visible(event, False, {"p-1", "p-2"}) is False


class TestAccessibleScope:
    """_accessible_scope reuses the scope services and degrades conservatively."""

    def test_global_scope_returns_true_and_empty_set(self):
        from app.api.v1.endpoints import realtime

        user_id = str(uuid.uuid4())
        with patch.object(
            realtime.scope_validator_service,
            "get_scope_summary",
            return_value={"has_global_scope": True},
        ):
            assert realtime._accessible_scope(object(), user_id) == (True, set())

    def test_non_global_returns_union_of_program_and_project_ids(self):
        from app.api.v1.endpoints import realtime

        user_id = str(uuid.uuid4())
        prog_ids = [uuid.uuid4(), uuid.uuid4()]
        proj_ids = [uuid.uuid4()]
        with patch.object(
            realtime.scope_validator_service,
            "get_scope_summary",
            return_value={"has_global_scope": False},
        ), patch.object(
            realtime.scope_validator_service,
            "get_user_accessible_programs",
            return_value=prog_ids,
        ), patch.object(
            realtime.scope_validator_service,
            "get_user_accessible_projects",
            return_value=proj_ids,
        ):
            has_global, accessible = realtime._accessible_scope(object(), user_id)
        assert has_global is False
        assert accessible == {str(x) for x in prog_ids + proj_ids}

    def test_scope_service_error_degrades_to_conservative(self):
        from app.api.v1.endpoints import realtime

        user_id = str(uuid.uuid4())
        with patch.object(
            realtime.scope_validator_service,
            "get_scope_summary",
            side_effect=RuntimeError("scope service down"),
        ):
            assert realtime._accessible_scope(object(), user_id) == (False, set())
