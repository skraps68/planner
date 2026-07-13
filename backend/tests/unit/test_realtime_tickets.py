from unittest.mock import MagicMock, patch
from app.realtime import tickets


def test_mint_ticket_stores_with_ttl_and_returns_token():
    fake = MagicMock()
    with patch("app.realtime.tickets.get_sync_redis", return_value=fake):
        tok = tickets.mint_ticket("user-1")
    assert tok
    args, kwargs = fake.setex.call_args
    assert args[0] == f"rt:ticket:{tok}"
    assert args[2] == "user-1"


def test_consume_ticket_is_single_use():
    fake = MagicMock()
    fake.getdel.return_value = "user-1"
    with patch("app.realtime.tickets.get_sync_redis", return_value=fake):
        assert tickets.consume_ticket("t") == "user-1"
    fake.getdel.assert_called_once_with("rt:ticket:t")


def test_consume_ticket_none_when_redis_down():
    with patch("app.realtime.tickets.get_sync_redis", return_value=None):
        assert tickets.consume_ticket("t") is None
