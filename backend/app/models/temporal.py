"""Append-only snapshots used to preserve planning history from activation."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String

from app.models.base import BaseModel, GUID, JSON


class EntityRevision(BaseModel):
    """Immutable full-state snapshot for a financially relevant entity change."""

    __tablename__ = "entity_revisions"

    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(GUID(), nullable=False, index=True)
    entity_version = Column(Integer, nullable=False)
    operation = Column(String(20), nullable=False, index=True)
    snapshot = Column(JSON(), nullable=False)
    effective_from = Column(Date, nullable=True, index=True)
    effective_to = Column(Date, nullable=True, index=True)
    recorded_at = Column(DateTime, nullable=False, index=True)
    actor_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    transaction_id = Column(GUID(), nullable=False, index=True)
    is_tombstone = Column(Boolean, nullable=False, default=False)
