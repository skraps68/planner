"""
Unit tests for database models.
"""
import pytest
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase, PhaseType
from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.models.rate import Rate
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.models.audit import AuditLog


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


class TestProgramModel:
    """Test Program model."""
    
    def test_create_program(self, db):
        """Test creating a program."""
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
        
        assert program.id is not None
        assert program.name == "Test Program"
        assert program.created_at is not None
        assert program.updated_at is not None


class TestProjectModel:
    """Test Project and ProjectPhase models."""
    
    def test_create_project(self, db):
        """Test creating a project."""
        # Create program first
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
        
        # Create project
        project = Project(
            program_id=program.id,
            name="Test Project",
            business_sponsor="John Doe",
            project_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
            cost_center_code="CC001"
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        
        assert project.id is not None
        assert project.program_id == program.id
        assert project.name == "Test Project"
    
    def test_create_project_phase(self, db):
        """Test creating a project phase."""
        # Create program and project
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
        
        project = Project(
            program_id=program.id,
            name="Test Project",
            business_sponsor="John Doe",
            project_manager="Jane Smith",
            technical_lead="Bob Johnson",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
            cost_center_code="CC001"
        )
        db.add(project)
        db.commit()
        
        # Create phase
        phase = ProjectPhase(
            project_id=project.id,
            phase_type=PhaseType.EXECUTION,
            capital_budget=Decimal("50000.00"),
            expense_budget=Decimal("50000.00"),
            total_budget=Decimal("100000.00")
        )
        db.add(phase)
        db.commit()
        db.refresh(phase)
        
        assert phase.id is not None
        assert phase.project_id == project.id
        assert phase.phase_type == PhaseType.EXECUTION
        assert phase.total_budget == Decimal("100000.00")


class TestResourceModels:
    """Test Resource, Worker, and WorkerType models."""
    
    def test_create_resource(self, db):
        """Test creating a resource."""
        resource = Resource(
            name="Test Resource",
            resource_type=ResourceType.LABOR,
            description="A test labor resource"
        )
        db.add(resource)
        db.commit()
        db.refresh(resource)
        
        assert resource.id is not None
        assert resource.name == "Test Resource"
        assert resource.resource_type == ResourceType.LABOR
    
    def test_create_worker_type(self, db):
        """Test creating a worker type."""
        worker_type = WorkerType(
            type="Software Engineer",
            description="Software development professional"
        )
        db.add(worker_type)
        db.commit()
        db.refresh(worker_type)
        
        assert worker_type.id is not None
        assert worker_type.type == "Software Engineer"
    
    def test_create_worker(self, db):
        """Test creating a worker."""
        # Create worker type first
        worker_type = WorkerType(
            type="Software Engineer",
            description="Software development professional"
        )
        db.add(worker_type)
        db.commit()
        
        # Create worker
        worker = Worker(
            worker_type_id=worker_type.id,
            external_id="EMP001",
            name="John Doe"
        )
        db.add(worker)
        db.commit()
        db.refresh(worker)
        
        assert worker.id is not None
        assert worker.external_id == "EMP001"
        assert worker.worker_type_id == worker_type.id


class TestRateModel:
    """Test Rate model."""
    
    def test_create_rate(self, db):
        """Test creating a rate."""
        # Create worker type first
        worker_type = WorkerType(
            type="Software Engineer",
            description="Software development professional"
        )
        db.add(worker_type)
        db.commit()
        
        # Create rate
        rate = Rate(
            worker_type_id=worker_type.id,
            rate_amount=Decimal("150.00"),
            start_date=date(2024, 1, 1),
            end_date=None
        )
        db.add(rate)
        db.commit()
        db.refresh(rate)
        
        assert rate.id is not None
        assert rate.rate_amount == Decimal("150.00")
        assert rate.end_date is None
    
    def test_rate_is_active_on(self, db):
        """Test rate temporal validity check."""
        worker_type = WorkerType(
            type="Software Engineer",
            description="Software development professional"
        )
        db.add(worker_type)
        db.commit()
        
        rate = Rate(
            worker_type_id=worker_type.id,
            rate_amount=Decimal("150.00"),
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        
        assert rate.is_active_on(date(2024, 6, 15)) is True
        assert rate.is_active_on(date(2023, 12, 31)) is False
        assert rate.is_active_on(date(2025, 1, 1)) is False


class TestUserModels:
    """Test User, UserRole, and ScopeAssignment models."""
    
    def test_create_user(self, db):
        """Test creating a user."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        assert user.id is not None
        assert user.username == "testuser"
        assert user.is_active is True
    
    def test_create_user_role(self, db):
        """Test creating a user role."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            is_active=True
        )
        db.add(user)
        db.commit()
        
        user_role = UserRole(
            user_id=user.id,
            role_type=RoleType.PROJECT_MANAGER,
            is_active=True
        )
        db.add(user_role)
        db.commit()
        db.refresh(user_role)
        
        assert user_role.id is not None
        assert user_role.role_type == RoleType.PROJECT_MANAGER
    
    def test_create_scope_assignment(self, db):
        """Test creating a scope assignment."""
        # Create user and role
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            is_active=True
        )
        db.add(user)
        db.commit()
        
        user_role = UserRole(
            user_id=user.id,
            role_type=RoleType.PROJECT_MANAGER,
            is_active=True
        )
        db.add(user_role)
        db.commit()
        
        # Create program
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
        
        # Create scope assignment
        scope = ScopeAssignment(
            user_role_id=user_role.id,
            scope_type=ScopeType.PROGRAM,
            program_id=program.id,
            is_active=True
        )
        db.add(scope)
        db.commit()
        db.refresh(scope)
        
        assert scope.id is not None
        assert scope.scope_type == ScopeType.PROGRAM
        assert scope.program_id == program.id


class TestAuditLogModel:
    """Test AuditLog model."""
    
    def test_create_audit_log(self, db):
        """Test creating an audit log."""
        # Create user first
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            is_active=True
        )
        db.add(user)
        db.commit()
        
        # Create audit log
        audit_log = AuditLog(
            user_id=user.id,
            entity_type="Program",
            entity_id=uuid4(),
            operation="CREATE",
            before_values=None,
            after_values={"name": "Test Program"}
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        
        assert audit_log.id is not None
        assert audit_log.operation == "CREATE"
        assert audit_log.after_values["name"] == "Test Program"