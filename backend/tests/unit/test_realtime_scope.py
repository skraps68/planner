from app.realtime.scope import entity_type_name, resolve_scope_ids


def test_entity_type_name_snakecases_class():
    class ResourceAssignment: ...
    assert entity_type_name(ResourceAssignment()) == "resource_assignment"


def test_project_scopes_to_self_id():
    class Project: ...
    p = Project(); p.id = "p1"
    assert resolve_scope_ids(p) == ["p1"]


def test_assignment_scopes_to_project_id():
    class ResourceAssignment: ...
    a = ResourceAssignment(); a.id = "a1"; a.project_id = "p9"
    assert resolve_scope_ids(a) == ["p9"]


def test_nonlabor_plan_scopes_to_project_id():
    class NonLaborPlanLine: ...
    plan = NonLaborPlanLine(); plan.id = "n1"; plan.project_id = "p9"
    assert resolve_scope_ids(plan) == ["p9"]


def test_unknown_entity_broadcasts():
    class Worker: ...
    w = Worker(); w.id = "w1"
    assert resolve_scope_ids(w) == []
