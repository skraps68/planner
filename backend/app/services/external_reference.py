"""Admin management for external reference types."""
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.nonlabor_plan import ExternalReference, ExternalReferenceType


class ExternalReferenceService:
    """Resolve reusable identifiers shared by resources and plan lines."""

    @staticmethod
    def get_or_create(db: Session, reference_type_id: UUID, value: str):
        reference_type = (
            db.query(ExternalReferenceType)
            .filter(ExternalReferenceType.id == reference_type_id)
            .first()
        )
        if not reference_type:
            raise ValueError(
                f"External reference type {reference_type_id} was not found"
            )
        if not reference_type.is_active:
            raise ValueError(
                f"External reference type '{reference_type.name}' is inactive"
            )

        normalized = value.upper()
        existing = (
            db.query(ExternalReference)
            .filter(
                ExternalReference.reference_type_id == reference_type_id,
                ExternalReference.normalized_value == normalized,
            )
            .first()
        )
        if existing:
            return existing

        reference = ExternalReference(
            reference_type_id=reference_type_id,
            value=value,
            normalized_value=normalized,
        )
        db.add(reference)
        db.flush()
        return reference


class ExternalReferenceTypeService:
    @staticmethod
    def list(db: Session):
        return (
            db.query(ExternalReferenceType)
            .order_by(ExternalReferenceType.name)
            .all()
        )

    @staticmethod
    def get(db: Session, type_id: UUID):
        return (
            db.query(ExternalReferenceType)
            .filter(ExternalReferenceType.id == type_id)
            .first()
        )

    def count_references(self, db: Session, type_id: UUID) -> int:
        return (
            db.query(func.count(ExternalReference.id))
            .filter(ExternalReference.reference_type_id == type_id)
            .scalar()
            or 0
        )

    def create(self, db: Session, name: str, description: str):
        existing = (
            db.query(ExternalReferenceType)
            .filter(func.lower(ExternalReferenceType.name) == name.lower())
            .first()
        )
        if existing:
            raise ValueError(
                f"External reference type '{name}' already exists"
            )
        item = ExternalReferenceType(
            name=name, description=description, is_active=True
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def update(
        self,
        db: Session,
        type_id: UUID,
        version: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None,
    ):
        item = self.get(db, type_id)
        if not item:
            raise ValueError(
                f"External reference type {type_id} was not found"
            )
        if item.version != version:
            raise RuntimeError(
                "The reference type was changed by another user"
            )
        if name is not None:
            existing = (
                db.query(ExternalReferenceType)
                .filter(
                    func.lower(ExternalReferenceType.name) == name.lower(),
                    ExternalReferenceType.id != type_id,
                )
                .first()
            )
            if existing:
                raise ValueError(
                    f"External reference type '{name}' already exists"
                )
            item.name = name
        if description is not None:
            item.description = description
        if is_active is not None:
            item.is_active = is_active
        db.commit()
        db.refresh(item)
        return item


external_reference_type_service = ExternalReferenceTypeService()
external_reference_service = ExternalReferenceService()
