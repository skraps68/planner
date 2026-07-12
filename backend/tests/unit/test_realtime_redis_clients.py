from unittest.mock import patch
from app.realtime import redis_clients


def test_get_sync_redis_returns_none_when_disabled():
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", False):
        redis_clients._sync_client = None  # reset memoization
        assert redis_clients.get_sync_redis() is None


def test_get_sync_redis_returns_none_on_connection_error():
    redis_clients._sync_client = None
    with patch.object(redis_clients.settings, "REALTIME_ENABLED", True), \
         patch("app.realtime.redis_clients.redis.Redis.ping", side_effect=Exception("down")):
        assert redis_clients.get_sync_redis() is None


def test_changes_channel_constant():
    assert redis_clients.CHANGES_CHANNEL == "rt:changes"
