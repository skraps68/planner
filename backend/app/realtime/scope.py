"""Best-effort mapping of an ORM entity to the scope ids it belongs to.

Empty list == broadcast (no scope restriction). Because change events carry
only identifiers, broadcasting is low-risk; explicit scopes are provided where
they are cheap to derive so the SSE filter can narrow delivery.
"""
import re
from typing import Any, List

_CAMEL = re.compile(r"(?<!^)(?=[A-Z])")


def entity_type_name(obj: Any) -> str:
    return _CAMEL.sub("_", type(obj).__name__).lower()


def resolve_scope_ids(obj: Any) -> List[str]:
    name = entity_type_name(obj)
    if name in ("portfolio", "program", "project"):
        return [str(obj.id)] if getattr(obj, "id", None) is not None else []
    if name in (
        "project_phase",
        "resource_assignment",
        "non_labor_plan_line",
    ):
        pid = getattr(obj, "project_id", None)
        return [str(pid)] if pid is not None else []
    return []
