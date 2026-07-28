"""API endpoints for non-labor cash forecast plans."""
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import check_permission, get_db
from app.models.user import User
from app.schemas.nonlabor_plan import (
    ExternalReferenceResponse,
    NonLaborOccurrenceInput,
    NonLaborOccurrenceOverrideRequest,
    NonLaborPlanLineCreate,
    NonLaborPlanLineResponse,
    NonLaborPlanLineUpdate,
    NonLaborPlanOccurrenceResponse,
    NonLaborPlanPreviewRequest,
    NonLaborPlanPreviewResponse,
)
from app.services.authorization import Permission
from app.services.nonlabor_plan import nonlabor_plan_service
from app.services.nonlabor_schedule import GeneratedOccurrence


router = APIRouter()


def _response(plan) -> NonLaborPlanLineResponse:
    references = [
        ExternalReferenceResponse(
            id=link.external_reference.id,
            reference_type_id=link.external_reference.reference_type_id,
            reference_type_name=link.external_reference.reference_type.name,
            value=link.external_reference.value,
            version=link.external_reference.version,
            created_at=link.external_reference.created_at,
            updated_at=link.external_reference.updated_at,
        )
        for link in plan.reference_links
    ]
    occurrences = [
        NonLaborPlanOccurrenceResponse(
            id=item.id,
            occurrence_date=item.occurrence_date,
            base_amount=item.base_amount,
            override_amount=item.override_amount,
            effective_amount=item.effective_amount,
            source=item.source,
            version=item.version,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in sorted(
            plan.occurrences, key=lambda occurrence: occurrence.occurrence_date
        )
    ]
    warnings = nonlabor_plan_service.timeline_warnings(
        plan.project,
        [
            GeneratedOccurrence(item.occurrence_date, item.effective_amount)
            for item in plan.occurrences
        ],
    )
    return NonLaborPlanLineResponse(
        id=plan.id,
        project_id=plan.project_id,
        project_name=plan.project.name,
        project_start_date=plan.project.start_date,
        project_end_date=plan.project.end_date,
        resource_id=plan.resource_id,
        resource_name=plan.resource.name,
        name=plan.name,
        description=plan.description,
        forecast_basis=plan.forecast_basis,
        method=plan.method,
        cost_treatment=plan.cost_treatment,
        currency_code=plan.currency_code,
        total_amount=plan.total_amount,
        schedule_start=plan.schedule_start,
        schedule_end=plan.schedule_end,
        frequency=plan.frequency,
        period_placement=plan.period_placement,
        status=plan.status,
        occurrences=occurrences,
        references=references,
        warnings=warnings,
        version=plan.version,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _raise_service_error(error: Exception):
    if isinstance(error, PermissionError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(error)
        )
    if isinstance(error, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)
    )


@router.post("/preview", response_model=NonLaborPlanPreviewResponse)
async def preview_nonlabor_plan(
    plan_in: NonLaborPlanPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        check_permission(Permission.CREATE_ASSIGNMENT)
    ),
):
    try:
        occurrences, warnings = nonlabor_plan_service.preview(
            db,
            plan_in,
            project_id=plan_in.project_id,
            user_id=current_user.id,
        )
        exact_total = sum((item.amount for item in occurrences), Decimal("0"))
        return NonLaborPlanPreviewResponse(
            occurrences=[
                NonLaborOccurrenceInput(
                    occurrence_date=item.occurrence_date,
                    amount=item.amount,
                )
                for item in occurrences
            ],
            occurrence_count=len(occurrences),
            exact_total=exact_total,
            warnings=warnings,
        )
    except (ValueError, PermissionError, RuntimeError) as error:
        _raise_service_error(error)


@router.get("/", response_model=List[NonLaborPlanLineResponse])
async def list_nonlabor_plans(
    project_id: Optional[UUID] = None,
    resource_id: Optional[UUID] = None,
    include_cancelled: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.READ_ASSIGNMENT)),
):
    plans = nonlabor_plan_service.list(
        db,
        current_user.id,
        project_id=project_id,
        resource_id=resource_id,
        include_cancelled=include_cancelled,
    )
    return [_response(plan) for plan in plans]


@router.post(
    "/",
    response_model=NonLaborPlanLineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_nonlabor_plan(
    plan_in: NonLaborPlanLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        check_permission(Permission.CREATE_ASSIGNMENT)
    ),
):
    try:
        return _response(
            nonlabor_plan_service.create(db, plan_in, current_user.id)
        )
    except (ValueError, PermissionError, RuntimeError) as error:
        db.rollback()
        _raise_service_error(error)


@router.get("/{plan_id}", response_model=NonLaborPlanLineResponse)
async def get_nonlabor_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission(Permission.READ_ASSIGNMENT)),
):
    plan = nonlabor_plan_service.get(db, plan_id)
    if not plan:
        raise HTTPException(
            status_code=404, detail="Non-labor plan was not found"
        )
    accessible = nonlabor_plan_service.list(
        db,
        current_user.id,
        project_id=plan.project_id,
        include_cancelled=True,
    )
    if all(item.id != plan.id for item in accessible):
        raise HTTPException(
            status_code=403, detail="Project access is required"
        )
    return _response(plan)


@router.put("/{plan_id}", response_model=NonLaborPlanLineResponse)
async def update_nonlabor_plan(
    plan_id: UUID,
    plan_in: NonLaborPlanLineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        check_permission(Permission.UPDATE_ASSIGNMENT)
    ),
):
    try:
        return _response(
            nonlabor_plan_service.update(db, plan_id, plan_in, current_user.id)
        )
    except (ValueError, PermissionError, RuntimeError) as error:
        db.rollback()
        _raise_service_error(error)


@router.put(
    "/{plan_id}/occurrences/{occurrence_id}/override",
    response_model=NonLaborPlanLineResponse,
)
async def set_nonlabor_occurrence_override(
    plan_id: UUID,
    occurrence_id: UUID,
    override_in: NonLaborOccurrenceOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        check_permission(Permission.UPDATE_ASSIGNMENT)
    ),
):
    try:
        return _response(
            nonlabor_plan_service.set_override(
                db,
                plan_id,
                occurrence_id,
                override_in.amount,
                override_in.version,
                current_user.id,
            )
        )
    except (ValueError, PermissionError, RuntimeError) as error:
        db.rollback()
        _raise_service_error(error)


@router.post("/{plan_id}/cancel", response_model=NonLaborPlanLineResponse)
async def cancel_nonlabor_plan(
    plan_id: UUID,
    version: int = Query(ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        check_permission(Permission.DELETE_ASSIGNMENT)
    ),
):
    try:
        return _response(
            nonlabor_plan_service.cancel(db, plan_id, version, current_user.id)
        )
    except (ValueError, PermissionError, RuntimeError) as error:
        db.rollback()
        _raise_service_error(error)
