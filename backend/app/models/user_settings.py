"""Per-user application presentation preferences."""
from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, GUID, JSON


class UserSettings(BaseModel):
    """One versioned JSON settings document for each user."""

    __tablename__ = "user_settings"

    user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    settings_schema_version = Column(Integer, nullable=False, default=1, server_default="1")
    settings = Column(JSON(), nullable=False, default=dict)

    user = relationship("User", back_populates="settings_record")
