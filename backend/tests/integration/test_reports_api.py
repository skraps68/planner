"""
Integration tests for Reports API endpoints.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import MagicMock

from sqlalchemy.orm import Session

from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.models.rate import Rate
from app.models.user import User
from app.api import deps


def mock_get_current_user():
    """Mock current user for testing."""
    user = MagicMock(spec=User)
    user.id = "00000000-0000-0000-0000-000000000001"
    user.username = "testuser"
    user.email = "test@example.com"
    user.is_active = True
    return user


@pytest.fixture(scope="function")
def override_auth():
    """Override authentication dependency for tests."""
    from app.main import app
    app.dependency_overrides[deps.get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(deps.get_current_user, None)


@pytest.fixture
def db_session(client):
    """Get database session for test setup."""
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def cleanup_database(db_session):
    """Clean up database before each test."""
    # Delete all records in reverse order of dependencies
    db_session.query(Actual).delete()
    db_session.query(ResourceAssignment).delete()
    db_session.query(Resource).delete()
    db_session.query(Rate).delete()
    db_session.query(Worker).delete()
    db_session.query(WorkerType).delete()
    db_session.query(ProjectPhase).delete()
    db_session.query(Project).delete()
    db_session.query(Program).delete()
    db_session.commit()
    yield
    # Clean up after test as well
    db_session.query(Actual).delete()
    db_session.query(ResourceAssignment).delete()
    db_session.query(Resource).delete()
    db_session.query(Rate).delete()
    db_session.query(Worker).delete()
    db_session.query(WorkerType).delete()
    db_session.query(ProjectPhase).delete()
    db_session.query(Project).delete()
    db_session.query(Program).delete()
    db_session.commit()


@pytest.fixture
def sample_program(db_session):
    """Create a sample program."""
    program = Program(
        name="Test Program",
        business_sponsor="John Doe",
        program_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31)
    )
    db_session.add(program)
    db_session.commit()
    db_session.refresh(program)
    return program


@pytest.fixture
def sample_project(db_session, sample_program):
    """Create a sample project with phases."""
    # Use UUID to ensure unique cost_center_code
    unique_code = f"CC{str(uuid4())[:8]}"
    
    project = Project(
        program_id=sample_program.id,
        name="Test Project",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code=unique_code
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    
    # Add execution phase
    execution_phase = ProjectPhase(
        project_id=project.id,
        name="Execution Phase",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        capital_budget=Decimal("50000.00"),
        expense_budget=Decimal("30000.00"),
        total_budget=Decimal("80000.00")
    )
    db_session.add(execution_phase)
    db_session.commit()
    
    return project


@pytest.fixture
def sample_worker_type(db_session):
    """Create a sample worker type."""
    worker_type = WorkerType(
        type="Engineer",
        description="Software Engineer"
    )
    db_session.add(worker_type)
    db_session.commit()
    db_session.refresh(worker_type)
    return worker_type


@pytest.fixture
def sample_worker(db_session, sample_worker_type):
    """Create a sample worker."""
    worker = Worker(
        external_id="EMP001",
        name="John Worker",
        worker_type_id=sample_worker_type.id
    )
    db_session.add(worker)
    db_session.commit()
    db_session.refresh(worker)
    return worker


@pytest.fixture
def sample_rate(db_session, sample_worker_type):
    """Create a sample rate."""
    rate = Rate(
        worker_type_id=sample_worker_type.id,
        rate_amount=Decimal("500.00"),
        start_date=date(2024, 1, 1),
        end_date=date(2099, 12, 31)
    )
    db_session.add(rate)
    db_session.commit()
    db_session.refresh(rate)
    return rate


@pytest.fixture
def sample_resource(db_session, sample_worker):
    """Create a sample resource."""
    resource = Resource(
        name="John Worker",
        resource_type=ResourceType.LABOR,
        description="Software Engineer"
    )
    db_session.add(resource)
    db_session.commit()
    db_session.refresh(resource)
    return resource


@pytest.fixture
def sample_assignment(db_session, sample_project, sample_resource):
    """Create a sample resource assignment."""
    phases = db_session.query(ProjectPhase).filter(ProjectPhase.project_id == sample_project.id).all()
    execution_phase = phases[0] if phases else None
    
    assignment = ResourceAssignment(
        resource_id=sample_resource.id,
        project_id=sample_project.id,
        assignment_date=date(2024, 6, 15),
        allocation_percentage=Decimal("75.0"),
        capital_percentage=Decimal("60.0"),
        expense_percentage=Decimal("40.0")
    )
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)
    return assignment


@pytest.fixture
def sample_actual(db_session, sample_project):
    """Create a sample actual."""
    actual = Actual(
        project_id=sample_project.id,
        external_worker_id="EMP001",
        worker_name="John Worker",
        actual_date=date(2024, 3, 15),
        allocation_percentage=Decimal("80.0"),
        actual_cost=Decimal("400.00"),
        capital_amount=Decimal("240.00"),
        expense_amount=Decimal("160.00")
    )
    db_session.add(actual)
    db_session.commit()
    db_session.refresh(actual)
    return actual


class TestForecastingEndpoints:
    """Test forecasting endpoints."""
    
    def test_get_project_forecast(self, client, override_auth, sample_project, sample_actual):
        """Test getting project forecast."""
        response = client.get(f"/api/v1/reports/forecast/project/{sample_project.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["entity_id"] == str(sample_project.id)
        assert data["entity_name"] == sample_project.name
        assert data["entity_type"] == "project"
        assert "budget" in data
        assert "actual" in data
        assert "forecast" in data
        assert "analysis" in data
    
    def test_get_project_forecast_with_date(self, client, override_auth, sample_project, sample_actual):
        """Test getting project forecast with specific date."""
        as_of_date = "2024-06-30"
        response = client.get(
            f"/api/v1/reports/forecast/project/{sample_project.id}",
            params={"as_of_date": as_of_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["entity_id"] == str(sample_project.id)
    
    def test_get_project_forecast_not_found(self, client, override_auth):
        """Test getting forecast for non-existent project."""
        fake_id = "00000000-0000-0000-0000-000000000099"
        response = client.get(f"/api/v1/reports/forecast/project/{fake_id}")
        
        assert response.status_code == 404
    
    def test_get_program_forecast(self, client, override_auth, sample_program, sample_project, sample_actual):
        """Test getting program forecast."""
        response = client.get(f"/api/v1/reports/forecast/program/{sample_program.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["entity_id"] == str(sample_program.id)
        assert data["entity_name"] == sample_program.name
        assert data["entity_type"] == "program"
        assert "budget" in data
        assert "actual" in data
        assert "forecast" in data
    
    def test_get_program_forecast_not_found(self, client, override_auth):
        """Test getting forecast for non-existent program."""
        fake_id = "00000000-0000-0000-0000-000000000099"
        response = client.get(f"/api/v1/reports/forecast/program/{fake_id}")
        
        assert response.status_code == 404


class TestBudgetVsActualEndpoints:
    """Test budget vs actual vs forecast endpoints."""
    
    def test_get_budget_vs_actual_project(self, client, override_auth, sample_project, sample_actual):
        """Test getting budget vs actual vs forecast for project."""
        response = client.get(
            f"/api/v1/reports/budget-vs-actual/project/{sample_project.id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["entity_type"] == "project"
        assert "budget" in data
        assert "actual" in data
        assert "forecast" in data
        assert "analysis" in data
    
    def test_get_budget_vs_actual_program(self, client, override_auth, sample_program, sample_project, sample_actual):
        """Test getting budget vs actual vs forecast for program."""
        response = client.get(
            f"/api/v1/reports/budget-vs-actual/program/{sample_program.id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["entity_type"] == "program"
    
    def test_get_budget_vs_actual_invalid_type(self, client, override_auth, sample_project):
        """Test getting budget vs actual with invalid entity type."""
        response = client.get(
            f"/api/v1/reports/budget-vs-actual/invalid/{sample_project.id}"
        )
        
        assert response.status_code == 400
        assert "entity_type must be" in response.json()["detail"]


class TestCostProjectionEndpoints:
    """Test cost projection endpoints."""
    
    def test_get_project_cost_projection(self, client, override_auth, sample_project, sample_assignment):
        """Test getting project cost projection."""
        start_date = "2024-06-01"
        end_date = "2024-06-30"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/cost-projection",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project_id"] == str(sample_project.id)
        assert data["project_name"] == sample_project.name
        assert "period" in data
        assert "summary" in data
        assert "daily_projections" in data
    
    def test_get_project_cost_projection_invalid_dates(self, client, override_auth, sample_project):
        """Test cost projection with invalid date range."""
        start_date = "2024-06-30"
        end_date = "2024-06-01"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/cost-projection",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 400


class TestReportingEndpoints:
    """Test reporting endpoints."""
    
    def test_get_project_report(self, client, override_auth, sample_project, sample_actual):
        """Test getting project report."""
        response = client.get(f"/api/v1/reports/project/{sample_project.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project_id"] == str(sample_project.id)
        assert data["project_name"] == sample_project.name
        assert "financial_summary" in data
        assert "variance_analysis" in data
    
    def test_get_project_report_without_variance(self, client, override_auth, sample_project, sample_actual):
        """Test getting project report without variance analysis."""
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}",
            params={"include_variance": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "financial_summary" in data
    
    def test_get_program_report(self, client, override_auth, sample_program, sample_project, sample_actual):
        """Test getting program report."""
        response = client.get(f"/api/v1/reports/program/{sample_program.id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["program_id"] == str(sample_program.id)
        assert data["program_name"] == sample_program.name
        assert "financial_summary" in data
        assert "projects" in data
    
    def test_get_program_report_without_projects(self, client, override_auth, sample_program, sample_project):
        """Test getting program report without project details."""
        response = client.get(
            f"/api/v1/reports/program/{sample_program.id}",
            params={"include_projects": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "financial_summary" in data
    
    def test_get_budget_status_report(self, client, override_auth, sample_project, sample_actual):
        """Test getting budget status report."""
        response = client.get(
            f"/api/v1/reports/budget-status/project/{sample_project.id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "budget" in data
        assert "actual" in data
        assert "forecast" in data
        assert "status" in data
        assert "budget_status" in data["status"]
        assert "completion_status" in data["status"]
    
    def test_get_time_series_report(self, client, override_auth, sample_project, sample_actual):
        """Test getting time-series report."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/time-series",
            params={"start_date": start_date, "end_date": end_date, "interval": "monthly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project_id"] == str(sample_project.id)
        assert "time_series" in data
        assert "summary" in data
    
    def test_get_time_series_report_invalid_interval(self, client, override_auth, sample_project):
        """Test time-series report with invalid interval."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/time-series",
            params={"start_date": start_date, "end_date": end_date, "interval": "invalid"}
        )
        
        assert response.status_code == 400
    
    def test_get_drill_down_report(self, client, override_auth, sample_project, sample_actual):
        """Test getting drill-down report."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/drill-down",
            params={"start_date": start_date, "end_date": end_date, "group_by": "worker"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project_id"] == str(sample_project.id)
        assert data["group_by"] == "worker"
        assert "breakdown" in data
        assert "summary" in data


class TestVarianceEndpoints:
    """Test variance analysis endpoints."""
    
    def test_get_variance_report(self, client, override_auth, sample_project, sample_actual):
        """Test getting variance analysis report."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/variance",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project_id"] == str(sample_project.id)
        assert "summary" in data
        assert "variances" in data
    
    def test_get_variance_report_with_thresholds(self, client, override_auth, sample_project, sample_actual):
        """Test variance report with custom thresholds."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/variance",
            params={
                "start_date": start_date,
                "end_date": end_date,
                "allocation_threshold": 15.0,
                "cost_threshold": 10.0
            }
        )
        
        assert response.status_code == 200
    
    def test_get_variance_exceptions(self, client, override_auth, sample_project, sample_actual):
        """Test getting variance exceptions."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/variance/exceptions",
            params={"start_date": start_date, "end_date": end_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["project_id"] == str(sample_project.id)
        assert "exceptions_count" in data
        assert "exceptions" in data
        assert "thresholds" in data
    
    def test_get_variance_exceptions_with_thresholds(self, client, override_auth, sample_project, sample_actual):
        """Test variance exceptions with custom thresholds."""
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = client.get(
            f"/api/v1/reports/project/{sample_project.id}/variance/exceptions",
            params={
                "start_date": start_date,
                "end_date": end_date,
                "allocation_threshold": 40.0,
                "cost_threshold": 30.0
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["thresholds"]["allocation_threshold"] == 40.0
        assert data["thresholds"]["cost_threshold"] == 30.0
