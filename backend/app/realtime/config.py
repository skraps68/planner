"""Typed accessors for realtime settings."""
from app.core.config import settings


def realtime_enabled() -> bool:
    return bool(settings.REALTIME_ENABLED)
