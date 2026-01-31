"""
Integration tests for Actuals API endpoints.
"""
import pytest
from datetime import date
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Worker, WorkerType
from app.models.rate import Rate
from app.models.user import User
from app.api.deps import get_current_user
from app.main import app


def override_get_current_user():
    """Override current user dependency for testing."""
    # Return a mock user for testing
    return User(
        id=uuid4(),
        username="testuser",
        email="test@example.com",
        is_active=True
    )


@pytest.fixture(autouse=True)
def override_auth():
    """Override authentication for all tests in this module."""
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def db_session():
    """Get database session for test setup."""
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
        db.rollback()  # Rollback any uncommitted changes
    finally:
        db.close()


@pytest.fixture
def sample_program(db_session):
    """Create a sample program."""
    # Use unique name to avoid conflicts
    import uuid
    program = Program(
        name=f"Test Program {uuid.uuid4().hex[:8]}",
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
    """Create a sample project."""
    # Use unique cost center code to avoid UNIQUE constraint violations
    import uuid
    project = Project(
        program_id=sample_program.id,
        name=f"Test Project {uuid.uuid4().hex[:8]}",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code=f"CC{uuid.uuid4().hex[:8]}"
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    
    # Add execution phase
    phase = ProjectPhase(
        project_id=project.id,
        name="Execution Phase",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        capital_budget=Decimal('50000.00'),
        expense_budget=Decimal('50000.00'),
        total_budget=Decimal('100000.00')
    )
    db_session.add(phase)
    db_session.commit()
    
    return project


@pytest.fixture
def sample_worker_type(db_session):
    """Create a sample worker type."""
    # Use unique type name to avoid conflicts
    import uuid
    worker_type = WorkerType(
        type=f"Software Engineer {uuid.uuid4().hex[:8]}",
        description="Software development professional"
    )
    db_session.add(worker_type)
    db_session.commit()
    db_session.refresh(worker_type)
    return worker_type


@pytest.fixture
def sample_worker(db_session, sample_worker_type):
    """Create a sample worker."""
    # Use unique external_id to avoid conflicts
    import uuid
    external_id = f"EMP{uuid.uuid4().hex[:8]}"
    worker = Worker(
        external_id=external_id,
        name="John Smith",
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
        rate_amount=Decimal('500.00'),
        start_date=date(2024, 1, 1),
        end_date=None
    )
    db_session.add(rate)
    db_session.commit()
    db_session.refresh(rate)
    return rate


class TestActualsAPI:
    """Test Actuals API endpoints."""
    
    def test_create_actual(self, client, sample_project, sample_worker, sample_rate):
        """Test creating a new actual."""
        response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 75.0
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == str(sample_project.id)
        assert data["external_worker_id"] == sample_worker.external_id
        assert float(data["allocation_percentage"]) == 75.0
    
    def test_create_actual_invalid_project(self, client, sample_worker, sample_rate):
        """Test creating actual with invalid project."""
        response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": "00000000-0000-0000-0000-000000000000",
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 75.0
            }
        )
        
        # The API returns 404 when project is not found
        assert response.status_code == 404
    
    def test_list_actuals(self, client, sample_project, sample_worker, sample_rate):
        """Test listing actuals."""
        # Create some actuals
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        
        response = client.get("/api/v1/actuals/")
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0
    
    def test_list_actuals_by_project(self, client, sample_project, sample_worker, sample_rate):
        """Test listing actuals filtered by project."""
        # Create actual
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        
        response = client.get(f"/api/v1/actuals/?project_id={sample_project.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["project_id"] == str(sample_project.id)
    
    def test_get_actual_by_id(self, client, sample_project, sample_worker, sample_rate):
        """Test getting a specific actual by ID."""
        # Create actual
        create_response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 75.0
            }
        )
        actual_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/actuals/{actual_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == actual_id
        assert float(data["allocation_percentage"]) == 75.0
    
    def test_update_actual(self, client, sample_project, sample_worker, sample_rate):
        """Test updating an actual."""
        # Create actual
        create_response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        actual_id = create_response.json()["id"]
        
        # Update actual
        response = client.put(
            f"/api/v1/actuals/{actual_id}",
            json={
                "allocation_percentage": 60.0
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        # The API may return allocation_percentage as string or float
        assert float(data["allocation_percentage"]) == 60.0
    
    def test_delete_actual(self, client, sample_project, sample_worker, sample_rate):
        """Test deleting an actual."""
        # Create actual
        create_response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        actual_id = create_response.json()["id"]
        
        # Delete actual
        response = client.delete(f"/api/v1/actuals/{actual_id}")
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verify deletion
        get_response = client.get(f"/api/v1/actuals/{actual_id}")
        assert get_response.status_code == 404
    
    def test_import_actuals_csv(self, client, sample_project, sample_worker, sample_rate):
        """Test importing actuals from CSV."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},{sample_worker.external_id},John Smith,2024-01-15,50.0
{sample_project.id},{sample_worker.external_id},John Smith,2024-01-16,60.0"""
        
        files = {"file": ("actuals.csv", BytesIO(csv_content.encode()), "text/csv")}
        response = client.post("/api/v1/actuals/import", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 2
        assert data["successful_imports"] == 2
        assert data["failed_imports"] == 0
    
    def test_import_actuals_validation_only(self, client, sample_project, sample_worker, sample_rate):
        """Test validating actuals import without importing."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},{sample_worker.external_id},John Smith,2024-01-15,50.0"""
        
        files = {"file": ("actuals.csv", BytesIO(csv_content.encode()), "text/csv")}
        response = client.post("/api/v1/actuals/import?validate_only=true", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["validation_only"] is True
        assert data["total_rows"] == 1
    
    def test_get_project_total_cost(self, client, sample_project, sample_worker, sample_rate):
        """Test getting total cost for a project."""
        # Create actuals
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-16",
                "allocation_percentage": 75.0
            }
        )
        
        response = client.get(f"/api/v1/actuals/project/{sample_project.id}/total-cost")
        
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == str(sample_project.id)
        assert data["total_cost"] == 625.0
    
    def test_get_variance_analysis(self, client, sample_project, sample_worker, sample_rate):
        """Test getting variance analysis for a project."""
        # Create actual
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": sample_worker.external_id,
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        
        response = client.get(
            f"/api/v1/actuals/variance/{sample_project.id}?start_date=2024-01-01&end_date=2024-01-31"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "variances" in data
    
    def test_check_allocation_conflicts(self, client, sample_project, sample_worker, sample_rate):
        """Test checking for allocation conflicts."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},{sample_worker.external_id},John Smith,2024-01-15,60.0
{sample_project.id},{sample_worker.external_id},John Smith,2024-01-15,50.0"""
        
        files = {"file": ("actuals.csv", BytesIO(csv_content.encode()), "text/csv")}
        response = client.post("/api/v1/actuals/check-allocation-conflicts", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_conflicts"] is True
        assert len(data["conflicts"]) > 0
