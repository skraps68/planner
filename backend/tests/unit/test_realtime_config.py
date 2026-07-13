from app.core.config import settings
from app.realtime.config import realtime_enabled


def test_realtime_defaults_present():
    assert isinstance(settings.REALTIME_ENABLED, bool)
    assert settings.REALTIME_TOLERANCE_ACTIVE_MS == 3000
    assert settings.REALTIME_TOLERANCE_LIST_MS == 20000
    assert settings.REALTIME_TICKET_TTL_S == 30
    assert settings.LOCK_TTL_MS == 90000
    assert settings.LOCK_HEARTBEAT_MS == 30000


def test_realtime_enabled_helper_reads_setting():
    assert realtime_enabled() == settings.REALTIME_ENABLED
