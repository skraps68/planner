"""
ResourceRole API endpoints.

Reads are open to any authenticated user; writes (create/update/delete) are
admin-gated via check_admin_permission.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.api.deps import get_db, get_current_user, check_admin_permission
from app.models.user import User
from app.schemas.resource_role import (
    ResourceRoleCreate,
    ResourceRoleUpdate,
    ResourceRoleResponse,
)
from app.schemas.base import SuccessResponse
from app.services.resource_role import resource_role_service
from app.core.exceptions import ConflictError

router = APIRouter()


def _to_response(db: Session, role) -> ResourceRoleResponse:
    response = ResourceRoleResponse.model_validate(role)
    response.resource_count = resource_role_service.get_resource_count(db, role.id)
    return response


@router.post(
    "/",
    response_model=ResourceRoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new resource role",
    description="Create a new resource role (admin only)"
)
async def create_resource_role(
    role_in: ResourceRoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin_permission)
):
    """
    Create a new resource role.

    Required fields:
    - name: Resource role name (must be unique)

    Optional fields:
    - description: Resource role description
    """
    try:
        role = resource_role_service.create_role(
            db=db,
            name=role_in.name,
            description=role_in.description
        )
        return _to_response(db, role)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create resource role: {str(e)}"
        )


@router.get(
    "/",
    response_model=List[ResourceRoleResponse],
    summary="List resource roles",
    description="Get a list of resource roles"
)
async def list_resource_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List resource roles."""
    try:
        roles = resource_role_service.list_roles(db, skip=skip, limit=limit)
        return [_to_response(db, role) for role in roles]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list resource roles: {str(e)}"
        )


@router.get(
    "/{role_id}",
    response_model=ResourceRoleResponse,
    summary="Get resource role by ID",
    description="Retrieve a specific resource role by its ID"
)
async def get_resource_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific resource role by ID."""
    role = resource_role_service.get_role(db, role_id)

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource role with ID {role_id} not found"
        )

    return _to_response(db, role)


@router.put(
    "/{role_id}",
    response_model=ResourceRoleResponse,
    summary="Update resource role",
    description="Update an existing resource role's attributes (admin only)"
)
async def update_resource_role(
    role_id: UUID,
    role_in: ResourceRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin_permission)
):
    """
    Update an existing resource role.

    All fields are optional. Only provided fields will be updated.
    """
    try:
        role = resource_role_service.update_role(
            db=db,
            role_id=role_id,
            name=role_in.name,
            description=role_in.description
        )
        return _to_response(db, role)

    except StaleDataError:
        current_role = resource_role_service.get_role(db, role_id)
        if current_role:
            current_state = _to_response(db, current_role).model_dump()
            raise ConflictError("resource_role", str(role_id), current_state)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource role with ID {role_id} not found"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update resource role: {str(e)}"
        )


@router.delete(
    "/{role_id}",
    response_model=SuccessResponse,
    summary="Delete resource role",
    description="Delete a resource role (admin only; blocked for 'Default' or roles with resources)"
)
async def delete_resource_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin_permission)
):
    """
    Delete a resource role.

    A resource role cannot be deleted if it is the "Default" role or if any
    resources reference it.
    """
    try:
        resource_role_service.delete_role(db, role_id)

        return SuccessResponse(
            success=True,
            message=f"Resource role {role_id} deleted successfully"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete resource role: {str(e)}"
        )
