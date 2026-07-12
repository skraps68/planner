from unittest.mock import patch

import pytest

from app.realtime.listeners import install_listeners
from app.models.resource import WorkerType
from tests.conftest import TestingSessionLocal


@pytest.fixture
def db_session(db):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_commit_publishes_created_event(db_session):
    install_listeners()
    with patch("app.realtime.listeners.publish_change") as pub:
        wt = WorkerType(type="RT-Test", description="d")
        db_session.add(wt)
        db_session.commit()
    published = [c.args[0] for c in pub.call_args_list]
    assert any(e.type == "worker_type" and e.action == "created" for e in published)


def test_rollback_publishes_nothing(db_session):
    install_listeners()
    with patch("app.realtime.listeners.publish_change") as pub:
        wt = WorkerType(type="RT-Rollback", description="d")
        db_session.add(wt)
        db_session.flush()
        db_session.rollback()
    pub.assert_not_called()
