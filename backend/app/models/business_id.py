"""Configurable base/sequence source for human-friendly business IDs."""
from sqlalchemy import Column, Integer, String

from app.models.base import Base


class BusinessIdConfig(Base):
    """One row per entity type; directly editable in the DB (no admin UI yet).

    business_id = zero_pad9(base_id + next_sequence). Changing base_id later
    affects only future IDs; per-table UNIQUE constraints are the safety net.
    """

    __tablename__ = "business_id_config"

    entity_type = Column(String(20), primary_key=True)  # portfolio|program|project
    base_id = Column(Integer, nullable=False)
    next_sequence = Column(Integer, nullable=False, default=1)
