"""Repository helpers for per-user settings."""
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user_settings import UserSettings
from app.repositories.base import BaseRepository


class UserSettingsRepository(BaseRepository[UserSettings]):
    def __init__(self):
        super().__init__(UserSettings)

    def get_by_user(self, db: Session, user_id: UUID) -> Optional[UserSettings]:
        return db.query(UserSettings).filter(UserSettings.user_id == user_id).first()


user_settings_repository = UserSettingsRepository()
