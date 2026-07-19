"""
ResourceRole repository for data access operations.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.resource import ResourceRole
from app.repositories.base import BaseRepository


class ResourceRoleRepository(BaseRepository[ResourceRole]):
    """Repository for ResourceRole model operations."""

    def __init__(self):
        super().__init__(ResourceRole)

    def get_by_name(self, db: Session, name: str) -> Optional[ResourceRole]:
        """Get resource role by name."""
        return db.query(ResourceRole).filter(ResourceRole.name == name).first()


# Create repository instance
resource_role_repository = ResourceRoleRepository()
