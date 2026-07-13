"""Allocator for human-friendly 9-digit business IDs.

IDs are typed by range via business_id_config (portfolio 01…, program 02…,
project 03…). Allocation increments next_sequence inside the caller's
transaction; the per-table UNIQUE constraint on business_id is the collision
safety net.
"""
from sqlalchemy.orm import Session

from app.models.business_id import BusinessIdConfig

VALID_ENTITY_TYPES = ("portfolio", "program", "project")


def allocate_business_id(db: Session, entity_type: str) -> str:
    """Return the next zero-padded 9-char business id for entity_type.

    Flushes (does not commit) — the caller's transaction owns the commit, so
    the sequence increment and the entity INSERT succeed or fail together.
    """
    if entity_type not in VALID_ENTITY_TYPES:
        raise ValueError(f"Unknown business-id entity type: {entity_type}")

    config = (
        db.query(BusinessIdConfig)
        .filter(BusinessIdConfig.entity_type == entity_type)
        .with_for_update()  # row lock on Postgres; SQLite ignores it (single writer)
        .one()
    )
    business_id = str(config.base_id + config.next_sequence).zfill(9)
    config.next_sequence += 1
    db.flush()
    return business_id
