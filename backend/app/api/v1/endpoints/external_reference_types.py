"""External reference type endpoints for the Reference Data page."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import check_admin_permission, get_current_user, get_db
from app.models.user import User
from app.schemas.nonlabor_plan import (
    ExternalReferenceTypeCreate,
    ExternalReferenceTypeResponse,
    ExternalReferenceTypeUpdate,
)
from app.services.external_reference import external_reference_type_service


router = APIRouter()


def _response(db: Session, item) -> ExternalReferenceTypeResponse:
    return ExternalReferenceTypeResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        is_active=item.is_active,
        reference_count=external_reference_type_service.count_references(
            db, item.id
        ),
        version=item.version,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/", response_model=List[ExternalReferenceTypeResponse])
async def list_reference_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [
        _response(db, item)
        for item in external_reference_type_service.list(db)
    ]


@router.post(
    "/",
    response_model=ExternalReferenceTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reference_type(
    item_in: ExternalReferenceTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin_permission),
):
    try:
        return _response(
            db,
            external_reference_type_service.create(
                db, item_in.name, item_in.description
            ),
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.put("/{type_id}", response_model=ExternalReferenceTypeResponse)
async def update_reference_type(
    type_id: UUID,
    item_in: ExternalReferenceTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_admin_permission),
):
    try:
        item = external_reference_type_service.update(
            db,
            type_id,
            item_in.version,
            name=item_in.name,
            description=item_in.description,
            is_active=item_in.is_active,
        )
        return _response(db, item)
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
