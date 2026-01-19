"""
Unit tests for repositories.
"""
import pytest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase, PhaseType
from app.models.resource import Worker, WorkerType
from app.models.rate import Rate
from app.repositories.program import program_repository
from app.repositories.project import project_repository, project_phase_repository
from app.repositories.resource import worker_repository, worker_type_repository
from app.repositories.rate import rate_repository


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


class TestProgramRepository:
    """Test ProgramRepository."""
    
    def test_create_program(self, db):
        """Test creating a program via repository."""
        program_data = {
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        }
        program = program_repository.create(db, obj_in=program_data)
        
        assert program.id is not None
        assert program.name == "Test Program"
    
    def test_get_program(self, db):
        """Test getting a program by ID."""
        program_data = {
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        }
        program = program_repository.create(db, obj_in=program_data)
        
        retrieved = program_repository.get(db, program.id)
        assert retrieved is not None
        assert retrieved.id == program.id
    
    def test_get_active_programs(self, db):
        """Test getting active programs."""
        # Create active program
        active_program = program_repository.create(db, obj_in={
            "name": "Active Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        })
        
        # Create inactive program (in the past)
        inactive_program = program_repository.create(db, obj_in={
            "name": "Inactive Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2020, 1, 1),
            "end_date": date(2020, 12, 31)
        })
        
        active_programs = program_repository.get_active_programs(db, as_of_date=date(2024, 6, 15))
        assert len(active_programs) == 1
        assert active_programs[0].id == active_program.id
    
    def test_validate_date_constraints(self, db):
        """Test date validation."""
        assert program_repository.validate_date_constraints(
            date(2024, 1, 1),
            date(2024, 12, 31)
        ) is True
        
        assert program_repository.validate_date_constraints(
            date(2024, 12, 31),
            date(2024, 1, 1)
        ) is False


class TestProjectRepository:
    """Test ProjectRepository."""
    
    def test_create_project(self, db):
        """Test creating a project via repository."""
        # Create program first
        program = program_repository.create(db, obj_in={
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        })
        
        project_data = {
            "program_id": program.id,
            "name": "Test Project",
            "business_sponsor": "John Doe",
            "project_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 6, 30),
            "cost_center_code": "CC001"
        }
        project = project_repository.create(db, obj_in=project_data)
        
        assert project.id is not None
        assert project.program_id == program.id
    
    def test_get_by_program(self, db):
        """Test getting projects by program."""
        program = program_repository.create(db, obj_in={
            "name": "Test Program",
            "business_sponsor": "John Doe",
            "program_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31)
        })
        
        project1 = project_repository.create(db, obj_in={
            "program_id": program.id,
            "name": "Project 1",
            "business_sponsor": "John Doe",
            "project_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 6, 30),
            "cost_center_code": "CC001"
        })
        
        project2 = project_repository.create(db, obj_in={
            "program_id": program.id,
            "name": "Project 2",
            "business_sponsor": "John Doe",
            "project_manager": "Jane Smith",
            "technical_lead": "Bob Johnson",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 6, 30),
            "cost_center_code": "CC002"
        })
        
        projects = project_repository.get_by_program(db, program.id)
        assert len(projects) == 2


class TestRateRepository:
    """Test RateRepository."""
    
    def test_create_rate(self, db):
        """Test creating a rate."""
        worker_type = worker_type_repository.create(db, obj_in={
            "type": "Software Engineer",
            "description": "Software development professional"
        })
        
        rate_data = {
            "worker_type_id": worker_type.id,
            "rate_amount": Decimal("150.00"),
            "start_date": date(2024, 1, 1),
            "end_date": None
        }
        rate = rate_repository.create(db, obj_in=rate_data)
        
        assert rate.id is not None
        assert rate.rate_amount == Decimal("150.00")
    
    def test_get_active_rate(self, db):
        """Test getting active rate."""
        worker_type = worker_type_repository.create(db, obj_in={
            "type": "Software Engineer",
            "description": "Software development professional"
        })
        
        # Create old rate
        old_rate = rate_repository.create(db, obj_in={
            "worker_type_id": worker_type.id,
            "rate_amount": Decimal("100.00"),
            "start_date": date(2023, 1, 1),
            "end_date": date(2023, 12, 31)
        })
        
        # Create current rate
        current_rate = rate_repository.create(db, obj_in={
            "worker_type_id": worker_type.id,
            "rate_amount": Decimal("150.00"),
            "start_date": date(2024, 1, 1),
            "end_date": None
        })
        
        active_rate = rate_repository.get_active_rate(db, worker_type.id, date(2024, 6, 15))
        assert active_rate is not None
        assert active_rate.id == current_rate.id
        assert active_rate.rate_amount == Decimal("150.00")
    
    def test_create_new_rate_closes_previous(self, db):
        """Test that creating a new rate closes the previous one."""
        worker_type = worker_type_repository.create(db, obj_in={
            "type": "Software Engineer",
            "description": "Software development professional"
        })
        
        # Create initial rate
        initial_rate = rate_repository.create(db, obj_in={
            "worker_type_id": worker_type.id,
            "rate_amount": Decimal("100.00"),
            "start_date": date(2024, 1, 1),
            "end_date": None
        })
        
        # Create new rate (should close previous)
        new_rate = rate_repository.create_new_rate(
            db,
            worker_type_id=worker_type.id,
            rate_amount=Decimal("150.00"),
            start_date=date(2024, 7, 1),
            close_previous=True
        )
        
        # Refresh initial rate to see changes
        db.refresh(initial_rate)
        
        assert initial_rate.end_date == date(2024, 6, 30)
        assert new_rate.end_date is None
        assert new_rate.rate_amount == Decimal("150.00")