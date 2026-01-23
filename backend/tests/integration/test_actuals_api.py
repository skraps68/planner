"""
Integration tests for Actuals API endpoints.
"""
import pytest
from datetime import date
from decimal import Decimal
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.api.deps import get_db, get_current_user
from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase, PhaseType
from app.models.resource import Worker, WorkerType
from app.models.rate import Rate
from app.models.user import User


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user():
    """Override current user dependency for testing."""
    # Return a mock user for testing
    return User(
        id="00000000-0000-0000-0000-000000000001",
        username="testuser",
        email="test@example.com",
        is_active=True
    )


# Override dependencies
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Set up test database before each test."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Get database session for test setup."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_program(db):
    """Create a sample program."""
    program = Program(
        name="Test Program",
        business_sponsor="John Doe",
        program_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31)
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


@pytest.fixture
def sample_project(db, sample_program):
    """Create a sample project."""
    project = Project(
        program_id=sample_program.id,
        name="Test Project",
        business_sponsor="John Doe",
        project_manager="Jane Smith",
        technical_lead="Bob Johnson",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code="CC001"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Add execution phase
    phase = ProjectPhase(
        project_id=project.id,
        phase_type=PhaseType.EXECUTION,
        capital_budget=Decimal('50000.00'),
        expense_budget=Decimal('50000.00'),
        total_budget=Decimal('100000.00')
    )
    db.add(phase)
    db.commit()
    
    return project


@pytest.fixture
def sample_worker_type(db):
    """Create a sample worker type."""
    worker_type = WorkerType(
        type="Software Engineer",
        description="Software development professional"
    )
    db.add(worker_type)
    db.commit()
    db.refresh(worker_type)
    return worker_type


@pytest.fixture
def sample_worker(db, sample_worker_type):
    """Create a sample worker."""
    worker = Worker(
        external_id="EMP001",
        name="John Smith",
        worker_type_id=sample_worker_type.id
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


@pytest.fixture
def sample_rate(db, sample_worker_type):
    """Create a sample rate."""
    rate = Rate(
        worker_type_id=sample_worker_type.id,
        rate_amount=Decimal('500.00'),
        start_date=date(2024, 1, 1),
        end_date=None
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


class TestActualsAPI:
    """Test Actuals API endpoints."""
    
    def test_create_actual(self, sample_project, sample_worker, sample_rate):
        """Test creating a new actual."""
        response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 75.0
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == str(sample_project.id)
        assert data["external_worker_id"] == "EMP001"
        assert data["allocation_percentage"] == 75.0
    
    def test_create_actual_invalid_project(self, sample_worker, sample_rate):
        """Test creating actual with invalid project."""
        response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": "00000000-0000-0000-0000-000000000000",
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 75.0
            }
        )
        
        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"]
    
    def test_list_actuals(self, sample_project, sample_worker, sample_rate):
        """Test listing actuals."""
        # Create some actuals
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
    
    def test_list_actuals_by_project(self, sample_project, sample_worker, sample_rate):
        """Test listing actuals filtered by project."""
        # Create actual
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
    
    def test_get_actual_by_id(self, sample_project, sample_worker, sample_rate):
        """Test getting a specific actual by ID."""
        # Create actual
        create_response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
        assert data["allocation_percentage"] == 75.0
    
    def test_update_actual(self, sample_project, sample_worker, sample_rate):
        """Test updating an actual."""
        # Create actual
        create_response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
        assert data["allocation_percentage"] == 60.0
    
    def test_delete_actual(self, sample_project, sample_worker, sample_rate):
        """Test deleting an actual."""
        # Create actual
        create_response = client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
    
    def test_import_actuals_csv(self, sample_project, sample_worker, sample_rate):
        """Test importing actuals from CSV."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-01-15,50.0
{sample_project.id},EMP001,John Smith,2024-01-16,60.0"""
        
        files = {"file": ("actuals.csv", BytesIO(csv_content.encode()), "text/csv")}
        response = client.post("/api/v1/actuals/import", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 2
        assert data["successful_imports"] == 2
        assert data["failed_imports"] == 0
    
    def test_import_actuals_validation_only(self, sample_project, sample_worker, sample_rate):
        """Test validating actuals import without importing."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-01-15,50.0"""
        
        files = {"file": ("actuals.csv", BytesIO(csv_content.encode()), "text/csv")}
        response = client.post("/api/v1/actuals/import?validate_only=true", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["validation_only"] is True
        assert data["total_rows"] == 1
    
    def test_get_project_total_cost(self, sample_project, sample_worker, sample_rate):
        """Test getting total cost for a project."""
        # Create actuals
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": "2024-01-15",
                "allocation_percentage": 50.0
            }
        )
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
    
    def test_get_variance_analysis(self, sample_project, sample_worker, sample_rate):
        """Test getting variance analysis for a project."""
        # Create actual
        client.post(
            "/api/v1/actuals/",
            json={
                "project_id": str(sample_project.id),
                "external_worker_id": "EMP001",
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
    
    def test_check_allocation_conflicts(self, sample_project, sample_worker, sample_rate):
        """Test checking for allocation conflicts."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-01-15,60.0
{sample_project.id},EMP001,John Smith,2024-01-15,50.0"""
        
        files = {"file": ("actuals.csv", BytesIO(csv_content.encode()), "text/csv")}
        response = client.post("/api/v1/actuals/check-allocation-conflicts", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_conflicts"] is True
        assert len(data["conflicts"]) > 0
