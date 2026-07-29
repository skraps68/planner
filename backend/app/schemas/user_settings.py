"""Validated user presentation settings document and API payloads."""
import json
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.schemas.base import BaseSchema


class SettingsSchema(BaseSchema):
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        extra="forbid",
    )


class HierarchyPaneSettings(SettingsSchema):
    width: Optional[int] = Field(default=None, ge=200, le=520)
    collapsed: Optional[bool] = None


class NavigationSettings(SettingsSchema):
    hierarchyPane: Optional[HierarchyPaneSettings] = None
    hierarchyLabelMode: Optional[Literal["name", "business_id"]] = None
    landingDestination: Optional[
        Literal["hierarchy", "workers", "reference_data", "users", "resources", "actuals"]
    ] = None


class ResourceListSettings(SettingsSchema):
    defaultTab: Optional[Literal["labor", "non_labor"]] = None


class ListSettings(SettingsSchema):
    resources: Optional[ResourceListSettings] = None


class AssignmentGridSettings(SettingsSchema):
    period: Optional[Literal["daily", "weekly", "monthly"]] = None
    chartVisible: Optional[bool] = None
    displayMode: Optional[Literal["combined", "plan", "actual", "variance"]] = None


class AssignmentGridCollection(SettingsSchema):
    projectPerspective: Optional[Literal["labor", "non_labor"]] = None
    project: Optional[AssignmentGridSettings] = None
    resource: Optional[AssignmentGridSettings] = None
    nonLaborProject: Optional[AssignmentGridSettings] = None
    nonLaborResource: Optional[AssignmentGridSettings] = None


class GridSettings(SettingsSchema):
    density: Optional[Literal["compact", "standard", "comfortable"]] = None
    columnOrder: Optional[List[str]] = Field(default=None, max_length=200)
    columnVisibility: Optional[Dict[str, bool]] = None
    columnWidths: Optional[Dict[str, int]] = None

    @field_validator("columnWidths")
    @classmethod
    def validate_column_widths(cls, widths):
        if widths is None:
            return widths
        if len(widths) > 200 or any(width < 40 or width > 2000 for width in widths.values()):
            raise ValueError("Column widths must contain at most 200 values between 40 and 2000")
        return widths


class UserSettingsDocument(SettingsSchema):
    navigation: Optional[NavigationSettings] = None
    lists: Optional[ListSettings] = None
    assignmentGrids: Optional[AssignmentGridCollection] = None
    grids: Optional[Dict[str, GridSettings]] = None


class UserSettingsPatchRequest(BaseSchema):
    version: int = Field(ge=0)
    patch: Dict[str, Any]

    @model_validator(mode="after")
    def validate_patch_size(self):
        if len(json.dumps(self.patch).encode("utf-8")) > 128 * 1024:
            raise ValueError("Settings patch cannot exceed 128 KiB")
        return self


class UserSettingsResponse(BaseSchema):
    settings_schema_version: int
    settings: UserSettingsDocument
    version: int
    created_at: datetime
    updated_at: datetime
