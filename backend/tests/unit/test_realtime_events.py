import json
from unittest.mock import MagicMock, patch
from app.realtime.events import ChangeEvent, publish_change


def _event():
    return ChangeEvent(type="resource", id="abc", action="created",
                       scope_ids=["proj-1"], actor_id="user-1", ts=1.0)


def test_publish_change_publishes_json_to_channel():
    fake = MagicMock()
    with patch("app.realtime.events.get_sync_redis", return_value=fake):
        assert publish_change(_event()) is True
    fake.publish.assert_called_once()
    channel, payload = fake.publish.call_args[0]
    assert channel == "rt:changes"
    assert json.loads(payload)["id"] == "abc"


def test_publish_change_noops_when_redis_unavailable():
    with patch("app.realtime.events.get_sync_redis", return_value=None):
        assert publish_change(_event()) is False


def test_publish_change_swallows_errors():
    fake = MagicMock()
    fake.publish.side_effect = Exception("boom")
    with patch("app.realtime.events.get_sync_redis", return_value=fake):
        assert publish_change(_event()) is False
