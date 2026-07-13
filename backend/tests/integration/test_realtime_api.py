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


class TestPresenceEndpoints:
    """POST/DELETE/GET /realtime/presence/{entity_type}/{entity_id}."""

    def test_register_requires_auth(self, client):
        resp = client.post("/api/v1/realtime/presence/resource/r1")
        assert resp.status_code in (401, 403)

    def test_release_requires_auth(self, client):
        resp = client.delete("/api/v1/realtime/presence/resource/r1")
        assert resp.status_code in (401, 403)

    def test_get_requires_auth(self, client):
        resp = client.get("/api/v1/realtime/presence/resource/r1")
        assert resp.status_code in (401, 403)

    def test_register_calls_store_and_publishes_event(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.register_presence"
        ) as register, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/presence/resource/r1")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        register.assert_called_once_with(
            "resource", "r1", str(authed_client.user.id), authed_client.user.username
        )
        publish.assert_called_once()
        event = publish.call_args[0][0]
        assert event.type == "presence"
        assert event.id == "r1"
        assert event.action == "updated"
        assert event.scope_ids == []
        assert event.actor_id == str(authed_client.user.id)

    def test_release_calls_store_and_publishes_event(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.release_presence"
        ) as release, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.delete("/api/v1/realtime/presence/resource/r1")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        release.assert_called_once_with("resource", "r1", str(authed_client.user.id))
        publish.assert_called_once()
        event = publish.call_args[0][0]
        assert event.type == "presence"
        assert event.action == "updated"

    def test_get_returns_present_list(self, authed_client):
        fake_list = [{"user_id": "u1", "name": "Alice"}]
        with patch(
            "app.api.v1.endpoints.realtime.list_presence", return_value=fake_list
        ) as list_fn:
            resp = authed_client.get("/api/v1/realtime/presence/resource/r1")
        assert resp.status_code == 200
        assert resp.json() == {"present": fake_list}
        list_fn.assert_called_once_with("resource", "r1")


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
        ), patch.object(
            realtime.scope_validator_service,
            "get_user_accessible_portfolios",
            return_value=[],
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

    def test_non_global_returns_union_including_portfolio_ids(self):
        """Portfolio change events carry scope_ids=[portfolio_id] (see
        app/realtime/scope.py); non-global users must see them too, not just
        program/project scoped events."""
        from app.api.v1.endpoints import realtime

        user_id = str(uuid.uuid4())
        prog_ids = [uuid.uuid4()]
        proj_ids = [uuid.uuid4()]
        portfolio_ids = [uuid.uuid4(), uuid.uuid4()]
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
        ), patch.object(
            realtime.scope_validator_service,
            "get_user_accessible_portfolios",
            return_value=portfolio_ids,
        ):
            has_global, accessible = realtime._accessible_scope(object(), user_id)
        assert has_global is False
        assert accessible == {str(x) for x in prog_ids + proj_ids + portfolio_ids}


class TestLockEndpoints:
    """POST .../locks/{type}/{id}/{acquire,heartbeat,release} + GET .../locks/{type}/{id}."""

    def test_acquire_requires_auth(self, client):
        resp = client.post("/api/v1/realtime/locks/resource/r1/acquire")
        assert resp.status_code in (401, 403)

    def test_heartbeat_requires_auth(self, client):
        resp = client.post("/api/v1/realtime/locks/resource/r1/heartbeat")
        assert resp.status_code in (401, 403)

    def test_release_requires_auth(self, client):
        resp = client.post("/api/v1/realtime/locks/resource/r1/release")
        assert resp.status_code in (401, 403)

    def test_get_requires_auth(self, client):
        resp = client.get("/api/v1/realtime/locks/resource/r1")
        assert resp.status_code in (401, 403)

    def test_acquire_calls_store_and_publishes_created_event(self, authed_client):
        fake_result = {
            "acquired": True,
            "holder": {"user_id": str(authed_client.user.id), "name": "rt-test-user"},
        }
        with patch(
            "app.api.v1.endpoints.realtime.acquire_lock", return_value=fake_result
        ) as acquire, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/acquire")
        assert resp.status_code == 200
        assert resp.json() == fake_result
        acquire.assert_called_once_with(
            "resource", "r1", str(authed_client.user.id), authed_client.user.username
        )
        publish.assert_called_once()
        event = publish.call_args[0][0]
        assert event.type == "lock"
        assert event.id == "r1"
        assert event.action == "created"
        assert event.scope_ids == []
        assert event.actor_id == str(authed_client.user.id)

    def test_acquire_returns_denied_when_held_by_another_user(self, authed_client):
        fake_result = {"acquired": False, "holder": {"user_id": "someone-else", "name": "Bob"}}
        with patch(
            "app.api.v1.endpoints.realtime.acquire_lock", return_value=fake_result
        ), patch("app.api.v1.endpoints.realtime.publish_change") as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/acquire")
        assert resp.status_code == 200
        assert resp.json() == fake_result
        # A denied acquisition changed nothing about the real holder — must not
        # broadcast a misleading "created" event to other listeners.
        publish.assert_not_called()

    def test_heartbeat_calls_store_and_does_not_publish(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.heartbeat_lock", return_value=True
        ) as heartbeat, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/heartbeat")
        assert resp.status_code == 200
        assert resp.json() == {"refreshed": True}
        heartbeat.assert_called_once_with("resource", "r1", str(authed_client.user.id))
        publish.assert_not_called()

    def test_heartbeat_returns_false_when_not_refreshed(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.heartbeat_lock", return_value=False
        ):
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/heartbeat")
        assert resp.status_code == 200
        assert resp.json() == {"refreshed": False}

    def test_release_by_owner_deletes_and_publishes_deleted_event(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.release_lock", return_value=True
        ) as release, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/release")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        release.assert_called_once_with("resource", "r1", str(authed_client.user.id))
        publish.assert_called_once()
        event = publish.call_args[0][0]
        assert event.type == "lock"
        assert event.id == "r1"
        assert event.action == "deleted"
        assert event.actor_id == str(authed_client.user.id)

    def test_release_by_non_owner_does_not_publish(self, authed_client):
        """release_lock no-ops (returns False) when the caller isn't the holder —
        the endpoint must not broadcast "deleted" when nothing was deleted."""
        with patch(
            "app.api.v1.endpoints.realtime.release_lock", return_value=False
        ) as release, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/release")
        assert resp.status_code == 200
        assert resp.json() == {"ok": False}
        release.assert_called_once_with("resource", "r1", str(authed_client.user.id))
        publish.assert_not_called()

    def test_force_release_requires_auth(self, client):
        resp = client.post("/api/v1/realtime/locks/resource/r1/force-release")
        assert resp.status_code in (401, 403)

    def test_force_release_by_different_user_deletes_and_publishes(self, authed_client):
        """force_release_lock has no owner check: a lock held by one user
        (e.g. 'user A', simulated purely via the store-level return value)
        can be force-released by a different authenticated user ('user B',
        this test's authed_client) and still succeeds."""
        with patch(
            "app.api.v1.endpoints.realtime.force_release_lock", return_value=True
        ) as force_release, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/force-release")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        force_release.assert_called_once_with("resource", "r1")
        publish.assert_called_once()
        event = publish.call_args[0][0]
        assert event.type == "lock"
        assert event.id == "r1"
        assert event.action == "deleted"
        assert event.actor_id == str(authed_client.user.id)

    def test_force_release_does_not_publish_when_nothing_deleted(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.force_release_lock", return_value=False
        ) as force_release, patch(
            "app.api.v1.endpoints.realtime.publish_change"
        ) as publish:
            resp = authed_client.post("/api/v1/realtime/locks/resource/r1/force-release")
        assert resp.status_code == 200
        assert resp.json() == {"ok": False}
        force_release.assert_called_once_with("resource", "r1")
        publish.assert_not_called()

    def test_get_returns_holder(self, authed_client):
        fake_holder = {"user_id": "u1", "name": "Alice"}
        with patch(
            "app.api.v1.endpoints.realtime.get_lock", return_value=fake_holder
        ) as get_fn:
            resp = authed_client.get("/api/v1/realtime/locks/resource/r1")
        assert resp.status_code == 200
        assert resp.json() == {"holder": fake_holder}
        get_fn.assert_called_once_with("resource", "r1")

    def test_get_returns_none_when_unlocked(self, authed_client):
        with patch(
            "app.api.v1.endpoints.realtime.get_lock", return_value=None
        ):
            resp = authed_client.get("/api/v1/realtime/locks/resource/r1")
        assert resp.status_code == 200
        assert resp.json() == {"holder": None}
