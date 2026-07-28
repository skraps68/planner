"""Business logic for non-labor cash forecast plans."""
from datetime import datetime
from decimal import Decimal
from typing import Iterable, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.nonlabor_plan import (
    ExternalReference,
    NonLaborForecastBasis,
    NonLaborOccurrenceSource,
    NonLaborPlanLine,
    NonLaborPlanLineReference,
    NonLaborPlanMethod,
    NonLaborPlanOccurrence,
    NonLaborPlanStatus,
)
from app.models.resource import ResourceType
from app.repositories.project import project_repository
from app.repositories.resource import resource_repository
from app.schemas.nonlabor_plan import NonLaborPlanDefinition
from app.services.external_reference import external_reference_service
from app.services.nonlabor_schedule import (
    GeneratedOccurrence,
    generate_straight_line_occurrences,
    normalize_manual_occurrences,
)
from app.services.scope_validator import scope_validator_service


class NonLaborPlanService:
    @staticmethod
    def _resolve_references(
        db: Session,
        reference_inputs: Iterable,
    ) -> List[ExternalReference]:
        seen = set()
        resolved = []
        for reference_in in reference_inputs:
            key = (
                reference_in.reference_type_id,
                reference_in.value.upper(),
            )
            if key in seen:
                raise ValueError(
                    "A plan cannot contain the same external reference twice"
                )
            seen.add(key)
            resolved.append(
                external_reference_service.get_or_create(
                    db,
                    reference_in.reference_type_id,
                    reference_in.value,
                )
            )
        return resolved

    def _validate_context(
        self,
        db: Session,
        project_id: UUID,
        resource_id: UUID,
        user_id: UUID,
    ):
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        if not scope_validator_service.can_access_project(
            db, user_id, project_id
        ):
            raise PermissionError(
                f"User does not have access to project {project_id}"
            )

        resource = resource_repository.get(db, resource_id)
        if not resource:
            raise ValueError(f"Resource with ID {resource_id} not found")
        if resource.resource_type != ResourceType.NON_LABOR:
            raise ValueError(
                "Non-labor plans can only use NON_LABOR resources"
            )
        return project, resource

    @staticmethod
    def _generate(
        definition: NonLaborPlanDefinition,
    ) -> List[GeneratedOccurrence]:
        if definition.method == NonLaborPlanMethod.MANUAL:
            return normalize_manual_occurrences(
                GeneratedOccurrence(item.occurrence_date, item.amount)
                for item in definition.manual_occurrences
            )

        if definition.total_amount is None:
            raise ValueError(
                "Total amount is required for a straight-line spread"
            )
        if not all(
            (
                definition.schedule_start,
                definition.schedule_end,
                definition.frequency,
                definition.period_placement,
            )
        ):
            raise ValueError(
                "Start date, end date, frequency, and period placement are "
                "required for a straight-line spread"
            )
        return generate_straight_line_occurrences(
            total_amount=definition.total_amount,
            start_date=definition.schedule_start,
            end_date=definition.schedule_end,
            frequency=definition.frequency,
            placement=definition.period_placement,
        )

    @staticmethod
    def timeline_warnings(
        project, occurrences: Iterable[GeneratedOccurrence]
    ) -> List[str]:
        dates = [item.occurrence_date for item in occurrences]
        if not dates:
            return []
        warnings = []
        project_range = (
            f"Project date range: {project.start_date.isoformat()} to "
            f"{project.end_date.isoformat()}"
        )
        if min(dates) < project.start_date:
            warnings.append(
                "One or more cash flows occur before the project start date "
                f"({project_range})."
            )
        if max(dates) > project.end_date:
            warnings.append(
                "One or more cash flows occur after the project end date "
                f"({project_range})."
            )
        return warnings

    def preview(
        self,
        db: Session,
        definition: NonLaborPlanDefinition,
        project_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
    ):
        occurrences = self._generate(definition)
        warnings: List[str] = []
        if project_id:
            project = project_repository.get(db, project_id)
            if not project:
                raise ValueError(f"Project with ID {project_id} not found")
            if user_id and not scope_validator_service.can_access_project(
                db, user_id, project_id
            ):
                raise PermissionError(
                    f"User does not have access to project {project_id}"
                )
            warnings = self.timeline_warnings(project, occurrences)
        return occurrences, warnings

    def create(
        self,
        db: Session,
        plan_in,
        user_id: UUID,
    ) -> NonLaborPlanLine:
        project, _resource = self._validate_context(
            db,
            plan_in.project_id,
            plan_in.resource_id,
            user_id,
        )
        generated = self._generate(plan_in)
        references = self._resolve_references(db, plan_in.references)
        exact_total = sum((item.amount for item in generated), Decimal("0"))
        plan = NonLaborPlanLine(
            project_id=plan_in.project_id,
            resource_id=plan_in.resource_id,
            name=plan_in.name,
            description=plan_in.description,
            forecast_basis=NonLaborForecastBasis.CASH,
            method=plan_in.method,
            cost_treatment=plan_in.cost_treatment,
            currency_code=project.currency_code,
            total_amount=exact_total,
            schedule_start=plan_in.schedule_start,
            schedule_end=plan_in.schedule_end,
            frequency=plan_in.frequency,
            period_placement=plan_in.period_placement,
            status=NonLaborPlanStatus.ACTIVE,
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
        )
        db.add(plan)
        db.flush()

        source = (
            NonLaborOccurrenceSource.MANUAL
            if plan_in.method == NonLaborPlanMethod.MANUAL
            else NonLaborOccurrenceSource.GENERATED
        )
        for item in generated:
            db.add(
                NonLaborPlanOccurrence(
                    plan_line_id=plan.id,
                    occurrence_date=item.occurrence_date,
                    base_amount=item.amount,
                    source=source,
                )
            )
        for reference in references:
            db.add(
                NonLaborPlanLineReference(
                    plan_line_id=plan.id,
                    external_reference_id=reference.id,
                )
            )
        db.commit()
        return self.get(db, plan.id)

    @staticmethod
    def _query(db: Session):
        return db.query(NonLaborPlanLine).options(
            joinedload(NonLaborPlanLine.project),
            joinedload(NonLaborPlanLine.resource),
            joinedload(NonLaborPlanLine.occurrences),
            joinedload(NonLaborPlanLine.reference_links)
            .joinedload(NonLaborPlanLineReference.external_reference)
            .joinedload(ExternalReference.reference_type),
        )

    def get(self, db: Session, plan_id: UUID) -> Optional[NonLaborPlanLine]:
        return self._query(db).filter(NonLaborPlanLine.id == plan_id).first()

    def list(
        self,
        db: Session,
        user_id: UUID,
        project_id: Optional[UUID] = None,
        resource_id: Optional[UUID] = None,
        include_cancelled: bool = False,
    ) -> List[NonLaborPlanLine]:
        accessible = scope_validator_service.get_user_accessible_projects(
            db, user_id
        )
        query = self._query(db).filter(
            NonLaborPlanLine.project_id.in_(accessible)
        )
        if project_id:
            query = query.filter(NonLaborPlanLine.project_id == project_id)
        if resource_id:
            query = query.filter(NonLaborPlanLine.resource_id == resource_id)
        if not include_cancelled:
            query = query.filter(
                NonLaborPlanLine.status == NonLaborPlanStatus.ACTIVE
            )
        return query.order_by(
            NonLaborPlanLine.name, NonLaborPlanLine.created_at
        ).all()

    def update(self, db: Session, plan_id: UUID, plan_in, user_id: UUID):
        plan = self.get(db, plan_id)
        if not plan:
            raise ValueError(f"Non-labor plan {plan_id} was not found")
        if not scope_validator_service.can_access_project(
            db, user_id, plan.project_id
        ):
            raise PermissionError(
                f"User does not have access to project {plan.project_id}"
            )
        if plan.version != plan_in.version:
            raise RuntimeError(
                "The non-labor plan was changed by another user"
            )
        if plan.status != NonLaborPlanStatus.ACTIVE:
            raise ValueError("Cancelled plans cannot be edited")

        generated = self._generate(plan_in)
        existing_by_date = {
            item.occurrence_date: item for item in plan.occurrences
        }
        new_dates = {item.occurrence_date for item in generated}
        for occurrence in list(plan.occurrences):
            if occurrence.occurrence_date not in new_dates:
                db.delete(occurrence)

        source = (
            NonLaborOccurrenceSource.MANUAL
            if plan_in.method == NonLaborPlanMethod.MANUAL
            else NonLaborOccurrenceSource.GENERATED
        )
        for item in generated:
            occurrence = existing_by_date.get(item.occurrence_date)
            if occurrence:
                occurrence.base_amount = item.amount
                occurrence.source = source
                if source == NonLaborOccurrenceSource.MANUAL:
                    occurrence.override_amount = None
            else:
                db.add(
                    NonLaborPlanOccurrence(
                        plan_line_id=plan.id,
                        occurrence_date=item.occurrence_date,
                        base_amount=item.amount,
                        source=source,
                    )
                )

        if plan_in.name is not None:
            plan.name = plan_in.name
        plan.description = plan_in.description
        if plan_in.cost_treatment is not None:
            plan.cost_treatment = plan_in.cost_treatment
        plan.method = plan_in.method
        plan.schedule_start = plan_in.schedule_start
        plan.schedule_end = plan_in.schedule_end
        plan.frequency = plan_in.frequency
        plan.period_placement = plan_in.period_placement
        plan.total_amount = sum(
            (item.amount for item in generated), Decimal("0")
        )
        plan.updated_by_user_id = user_id

        if plan_in.references is not None:
            references = self._resolve_references(db, plan_in.references)
            for link in list(plan.reference_links):
                db.delete(link)
            db.flush()
            for reference in references:
                db.add(
                    NonLaborPlanLineReference(
                        plan_line_id=plan.id,
                        external_reference_id=reference.id,
                    )
                )
        db.commit()
        return self.get(db, plan.id)

    def set_override(
        self,
        db: Session,
        plan_id: UUID,
        occurrence_id: UUID,
        amount: Optional[Decimal],
        version: int,
        user_id: UUID,
    ):
        plan = self.get(db, plan_id)
        if not plan:
            raise ValueError(f"Non-labor plan {plan_id} was not found")
        if not scope_validator_service.can_access_project(
            db, user_id, plan.project_id
        ):
            raise PermissionError(
                f"User does not have access to project {plan.project_id}"
            )
        if plan.version != version:
            raise RuntimeError(
                "The non-labor plan was changed by another user"
            )
        occurrence = next(
            (item for item in plan.occurrences if item.id == occurrence_id),
            None,
        )
        if not occurrence:
            raise ValueError(
                f"Occurrence {occurrence_id} was not found in this plan"
            )
        if occurrence.source == NonLaborOccurrenceSource.MANUAL:
            occurrence.base_amount = Decimal(amount or 0)
        else:
            occurrence.override_amount = (
                None if amount is None else Decimal(amount)
            )
        plan.updated_by_user_id = user_id
        plan.updated_at = datetime.utcnow()
        db.commit()
        return self.get(db, plan.id)

    def cancel(self, db: Session, plan_id: UUID, version: int, user_id: UUID):
        plan = self.get(db, plan_id)
        if not plan:
            raise ValueError(f"Non-labor plan {plan_id} was not found")
        if not scope_validator_service.can_access_project(
            db, user_id, plan.project_id
        ):
            raise PermissionError(
                f"User does not have access to project {plan.project_id}"
            )
        if plan.version != version:
            raise RuntimeError(
                "The non-labor plan was changed by another user"
            )
        plan.status = NonLaborPlanStatus.CANCELLED
        plan.updated_by_user_id = user_id
        db.commit()
        return self.get(db, plan.id)


nonlabor_plan_service = NonLaborPlanService()
