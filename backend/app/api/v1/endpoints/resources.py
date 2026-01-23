"""
Resource and Worker API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.resource import ResourceType
from app.schemas.resource import (
    ResourceCreate,
    ResourceUpdate,
    ResourceResponse,
    ResourceListResponse,
    ResourceSummary
)
from app.schemas.base import SuccessResponse, PaginationParams
from app.services.resource import resource_service

router = APIRouter()


@router.post(
    "/",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new resource",
    description="Create a new resource (labor or non-labor)"
)
async def create_resource(
    resource_in: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new resource.
    
    Required fields:
    - name: Resource name
    - resource_type: Type of resource (labor or non_labor)
    
    Optional fields:
    - description: Resource description
    """
    try:
        resource = resource_service.create_resource(
            db=db,
            name=resource_in.name,
            resource_type=resource_in.resource_type,
            description=resource_in.description
        )
        
        # Convert to response model
        response = ResourceResponse.model_validate(resource)
        response.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create resource: {str(e)}"
        )


@router.get(
    "/",
    response_model=ResourceListResponse,
    summary="List resources",
    description="Get a paginated list of resources with optional filtering"
)
async def list_resources(
    pagination: PaginationParams = Depends(),
    resource_type: Optional[ResourceType] = Query(None, description="Filter by resource type"),
    search: Optional[str] = Query(None, description="Search term for resource name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List resources with pagination and filtering.
    
    Supports filtering by:
    - Resource type (labor or non_labor)
    - Search term (resource name)
    
    Includes scope-based filtering based on user permissions.
    """
    try:
        # Apply filters
        if search:
            resources = resource_service.search_resources(db, search, user_id=current_user.id)
        else:
            skip = (pagination.page - 1) * pagination.size
            resources = resource_service.list_resources(
                db=db,
                skip=skip,
                limit=pagination.size,
                resource_type=resource_type,
                user_id=current_user.id
            )
        
        # Calculate pagination
        total = len(resources)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Apply pagination to filtered results
        start_idx = (pagination.page - 1) * pagination.size
        end_idx = start_idx + pagination.size
        paginated_resources = resources[start_idx:end_idx]
        
        # Convert to response models
        resource_responses = []
        for resource in paginated_resources:
            response = ResourceResponse.model_validate(resource)
            response.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
            resource_responses.append(response)
        
        return ResourceListResponse(
            items=resource_responses,
            total=total,
            page=pagination.page,
            size=pagination.size,
            pages=pages,
            has_next=pagination.page < pages,
            has_prev=pagination.page > 1
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list resources: {str(e)}"
        )


@router.get(
    "/{resource_id}",
    response_model=ResourceResponse,
    summary="Get resource by ID",
    description="Retrieve a specific resource by its ID"
)
async def get_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific resource by ID.
    
    Returns resource details including:
    - All resource attributes
    - Assignment count
    - Timestamps
    """
    resource = resource_service.get_resource(db, resource_id)
    
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource with ID {resource_id} not found"
        )
    
    response = ResourceResponse.model_validate(resource)
    response.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
    
    return response


@router.put(
    "/{resource_id}",
    response_model=ResourceResponse,
    summary="Update resource",
    description="Update an existing resource's attributes"
)
async def update_resource(
    resource_id: UUID,
    resource_in: ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing resource.
    
    All fields are optional. Only provided fields will be updated.
    Note: resource_type cannot be changed after creation.
    """
    try:
        resource = resource_service.update_resource(
            db=db,
            resource_id=resource_id,
            name=resource_in.name,
            description=resource_in.description
        )
        
        response = ResourceResponse.model_validate(resource)
        response.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
        
        return response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update resource: {str(e)}"
        )


@router.delete(
    "/{resource_id}",
    response_model=SuccessResponse,
    summary="Delete resource",
    description="Delete a resource (only if it has no assignments)"
)
async def delete_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a resource.
    
    A resource can only be deleted if it has no assignments.
    """
    try:
        resource_service.delete_resource(db, resource_id)
        
        return SuccessResponse(
            success=True,
            message=f"Resource {resource_id} deleted successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete resource: {str(e)}"
        )


@router.get(
    "/labor/list",
    response_model=ResourceListResponse,
    summary="List labor resources",
    description="Get a paginated list of labor resources only"
)
async def list_labor_resources(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List labor resources with pagination.
    
    Includes scope-based filtering based on user permissions.
    """
    try:
        skip = (pagination.page - 1) * pagination.size
        resources = resource_service.list_labor_resources(
            db=db,
            skip=skip,
            limit=pagination.size,
            user_id=current_user.id
        )
        
        # Calculate pagination
        total = len(resources)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Convert to response models
        resource_responses = []
        for resource in resources:
            response = ResourceResponse.model_validate(resource)
            response.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
            resource_responses.append(response)
        
        return ResourceListResponse(
            items=resource_responses,
            total=total,
            page=pagination.page,
            size=pagination.size,
            pages=pages,
            has_next=pagination.page < pages,
            has_prev=pagination.page > 1
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list labor resources: {str(e)}"
        )


@router.get(
    "/non-labor/list",
    response_model=ResourceListResponse,
    summary="List non-labor resources",
    description="Get a paginated list of non-labor resources only"
)
async def list_non_labor_resources(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List non-labor resources with pagination.
    
    Includes scope-based filtering based on user permissions.
    """
    try:
        skip = (pagination.page - 1) * pagination.size
        resources = resource_service.list_non_labor_resources(
            db=db,
            skip=skip,
            limit=pagination.size,
            user_id=current_user.id
        )
        
        # Calculate pagination
        total = len(resources)
        pages = (total + pagination.size - 1) // pagination.size
        
        # Convert to response models
        resource_responses = []
        for resource in resources:
            response = ResourceResponse.model_validate(resource)
            response.assignment_count = len(resource.resource_assignments) if resource.resource_assignments else 0
            resource_responses.append(response)
        
        return ResourceListResponse(
            items=resource_responses,
            total=total,
            page=pagination.page,
            size=pagination.size,
            pages=pages,
            has_next=pagination.page < pages,
            has_prev=pagination.page > 1
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list non-labor resources: {str(e)}"
        )
