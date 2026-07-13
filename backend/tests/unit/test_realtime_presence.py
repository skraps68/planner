"""Unit tests for the Redis-backed editing-presence store (best-effort)."""
import json
import time
from unittest.mock import MagicMock, patch

from app.realtime import presence


def test_register_writes_hash_field_and_sets_ttl():
    fake = MagicMock()
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        presence.register_presence("resource", "r1", "u1", "Alice")
    fake.hset.assert_called_once()
    args, _ = fake.hset.call_args
    assert args[0] == "rt:presence:resource:r1"
    assert args[1] == "u1"
    payload = json.loads(args[2])
    assert payload["name"] == "Alice"
    assert "ts" in payload
    assert fake.pexpire.called or fake.expire.called


def test_register_is_noop_when_redis_unavailable():
    with patch("app.realtime.presence.get_sync_redis", return_value=None):
        # Should not raise even though the client is unavailable.
        presence.register_presence("resource", "r1", "u1", "Alice")


def test_register_swallows_redis_errors():
    fake = MagicMock()
    fake.hset.side_effect = RuntimeError("boom")
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        # Should not raise.
        presence.register_presence("resource", "r1", "u1", "Alice")


def test_release_removes_field():
    fake = MagicMock()
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        presence.release_presence("resource", "r1", "u1")
    fake.hdel.assert_called_once_with("rt:presence:resource:r1", "u1")


def test_release_is_noop_when_redis_unavailable():
    with patch("app.realtime.presence.get_sync_redis", return_value=None):
        presence.release_presence("resource", "r1", "u1")


def test_release_swallows_redis_errors():
    fake = MagicMock()
    fake.hdel.side_effect = RuntimeError("boom")
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        presence.release_presence("resource", "r1", "u1")


def test_list_presence_returns_non_expired_entries():
    fake = MagicMock()
    fresh = json.dumps({"name": "Alice", "ts": time.time()})
    fake.hgetall.return_value = {"u1": fresh}
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        result = presence.list_presence("resource", "r1")
    assert result == [{"user_id": "u1", "name": "Alice"}]


def test_list_presence_drops_stale_entries():
    fake = MagicMock()
    stale = json.dumps({"name": "Bob", "ts": time.time() - 10_000})
    fresh = json.dumps({"name": "Alice", "ts": time.time()})
    fake.hgetall.return_value = {"u1": stale, "u2": fresh}
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        result = presence.list_presence("resource", "r1")
    assert result == [{"user_id": "u2", "name": "Alice"}]


def test_list_presence_drops_malformed_json():
    fake = MagicMock()
    fake.hgetall.return_value = {"u1": "not-json", "u2": json.dumps({"name": "Alice", "ts": time.time()})}
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        result = presence.list_presence("resource", "r1")
    assert result == [{"user_id": "u2", "name": "Alice"}]


def test_list_presence_returns_empty_when_redis_unavailable():
    with patch("app.realtime.presence.get_sync_redis", return_value=None):
        assert presence.list_presence("resource", "r1") == []


def test_list_presence_returns_empty_on_redis_error():
    fake = MagicMock()
    fake.hgetall.side_effect = RuntimeError("boom")
    with patch("app.realtime.presence.get_sync_redis", return_value=fake):
        assert presence.list_presence("resource", "r1") == []
