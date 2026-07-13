from unittest.mock import patch
from app.realtime import redis_clients


def _reset_state():
    redis_clients._sync_client = None
    redis_clients._last_failure_ts = None


def test_get_sync_redis_returns_none_when_disabled():
    _reset_state()
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", False):
        assert redis_clients.get_sync_redis() is None


def test_get_sync_redis_returns_none_on_connection_error():
    _reset_state()
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", True), \
         patch("app.realtime.redis_clients.redis.Redis.ping", side_effect=Exception("down")):
        assert redis_clients.get_sync_redis() is None


def test_get_sync_redis_memoizes_client():
    _reset_state()
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", True), \
         patch("app.realtime.redis_clients.redis.Redis.ping", return_value=True) as mock_ping:
        first = redis_clients.get_sync_redis()
        second = redis_clients.get_sync_redis()
        assert first is not None
        assert second is first
        assert mock_ping.call_count == 1


def test_get_sync_redis_cooldown_skips_retry_after_failure():
    _reset_state()
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", True), \
         patch("app.realtime.redis_clients.redis.Redis.ping", side_effect=Exception("down")) as mock_ping:
        assert redis_clients.get_sync_redis() is None
        assert mock_ping.call_count == 1
        # Immediate second call is within the cooldown: no new connect/ping.
        assert redis_clients.get_sync_redis() is None
        assert mock_ping.call_count == 1


def test_changes_channel_constant():
    assert redis_clients.CHANGES_CHANNEL == "rt:changes"
