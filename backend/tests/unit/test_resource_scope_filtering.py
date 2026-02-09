"""
Unit tests for resource and worker scope-aware filtering.
"""
import pytest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.user import User, UserRole, ScopeAssignment, RoleType, ScopeType
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.services.resource import resource_service, worker_service


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


class TestResourceScopeFiltering:
    """Test scope-aware filtering for resources."""
    
    def test_resource_filtering_with_global_scope(self, db):
        """Test that users with global scope can see all resources."""
        # Create user with global scope
        user = User(username="admin", email="admin@test.com", password_hash="hash")
        db.add(user)
        db.flush()
        
        user_role = UserRole(user_id=user.id, role_type=RoleType.ADMIN, is_active=True)
        db.add(user_role)
        db.flush()
        
        scope = ScopeAssignment(
            user_role_id=user_role.id,
            scope_type=ScopeType.GLOBAL,
            is_active=True
        )
        db.add(scope)
        db.commit()
        
        # Create resources
        resource1 = resource_service.create_resource(
            db, name="Resource 1", resource_type=ResourceType.LABOR
        )
        resource2 = resource_service.create_resource(
            db, name="Resource 2", resource_type=ResourceType.NON_LABOR
        )
        
        # List resources with user scope
        resources = resource_service.list_resources(db, user_id=user.id)
        
        assert len(resources) == 2
    
    def test_resource_filtering_with_program_scope(self, db):
        """Test that users with program scope can see resources assigned to program projects."""
        # Create program and projects
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.flush()
        
        project = Project(
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC-001"
        )
        db.add(project)
        db.flush()
        
        phase = ProjectPhase(
            project_id=project.id,
            name="Execution Phase",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            capital_budget=Decimal("100000"),
            expense_budget=Decimal("50000"),
            total_budget=Decimal("150000")
        )
        db.add(phase)
        db.flush()
        
        # Create user with program scope
        user = User(username="pm", email="pm@test.com", password_hash="hash")
        db.add(user)
        db.flush()
        
        user_role = UserRole(user_id=user.id, role_type=RoleType.PROGRAM_MANAGER, is_active=True)
        db.add(user_role)
        db.flush()
        
        scope = ScopeAssignment(
            user_role_id=user_role.id,
            scope_type=ScopeType.PROGRAM,
            program_id=program.id,
            is_active=True
        )
        db.add(scope)
        db.commit()
        
        # Create resources
        resource1 = resource_service.create_resource(
            db, name="Resource 1", resource_type=ResourceType.LABOR
        )
        resource2 = resource_service.create_resource(
            db, name="Resource 2", resource_type=ResourceType.LABOR
        )
        
        # Assign resource1 to the project
        assignment = ResourceAssignment(
            resource_id=resource1.id,
            project_id=project.id,
            assignment_date=date(2024, 6, 1),
            capital_percentage=Decimal("70"),
            expense_percentage=Decimal("30")
        )
        db.add(assignment)
        db.commit()
        
        # List resources with user scope
        resources = resource_service.list_resources(db, user_id=user.id)
        
        # Should only see resource1 (assigned to project in scope)
        assert len(resources) == 1
        assert resources[0].id == resource1.id
    
    def test_worker_filtering_with_any_scope(self, db):
        """Test that users with any scope can see all workers."""
        # Create program
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.flush()
        
        # Create user with program scope
        user = User(username="pm", email="pm@test.com", password_hash="hash")
        db.add(user)
        db.flush()
        
        user_role = UserRole(user_id=user.id, role_type=RoleType.PROGRAM_MANAGER, is_active=True)
        db.add(user_role)
        db.flush()
        
        scope = ScopeAssignment(
            user_role_id=user_role.id,
            scope_type=ScopeType.PROGRAM,
            program_id=program.id,
            is_active=True
        )
        db.add(scope)
        db.commit()
        
        # Create worker type and workers
        worker_type = WorkerType(type="Engineer", description="Software Engineers")
        db.add(worker_type)
        db.flush()
        
        worker1 = Worker(
            external_id="EMP001",
            name="John Doe",
            worker_type_id=worker_type.id
        )
        worker2 = Worker(
            external_id="EMP002",
            name="Jane Smith",
            worker_type_id=worker_type.id
        )
        db.add_all([worker1, worker2])
        db.commit()
        
        # List workers with user scope
        workers = worker_service.list_workers(db, user_id=user.id)
        
        # Should see all workers (workers are organizational resources)
        assert len(workers) == 2
    
    def test_resource_filtering_without_scope(self, db):
        """Test that users without scope cannot see any resources."""
        # Create user without scope
        user = User(username="user", email="user@test.com", password_hash="hash")
        db.add(user)
        db.commit()
        
        # Create resources
        resource_service.create_resource(
            db, name="Resource 1", resource_type=ResourceType.LABOR
        )
        
        # List resources with user scope
        resources = resource_service.list_resources(db, user_id=user.id)
        
        # Should see no resources
        assert len(resources) == 0
