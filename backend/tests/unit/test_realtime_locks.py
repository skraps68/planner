"""Unit tests for the Redis-backed advisory soft-lock store (best-effort)."""
from unittest.mock import MagicMock, patch

from app.realtime import locks


def test_acquire_returns_true_when_setnx_succeeds():
    fake = MagicMock()
    fake.set.return_value = True
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res["acquired"] is True
    assert res["holder"] == {"user_id": "u1", "name": "Alice"}
    args, kwargs = fake.set.call_args
    assert args[0] == "rt:lock:resource:r1"
    assert kwargs["nx"] is True
    assert kwargs["px"] == locks.settings.LOCK_TTL_MS


def test_acquire_returns_holder_when_already_locked():
    fake = MagicMock()
    fake.set.return_value = None
    fake.get.return_value = '{"user_id": "u2", "name": "Bob"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res["acquired"] is False
    assert res["holder"]["user_id"] == "u2"


def test_acquire_is_reentrant_for_same_holder():
    """If SET NX fails but the existing holder IS the caller, refresh + acquired True."""
    fake = MagicMock()
    fake.set.return_value = None
    fake.get.return_value = '{"user_id": "u1", "name": "Alice"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res["acquired"] is True
    assert res["holder"]["user_id"] == "u1"
    fake.pexpire.assert_called_once_with("rt:lock:resource:r1", locks.settings.LOCK_TTL_MS)


def test_acquire_degrades_open_when_redis_unavailable():
    with patch("app.realtime.locks.get_sync_redis", return_value=None):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res == {"acquired": True, "holder": None}


def test_acquire_degrades_open_on_redis_error():
    fake = MagicMock()
    fake.set.side_effect = RuntimeError("boom")
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.acquire_lock("resource", "r1", "u1", "Alice")
    assert res == {"acquired": True, "holder": None}


def test_heartbeat_refreshes_ttl_when_owner():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u1", "name": "Alice"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        ok = locks.heartbeat_lock("resource", "r1", "u1")
    assert ok is True
    fake.pexpire.assert_called_once_with("rt:lock:resource:r1", locks.settings.LOCK_TTL_MS)


def test_heartbeat_returns_false_when_not_owner():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u2", "name": "Bob"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        ok = locks.heartbeat_lock("resource", "r1", "u1")
    assert ok is False
    fake.pexpire.assert_not_called()


def test_heartbeat_returns_false_when_no_lock_held():
    fake = MagicMock()
    fake.get.return_value = None
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        ok = locks.heartbeat_lock("resource", "r1", "u1")
    assert ok is False


def test_heartbeat_returns_false_when_redis_unavailable():
    with patch("app.realtime.locks.get_sync_redis", return_value=None):
        assert locks.heartbeat_lock("resource", "r1", "u1") is False


def test_release_only_deletes_when_owner():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u1", "name": "Alice"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        result = locks.release_lock("resource", "r1", "u1")
    fake.delete.assert_called_once_with("rt:lock:resource:r1")
    assert result is True


def test_release_does_not_delete_when_not_owner():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u2", "name": "Bob"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        result = locks.release_lock("resource", "r1", "u1")
    fake.delete.assert_not_called()
    assert result is False


def test_release_returns_false_when_no_lock_held():
    fake = MagicMock()
    fake.get.return_value = None
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        result = locks.release_lock("resource", "r1", "u1")
    fake.delete.assert_not_called()
    assert result is False


def test_release_is_noop_when_redis_unavailable():
    with patch("app.realtime.locks.get_sync_redis", return_value=None):
        assert locks.release_lock("resource", "r1", "u1") is False


def test_release_swallows_redis_errors():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u1", "name": "Alice"}'
    fake.delete.side_effect = RuntimeError("boom")
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        assert locks.release_lock("resource", "r1", "u1") is False


def test_get_lock_returns_current_holder():
    fake = MagicMock()
    fake.get.return_value = '{"user_id": "u1", "name": "Alice"}'
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        res = locks.get_lock("resource", "r1")
    assert res == {"user_id": "u1", "name": "Alice"}


def test_get_lock_returns_none_when_unlocked():
    fake = MagicMock()
    fake.get.return_value = None
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        assert locks.get_lock("resource", "r1") is None


def test_get_lock_returns_none_when_redis_unavailable():
    with patch("app.realtime.locks.get_sync_redis", return_value=None):
        assert locks.get_lock("resource", "r1") is None


def test_get_lock_returns_none_on_malformed_json():
    fake = MagicMock()
    fake.get.return_value = "not-json"
    with patch("app.realtime.locks.get_sync_redis", return_value=fake):
        assert locks.get_lock("resource", "r1") is None
