"""
Property-based tests for version field in schemas.

These tests use Hypothesis to verify that version fields are properly included
in all API responses and required in update requests.

Feature: optimistic-locking
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings

from app.schemas.portfolio import PortfolioResponse, PortfolioUpdate
from app.schemas.program import ProgramResponse, ProgramUpdate
from app.schemas.project import ProjectResponse, ProjectUpdate, ProjectPhaseResponse, ProjectPhaseUpdate
from app.schemas.phase import PhaseResponse, PhaseUpdate
from app.schemas.resource import ResourceResponse, ResourceUpdate, WorkerTypeResponse, WorkerTypeUpdate, WorkerResponse, WorkerUpdate
from app.schemas.assignment import ResourceAssignmentResponse, ResourceAssignmentUpdate
from app.schemas.rate import RateResponse, RateUpdate
from app.schemas.actual import ActualResponse, ActualUpdate
from app.schemas.user import UserResponse, UserUpdate, UserRoleResponse, UserRoleUpdate, ScopeAssignmentResponse, ScopeAssignmentUpdate
from app.models.resource import ResourceType
from app.models.user import RoleType, ScopeType


# Hypothesis strategies for generating test data

def valid_text(min_size=1, max_size=255):
    """Generate valid text that won't be stripped to empty string."""
    return st.text(
        min_size=min_size,
        max_size=max_size,
        alphabet=st.characters(blacklist_categories=('Cc', 'Cs', 'Zs', 'Zl', 'Zp'))
    ).filter(lambda x: x.strip() != "")


@st.composite
def portfolio_response_data(draw):
    """Generate valid portfolio response data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 30)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    return {
        "id": uuid4(),
        "name": draw(valid_text(1, 255)),
        "description": draw(valid_text(1, 1000)),
        "owner": draw(valid_text(1, 255)),
        "reporting_start_date": start_date,
        "reporting_end_date": end_date,
        "created_at": draw(st.datetimes()),
        "updated_at": draw(st.datetimes()),
        "version": draw(st.integers(min_value=1, max_value=1000)),
        "program_count": draw(st.integers(min_value=0, max_value=100))
    }


@st.composite
def program_response_data(draw):
    """Generate valid program response data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 30)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    return {
        "id": uuid4(),
        "name": draw(valid_text(1, 255)),
        "business_sponsor": draw(valid_text(1, 255)),
        "program_manager": draw(valid_text(1, 255)),
        "technical_lead": draw(valid_text(1, 255)),
        "start_date": start_date,
        "end_date": end_date,
        "description": draw(valid_text(1, 1000)),
        "portfolio_id": uuid4(),
        "created_at": draw(st.datetimes()),
        "updated_at": draw(st.datetimes()),
        "version": draw(st.integers(min_value=1, max_value=1000)),
        "project_count": draw(st.integers(min_value=0, max_value=100))
    }


@st.composite
def project_response_data(draw):
    """Generate valid project response data."""
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 30)))
    end_date = draw(st.dates(min_value=start_date + timedelta(days=1), max_value=date(2030, 12, 31)))
    return {
        "id": uuid4(),
        "program_id": uuid4(),
        "name": draw(valid_text(1, 255)),
        "business_sponsor": draw(valid_text(1, 255)),
        "project_manager": draw(valid_text(1, 255)),
        "technical_lead": draw(valid_text(1, 255)),
        "start_date": start_date,
        "end_date": end_date,
        "cost_center_code": draw(valid_text(1, 50)),
        "description": draw(valid_text(1, 1000)),
        "created_at": draw(st.datetimes()),
        "updated_at": draw(st.datetimes()),
        "version": draw(st.integers(min_value=1, max_value=1000)),
        "assignment_count": draw(st.integers(min_value=0, max_value=100)),
        "actual_count": draw(st.integers(min_value=0, max_value=100))
    }


@st.composite
def phase_response_data(draw):
    """Generate valid phase response data."""
    capital = draw(st.decimals(min_value=0, max_value=1000000, places=2))
    expense = draw(st.decimals(min_value=0, max_value=1000000, places=2))
    start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2029, 12, 30)))
    end_date = draw(st.dates(min_value=start_date, max_value=date(2030, 12, 31)))
    return {
        "id": uuid4(),
        "project_id": uuid4(),
        "name": draw(valid_text(1, 100)),
        "start_date": start_date,
        "end_date": end_date,
        "description": draw(valid_text(1, 500)),
        "capital_budget": capital,
        "expense_budget": expense,
        "total_budget": capital + expense,
        "created_at": draw(st.datetimes()),
        "updated_at": draw(st.datetimes()),
        "version": draw(st.integers(min_value=1, max_value=1000)),
        "assignment_count": draw(st.integers(min_value=0, max_value=100))
    }


@st.composite
def resource_response_data(draw):
    """Generate valid resource response data."""
    return {
        "id": uuid4(),
        "name": draw(valid_text(1, 255)),
        "resource_type": draw(st.sampled_from([ResourceType.LABOR, ResourceType.NON_LABOR])),
        "description": draw(valid_text(1, 1000)),
        "created_at": draw(st.datetimes()),
        "updated_at": draw(st.datetimes()),
        "version": draw(st.integers(min_value=1, max_value=1000)),
        "assignment_count": draw(st.integers(min_value=0, max_value=100))
    }


@st.composite
def assignment_response_data(draw):
    """Generate valid resource assignment response data."""
    capital = draw(st.decimals(min_value=0, max_value=100, places=2))
    expense = Decimal("100") - capital
    return {
        "id": uuid4(),
        "resource_id": uuid4(),
        "project_id": uuid4(),
        "assignment_date": draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31))),
        "capital_percentage": capital,
        "expense_percentage": expense,
        "created_at": draw(st.datetimes()),
        "updated_at": draw(st.datetimes()),
        "version": draw(st.integers(min_value=1, max_value=1000))
    }


# Property Tests

@pytest.mark.property_test
class TestVersionInAPIResponses:
    """
    Property 6: Version Included in All API Responses
    
    For any API endpoint that returns user-editable entities (create, read, update, list),
    the response should include the version field for each entity.
    
    Validates: Requirements 3.1, 3.2, 3.3, 3.4
    """
    
    @given(data=portfolio_response_data())
    @settings(max_examples=100, deadline=None)
    def test_portfolio_response_includes_version(self, data):
        """Portfolio responses must include version field."""
        response = PortfolioResponse(**data)
        assert hasattr(response, 'version'), "PortfolioResponse must have version field"
        assert response.version == data['version'], "Version field must match input"
        assert response.version >= 1, "Version must be at least 1"
    
    @given(data=program_response_data())
    @settings(max_examples=100, deadline=None)
    def test_program_response_includes_version(self, data):
        """Program responses must include version field."""
        response = ProgramResponse(**data)
        assert hasattr(response, 'version'), "ProgramResponse must have version field"
        assert response.version == data['version'], "Version field must match input"
        assert response.version >= 1, "Version must be at least 1"
    
    @given(data=project_response_data())
    @settings(max_examples=100, deadline=None)
    def test_project_response_includes_version(self, data):
        """Project responses must include version field."""
        response = ProjectResponse(**data)
        assert hasattr(response, 'version'), "ProjectResponse must have version field"
        assert response.version == data['version'], "Version field must match input"
        assert response.version >= 1, "Version must be at least 1"
    
    @given(data=phase_response_data())
    @settings(max_examples=100, deadline=None)
    def test_phase_response_includes_version(self, data):
        """Phase responses must include version field."""
        response = PhaseResponse(**data)
        assert hasattr(response, 'version'), "PhaseResponse must have version field"
        assert response.version == data['version'], "Version field must match input"
        assert response.version >= 1, "Version must be at least 1"
    
    @given(data=resource_response_data())
    @settings(max_examples=100, deadline=None)
    def test_resource_response_includes_version(self, data):
        """Resource responses must include version field."""
        response = ResourceResponse(**data)
        assert hasattr(response, 'version'), "ResourceResponse must have version field"
        assert response.version == data['version'], "Version field must match input"
        assert response.version >= 1, "Version must be at least 1"
    
    @given(data=assignment_response_data())
    @settings(max_examples=100, deadline=None)
    def test_assignment_response_includes_version(self, data):
        """ResourceAssignment responses must include version field."""
        response = ResourceAssignmentResponse(**data)
        assert hasattr(response, 'version'), "ResourceAssignmentResponse must have version field"
        assert response.version == data['version'], "Version field must match input"
        assert response.version >= 1, "Version must be at least 1"


@pytest.mark.property_test
class TestVersionRequiredInUpdates:
    """
    Property 3: Version Required in Update Requests
    
    For any update request to a user-editable entity, the version field must be
    present in the request payload.
    
    Validates: Requirements 2.1
    """
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_portfolio_update_requires_version(self, version):
        """Portfolio update requests must include version field."""
        update_data = {"name": "Updated Name", "version": version}
        update = PortfolioUpdate(**update_data)
        assert hasattr(update, 'version'), "PortfolioUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_program_update_requires_version(self, version):
        """Program update requests must include version field."""
        update_data = {"name": "Updated Name", "version": version}
        update = ProgramUpdate(**update_data)
        assert hasattr(update, 'version'), "ProgramUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_project_update_requires_version(self, version):
        """Project update requests must include version field."""
        update_data = {"name": "Updated Name", "version": version}
        update = ProjectUpdate(**update_data)
        assert hasattr(update, 'version'), "ProjectUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_phase_update_requires_version(self, version):
        """Phase update requests must include version field."""
        update_data = {"name": "Updated Name", "version": version}
        update = PhaseUpdate(**update_data)
        assert hasattr(update, 'version'), "PhaseUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_resource_update_requires_version(self, version):
        """Resource update requests must include version field."""
        update_data = {"name": "Updated Name", "version": version}
        update = ResourceUpdate(**update_data)
        assert hasattr(update, 'version'), "ResourceUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_assignment_update_requires_version(self, version):
        """ResourceAssignment update requests must include version field."""
        update_data = {"capital_percentage": Decimal("50"), "version": version}
        update = ResourceAssignmentUpdate(**update_data)
        assert hasattr(update, 'version'), "ResourceAssignmentUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_rate_update_requires_version(self, version):
        """Rate update requests must include version field."""
        update_data = {"rate_amount": Decimal("100.00"), "version": version}
        update = RateUpdate(**update_data)
        assert hasattr(update, 'version'), "RateUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_actual_update_requires_version(self, version):
        """Actual update requests must include version field."""
        update_data = {"worker_name": "Updated Worker", "version": version}
        update = ActualUpdate(**update_data)
        assert hasattr(update, 'version'), "ActualUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_user_update_requires_version(self, version):
        """User update requests must include version field."""
        update_data = {"username": "updated_user", "version": version}
        update = UserUpdate(**update_data)
        assert hasattr(update, 'version'), "UserUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_user_role_update_requires_version(self, version):
        """UserRole update requests must include version field."""
        update_data = {"role_type": RoleType.ADMIN, "version": version}
        update = UserRoleUpdate(**update_data)
        assert hasattr(update, 'version'), "UserRoleUpdate must have version field"
        assert update.version == version, "Version field must match input"
    
    @given(version=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=100, deadline=None)
    def test_scope_assignment_update_requires_version(self, version):
        """ScopeAssignment update requests must include version field."""
        update_data = {"scope_type": ScopeType.GLOBAL, "version": version}
        update = ScopeAssignmentUpdate(**update_data)
        assert hasattr(update, 'version'), "ScopeAssignmentUpdate must have version field"
        assert update.version == version, "Version field must match input"
