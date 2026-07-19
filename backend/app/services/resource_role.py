"""
ResourceRole service for business logic operations.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resource import ResourceRole, Resource
from app.repositories.resource_role import resource_role_repository

DEFAULT_ROLE_NAME = "Default"


class ResourceRoleService:
    """Service for resource role business logic."""

    def __init__(self):
        self.repository = resource_role_repository

    def create_role(
        self,
        db: Session,
        name: str,
        description: Optional[str] = None
    ) -> ResourceRole:
        """
        Create a new resource role.

        Args:
            db: Database session
            name: Resource role name (must be unique)
            description: Optional resource role description

        Returns:
            Created resource role

        Raises:
            ValueError: If validation fails
        """
        existing = self.repository.get_by_name(db, name)
        if existing:
            raise ValueError(f"Resource role '{name}' already exists")

        role_data = {
            "name": name,
            "description": description,
        }

        return self.repository.create(db, obj_in=role_data)

    def get_role(self, db: Session, role_id: UUID) -> Optional[ResourceRole]:
        """Get resource role by ID."""
        return self.repository.get(db, role_id)

    def list_roles(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100
    ) -> List[ResourceRole]:
        """
        List resource roles.

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of resource roles
        """
        return self.repository.get_multi(db, skip=skip, limit=limit)

    def update_role(
        self,
        db: Session,
        role_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> ResourceRole:
        """
        Update resource role with validation.

        Args:
            db: Database session
            role_id: Resource role ID to update
            name: Optional new name
            description: Optional new description

        Returns:
            Updated resource role

        Raises:
            ValueError: If validation fails or resource role not found
        """
        role = self.repository.get(db, role_id)
        if not role:
            raise ValueError(f"Resource role with ID {role_id} not found")

        update_data = {}

        if name is not None:
            existing = self.repository.get_by_name(db, name)
            if existing and existing.id != role_id:
                raise ValueError(f"Resource role '{name}' already exists")
            update_data["name"] = name

        if description is not None:
            update_data["description"] = description

        return self.repository.update(db, db_obj=role, obj_in=update_data)

    def delete_role(self, db: Session, role_id: UUID) -> bool:
        """
        Delete a resource role.

        Args:
            db: Database session
            role_id: Resource role ID to delete

        Returns:
            True if deleted successfully

        Raises:
            ValueError: If resource role not found, is the "Default" role, or has
                referencing resources
        """
        role = self.repository.get(db, role_id)
        if not role:
            raise ValueError(f"Resource role with ID {role_id} not found")

        if role.name == DEFAULT_ROLE_NAME:
            raise ValueError("The 'Default' resource role cannot be deleted")

        resource_count = db.query(Resource).filter(Resource.resource_role_id == role_id).count()
        if resource_count:
            raise ValueError(
                f"Cannot delete resource role '{role.name}' because it has "
                f"{resource_count} resource(s) referencing it"
            )

        self.repository.remove(db, id=role_id)
        return True

    def get_resource_count(self, db: Session, role_id: UUID) -> int:
        """Get the number of resources referencing a resource role."""
        return db.query(Resource).filter(Resource.resource_role_id == role_id).count()


# Create service instance
resource_role_service = ResourceRoleService()
