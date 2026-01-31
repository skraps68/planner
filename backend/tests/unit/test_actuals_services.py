"""
Unit tests for actuals-related services.
"""
import pytest
from datetime import date
from decimal import Decimal
from io import StringIO

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Worker, WorkerType, ResourceType, Resource
from app.models.rate import Rate
from app.models.actual import Actual
from app.services.actuals_import import actuals_import_service, ActualsImportError, ActualsImportValidationError
from app.services.allocation_validator import allocation_validator_service
from app.services.actuals import actuals_service
from app.core.exceptions import (
    ProjectNotFoundError,
    WorkerNotFoundError,
    AllocationConflictError,
    BusinessRuleViolationError,
)


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create test database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


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
        name="Execution Phase",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
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


class TestActualsImportService:
    """Test ActualsImportService."""
    
    def test_parse_csv_valid(self, db, sample_project, sample_worker):
        """Test parsing valid CSV content."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-01-15,75.0
{sample_project.id},EMP001,John Smith,2024-01-16,50.0"""
        
        records = actuals_import_service.parse_csv(csv_content)
        
        assert len(records) == 2
        assert records[0].project_id_str == str(sample_project.id)
        assert records[0].external_worker_id == "EMP001"
        assert records[0].worker_name == "John Smith"
        assert records[0].actual_date_str == "2024-01-15"
        assert records[0].percentage_str == "75.0"
    
    def test_parse_csv_missing_columns(self, db):
        """Test parsing CSV with missing columns."""
        csv_content = """project_id,external_worker_id,date
123,EMP001,2024-01-15"""
        
        with pytest.raises(ActualsImportError, match="Missing required columns"):
            actuals_import_service.parse_csv(csv_content)
    
    def test_parse_csv_empty(self, db):
        """Test parsing empty CSV."""
        csv_content = ""
        
        with pytest.raises(ActualsImportError, match="empty"):
            actuals_import_service.parse_csv(csv_content)
    
    def test_validate_records_valid(self, db, sample_project, sample_worker):
        """Test validating valid records."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-01-15,75.0"""
        
        records = actuals_import_service.parse_csv(csv_content)
        validated = actuals_import_service.validate_records(db, records)
        
        assert len(validated) == 1
        assert validated[0].is_valid()
        assert len(validated[0].validation_errors) == 0
    
    def test_validate_records_invalid_project(self, db, sample_worker):
        """Test validating records with invalid project ID."""
        csv_content = """project_id,external_worker_id,worker_name,date,percentage
00000000-0000-0000-0000-000000000000,EMP001,John Smith,2024-01-15,75.0"""
        
        records = actuals_import_service.parse_csv(csv_content)
        validated = actuals_import_service.validate_records(db, records)
        
        assert len(validated) == 1
        assert not validated[0].is_valid()
        assert any("does not exist" in err for err in validated[0].validation_errors)
    
    def test_validate_records_invalid_worker(self, db, sample_project):
        """Test validating records with invalid worker."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP999,Unknown Worker,2024-01-15,75.0"""
        
        records = actuals_import_service.parse_csv(csv_content)
        validated = actuals_import_service.validate_records(db, records)
        
        assert len(validated) == 1
        assert not validated[0].is_valid()
        assert any("does not exist" in err for err in validated[0].validation_errors)
    
    def test_validate_records_invalid_date(self, db, sample_project, sample_worker):
        """Test validating records with invalid date format."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-13-45,75.0"""
        
        records = actuals_import_service.parse_csv(csv_content)
        validated = actuals_import_service.validate_records(db, records)
        
        assert len(validated) == 1
        assert not validated[0].is_valid()
        assert any("Invalid date format" in err for err in validated[0].validation_errors)
    
    def test_validate_records_invalid_percentage(self, db, sample_project, sample_worker):
        """Test validating records with invalid percentage."""
        csv_content = f"""project_id,external_worker_id,worker_name,date,percentage
{sample_project.id},EMP001,John Smith,2024-01-15,150.0"""
        
        records = actuals_import_service.parse_csv(csv_content)
        validated = actuals_import_service.validate_records(db, records)
        
        assert len(validated) == 1
        assert not validated[0].is_valid()
        assert any("must be <= 100.0" in err for err in validated[0].validation_errors)


class TestAllocationValidatorService:
    """Test AllocationValidatorService."""
    
    def test_validate_single_actual_valid(self, db, sample_project, sample_worker):
        """Test validating a single actual that doesn't exceed limit."""
        is_valid = allocation_validator_service.validate_single_actual(
            db=db,
            external_worker_id="EMP001",
            actual_date=date(2024, 1, 15),
            new_allocation=Decimal('75.00')
        )
        
        assert is_valid is True
    
    def test_validate_single_actual_exceeds_limit(self, db, sample_project, sample_worker, sample_rate):
        """Test validating a single actual that exceeds limit."""
        # Create existing actual
        existing_actual = Actual(
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 15),
            allocation_percentage=Decimal('60.00'),
            actual_cost=Decimal('300.00'),
            capital_amount=Decimal('150.00'),
            expense_amount=Decimal('150.00')
        )
        db.add(existing_actual)
        db.commit()
        
        # Try to add another actual that would exceed 100%
        is_valid = allocation_validator_service.validate_single_actual(
            db=db,
            external_worker_id="EMP001",
            actual_date=date(2024, 1, 15),
            new_allocation=Decimal('50.00')
        )
        
        assert is_valid is False
    
    def test_get_current_allocation(self, db, sample_project, sample_worker, sample_rate):
        """Test getting current allocation for a worker on a date."""
        # Create actuals
        actual1 = Actual(
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 15),
            allocation_percentage=Decimal('40.00'),
            actual_cost=Decimal('200.00'),
            capital_amount=Decimal('100.00'),
            expense_amount=Decimal('100.00')
        )
        actual2 = Actual(
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 15),
            allocation_percentage=Decimal('30.00'),
            actual_cost=Decimal('150.00'),
            capital_amount=Decimal('75.00'),
            expense_amount=Decimal('75.00')
        )
        db.add_all([actual1, actual2])
        db.commit()
        
        current = allocation_validator_service.get_current_allocation(
            db=db,
            external_worker_id="EMP001",
            actual_date=date(2024, 1, 15)
        )
        
        assert current == Decimal('70.00')
    
    def test_validate_batch_actuals_no_conflicts(self, db):
        """Test validating batch with no conflicts."""
        actuals_data = [
            {
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": date(2024, 1, 15),
                "allocation_percentage": Decimal('50.00')
            },
            {
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": date(2024, 1, 16),
                "allocation_percentage": Decimal('60.00')
            }
        ]
        
        conflicts = allocation_validator_service.validate_batch_actuals(db, actuals_data)
        
        assert len(conflicts) == 0
    
    def test_validate_batch_actuals_with_conflicts(self, db):
        """Test validating batch with conflicts within batch."""
        actuals_data = [
            {
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": date(2024, 1, 15),
                "allocation_percentage": Decimal('60.00')
            },
            {
                "external_worker_id": "EMP001",
                "worker_name": "John Smith",
                "actual_date": date(2024, 1, 15),
                "allocation_percentage": Decimal('50.00')
            }
        ]
        
        conflicts = allocation_validator_service.validate_batch_actuals(db, actuals_data)
        
        assert len(conflicts) == 1
        assert conflicts[0].external_worker_id == "EMP001"
        assert conflicts[0].total_allocation == Decimal('110.00')


class TestActualsService:
    """Test ActualsService."""
    
    def test_create_actual_valid(self, db, sample_project, sample_worker, sample_rate):
        """Test creating a valid actual."""
        actual = actuals_service.create_actual(
            db=db,
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 15),
            allocation_percentage=Decimal('75.00')
        )
        
        assert actual.id is not None
        assert actual.project_id == sample_project.id
        assert actual.external_worker_id == "EMP001"
        assert actual.allocation_percentage == Decimal('75.00')
        assert actual.actual_cost > Decimal('0.00')
    
    def test_create_actual_invalid_project(self, db, sample_worker, sample_rate):
        """Test creating actual with invalid project."""
        from uuid import uuid4
        
        with pytest.raises(ProjectNotFoundError):
            actuals_service.create_actual(
                db=db,
                project_id=uuid4(),
                external_worker_id="EMP001",
                worker_name="John Smith",
                actual_date=date(2024, 1, 15),
                allocation_percentage=Decimal('75.00')
            )
    
    def test_create_actual_invalid_worker(self, db, sample_project, sample_rate):
        """Test creating actual with invalid worker."""
        with pytest.raises(WorkerNotFoundError):
            actuals_service.create_actual(
                db=db,
                project_id=sample_project.id,
                external_worker_id="EMP999",
                worker_name="Unknown Worker",
                actual_date=date(2024, 1, 15),
                allocation_percentage=Decimal('75.00')
            )
    
    def test_create_actual_exceeds_allocation(self, db, sample_project, sample_worker, sample_rate):
        """Test creating actual that exceeds allocation limit."""
        # Create existing actual
        actuals_service.create_actual(
            db=db,
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 15),
            allocation_percentage=Decimal('60.00')
        )
        
        # Try to add another that exceeds limit
        with pytest.raises(AllocationConflictError):
            actuals_service.create_actual(
                db=db,
                project_id=sample_project.id,
                external_worker_id="EMP001",
                worker_name="John Smith",
                actual_date=date(2024, 1, 15),
                allocation_percentage=Decimal('50.00')
            )
    
    def test_get_project_total_cost(self, db, sample_project, sample_worker, sample_rate):
        """Test getting total cost for a project."""
        # Create actuals
        actuals_service.create_actual(
            db=db,
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 15),
            allocation_percentage=Decimal('50.00')
        )
        actuals_service.create_actual(
            db=db,
            project_id=sample_project.id,
            external_worker_id="EMP001",
            worker_name="John Smith",
            actual_date=date(2024, 1, 16),
            allocation_percentage=Decimal('75.00')
        )
        
        total_cost = actuals_service.get_project_total_cost(db, sample_project.id)
        
        assert total_cost > Decimal('0.00')
        # 50% of 500 + 75% of 500 = 250 + 375 = 625
        assert total_cost == Decimal('625.00')
