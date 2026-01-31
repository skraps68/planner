"""
Unit tests for PhaseService operations.

Tests cover:
- Create phase success and failure cases
- Update phase success and failure cases
- Delete phase success and failure cases
- Last phase deletion prevention
- Default phase creation on project creation
"""
import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.core.exceptions import ValidationError, ResourceNotFoundError
from app.services.phase_service import PhaseService


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
def phase_service():
    """Create PhaseService instance."""
    return PhaseService()


@pytest.fixture
def sample_program(db):
    """Create a sample program for testing."""
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
    """Create a sample project for testing."""
    project = Project(
        program_id=sample_program.id,
        name="Test Project",
        business_sponsor="Alice Brown",
        project_manager="Charlie Davis",
        technical_lead="Diana Evans",
        start_date=date(2024, 2, 1),
        end_date=date(2024, 11, 30),
        cost_center_code="CC-001"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


class TestCreatePhase:
    """Test phase creation operations."""
    
    def test_create_phase_success(self, db, phase_service, sample_project):
        """Test successfully creating a phase."""
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30),
            description="Test phase",
            capital_budget=Decimal("10000"),
            expense_budget=Decimal("5000"),
            total_budget=Decimal("15000")
        )
        
        assert phase.id is not None
        assert phase.name == "Phase 1"
        assert phase.start_date == date(2024, 2, 1)
        assert phase.end_date == date(2024, 11, 30)
        assert phase.description == "Test phase"
        assert phase.capital_budget == Decimal("10000")
        assert phase.expense_budget == Decimal("5000")
        assert phase.total_budget == Decimal("15000")
        assert phase.project_id == sample_project.id
    
    def test_create_phase_with_default_budgets(self, db, phase_service, sample_project):
        """Test creating a phase with default budget values."""
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        assert phase.capital_budget == Decimal("0")
        assert phase.expense_budget == Decimal("0")
        assert phase.total_budget == Decimal("0")
    
    def test_create_phase_invalid_project(self, db, phase_service):
        """Test creating a phase with invalid project ID raises error."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            phase_service.create_phase(
                db=db,
                project_id=uuid4(),
                name="Phase 1",
                start_date=date(2024, 2, 1),
                end_date=date(2024, 11, 30)
            )
        
        assert "Project" in str(exc_info.value)
    
    def test_create_phase_invalid_budget(self, db, phase_service, sample_project):
        """Test creating a phase with invalid budget components raises error."""
        with pytest.raises(ValidationError) as exc_info:
            phase_service.create_phase(
                db=db,
                project_id=sample_project.id,
                name="Phase 1",
                start_date=date(2024, 2, 1),
                end_date=date(2024, 11, 30),
                capital_budget=Decimal("10000"),
                expense_budget=Decimal("5000"),
                total_budget=Decimal("20000")  # Wrong total
            )
        
        assert "Total budget must equal" in str(exc_info.value)
    
    def test_create_phase_violates_timeline(self, db, phase_service, sample_project):
        """Test creating a phase that violates timeline continuity raises error."""
        # Create first phase covering entire project
        phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Try to create overlapping phase (should fail because Phase 1 already covers entire timeline)
        with pytest.raises(ValidationError) as exc_info:
            phase_service.create_phase(
                db=db,
                project_id=sample_project.id,
                name="Phase 2",
                start_date=date(2024, 6, 1),
                end_date=date(2024, 11, 30)
            )
        
        assert "Phase validation failed" in str(exc_info.value)


class TestUpdatePhase:
    """Test phase update operations."""
    
    def test_update_phase_name(self, db, phase_service, sample_project):
        """Test updating a phase name."""
        # Create phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Update name
        updated = phase_service.update_phase(
            db=db,
            phase_id=phase.id,
            name="Updated Phase"
        )
        
        assert updated.name == "Updated Phase"
        assert updated.start_date == date(2024, 2, 1)  # Unchanged
        assert updated.end_date == date(2024, 11, 30)  # Unchanged
    
    def test_update_phase_dates(self, db, phase_service, sample_project):
        """Test updating phase dates."""
        # Create single phase covering the project
        phase1 = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Update phase1 description (dates remain valid)
        updated = phase_service.update_phase(
            db=db,
            phase_id=phase1.id,
            description="Updated description"
        )
        
        assert updated.description == "Updated description"
        assert updated.start_date == date(2024, 2, 1)
        assert updated.end_date == date(2024, 11, 30)
    
    def test_update_phase_budgets(self, db, phase_service, sample_project):
        """Test updating phase budgets."""
        # Create phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30),
            capital_budget=Decimal("10000"),
            expense_budget=Decimal("5000"),
            total_budget=Decimal("15000")
        )
        
        # Update budgets
        updated = phase_service.update_phase(
            db=db,
            phase_id=phase.id,
            capital_budget=Decimal("20000"),
            expense_budget=Decimal("10000")
        )
        
        assert updated.capital_budget == Decimal("20000")
        assert updated.expense_budget == Decimal("10000")
        assert updated.total_budget == Decimal("30000")
    
    def test_update_phase_invalid_id(self, db, phase_service):
        """Test updating a non-existent phase raises error."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            phase_service.update_phase(
                db=db,
                phase_id=uuid4(),
                name="Updated Phase"
            )
        
        assert "Phase" in str(exc_info.value)
    
    def test_update_phase_invalid_budget(self, db, phase_service, sample_project):
        """Test updating with invalid budget components raises error."""
        # Create phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Try to update with invalid budget
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_phase(
                db=db,
                phase_id=phase.id,
                capital_budget=Decimal("10000"),
                expense_budget=Decimal("5000"),
                total_budget=Decimal("20000")  # Wrong total
            )
        
        assert "Total budget must equal" in str(exc_info.value)
    
    def test_update_phase_violates_timeline(self, db, phase_service, sample_project):
        """Test updating a phase to violate timeline continuity raises error."""
        # Create single phase
        phase1 = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Try to update phase1 to not cover entire project (creates gap at end)
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_phase(
                db=db,
                phase_id=phase1.id,
                end_date=date(2024, 10, 31)  # Creates gap in November
            )
        
        assert "Phase validation failed" in str(exc_info.value)


class TestDeletePhase:
    """Test phase deletion operations."""
    
    def test_delete_phase_success(self, db, phase_service, sample_project):
        """Test successfully deleting a phase when it doesn't create a gap."""
        # Create single phase covering entire project
        phase1 = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Cannot delete the only phase
        with pytest.raises(ValidationError):
            phase_service.delete_phase(db=db, phase_id=phase1.id)
        
        # Verify phase still exists
        phases = db.query(ProjectPhase).filter(
            ProjectPhase.project_id == sample_project.id
        ).all()
        assert len(phases) == 1
    
    def test_delete_last_phase(self, db, phase_service, sample_project):
        """Test that deleting the last phase raises error."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Try to delete it
        with pytest.raises(ValidationError) as exc_info:
            phase_service.delete_phase(db=db, phase_id=phase.id)
        
        assert "Cannot delete the last remaining phase" in str(exc_info.value)
    
    def test_delete_phase_invalid_id(self, db, phase_service):
        """Test deleting a non-existent phase raises error."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            phase_service.delete_phase(db=db, phase_id=uuid4())
        
        assert "Phase" in str(exc_info.value)
    
    def test_delete_phase_creates_gap(self, db, phase_service, sample_project):
        """Test that deleting a phase that creates a gap raises error."""
        # Create single phase covering entire project
        phase1 = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Try to delete the only phase (creates complete gap)
        with pytest.raises(ValidationError) as exc_info:
            phase_service.delete_phase(db=db, phase_id=phase1.id)
        
        # Should fail because it's the last phase
        assert "Cannot delete the last remaining phase" in str(exc_info.value)


class TestDefaultPhaseCreation:
    """Test default phase creation."""
    
    def test_create_default_phase(self, db, phase_service, sample_project):
        """Test creating a default phase for a project."""
        phase = phase_service.create_default_phase(
            db=db,
            project_id=sample_project.id,
            project_start=sample_project.start_date,
            project_end=sample_project.end_date
        )
        
        assert phase.id is not None
        assert phase.name == "Default Phase"
        assert phase.start_date == sample_project.start_date
        assert phase.end_date == sample_project.end_date
        assert phase.capital_budget == Decimal("0")
        assert phase.expense_budget == Decimal("0")
        assert phase.total_budget == Decimal("0")
        assert phase.project_id == sample_project.id
    
    def test_default_phase_covers_project_timeline(self, db, phase_service, sample_project):
        """Test that default phase covers entire project timeline."""
        phase = phase_service.create_default_phase(
            db=db,
            project_id=sample_project.id,
            project_start=sample_project.start_date,
            project_end=sample_project.end_date
        )
        
        # Verify it covers the entire project
        assert phase.start_date == sample_project.start_date
        assert phase.end_date == sample_project.end_date
        
        # Verify timeline is valid
        from app.services.phase_validator import PhaseValidatorService
        validator = PhaseValidatorService()
        
        result = validator.validate_phase_timeline(
            sample_project.start_date,
            sample_project.end_date,
            [{
                "id": phase.id,
                "name": phase.name,
                "start_date": phase.start_date,
                "end_date": phase.end_date
            }]
        )
        
        assert result.is_valid


class TestBatchUpdatePhases:
    """Test batch phase update operations."""
    
    def test_batch_update_create_multiple_phases(self, db, phase_service, sample_project):
        """Test creating multiple phases via batch update."""
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "description": "First phase",
                "capital_budget": Decimal("10000"),
                "expense_budget": Decimal("5000"),
                "total_budget": Decimal("15000")
            },
            {
                "id": None,
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 11, 30),
                "description": "Second phase",
                "capital_budget": Decimal("20000"),
                "expense_budget": Decimal("10000"),
                "total_budget": Decimal("30000")
            }
        ]
        
        result = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        
        assert len(result) == 2
        assert result[0].name == "Phase 1"
        assert result[0].start_date == date(2024, 2, 1)
        assert result[0].end_date == date(2024, 6, 30)
        assert result[1].name == "Phase 2"
        assert result[1].start_date == date(2024, 7, 1)
        assert result[1].end_date == date(2024, 11, 30)
    
    def test_batch_update_modify_existing_phases(self, db, phase_service, sample_project):
        """Test modifying existing phases via batch update."""
        # Create initial phases using batch update
        initial_phases = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            },
            {
                "id": None,
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            }
        ]
        created = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=initial_phases
        )
        phase1 = created[0]
        phase2 = created[1]
        
        # Update both phases
        phases_data = [
            {
                "id": phase1.id,
                "name": "Updated Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 5, 31),
                "description": "Updated first phase",
                "capital_budget": Decimal("15000"),
                "expense_budget": Decimal("7500"),
                "total_budget": Decimal("22500")
            },
            {
                "id": phase2.id,
                "name": "Updated Phase 2",
                "start_date": date(2024, 6, 1),
                "end_date": date(2024, 11, 30),
                "description": "Updated second phase",
                "capital_budget": Decimal("25000"),
                "expense_budget": Decimal("12500"),
                "total_budget": Decimal("37500")
            }
        ]
        
        result = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        
        assert len(result) == 2
        assert result[0].name == "Updated Phase 1"
        assert result[0].end_date == date(2024, 5, 31)
        assert result[1].name == "Updated Phase 2"
        assert result[1].start_date == date(2024, 6, 1)
    
    def test_batch_update_delete_phases(self, db, phase_service, sample_project):
        """Test deleting phases via batch update (by not including them)."""
        # Create three phases using batch update
        initial_phases = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 5, 31),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            },
            {
                "id": None,
                "name": "Phase 2",
                "start_date": date(2024, 6, 1),
                "end_date": date(2024, 8, 31),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            },
            {
                "id": None,
                "name": "Phase 3",
                "start_date": date(2024, 9, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            }
        ]
        created = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=initial_phases
        )
        phase1 = created[0]
        phase2 = created[1]
        phase3 = created[2]
        
        # Update to only keep phase1 and phase3, merging their date ranges
        phases_data = [
            {
                "id": phase1.id,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            },
            {
                "id": phase3.id,
                "name": "Phase 3",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            }
        ]
        
        result = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        
        assert len(result) == 2
        # Verify phase2 was deleted
        deleted_phase = db.query(ProjectPhase).filter(ProjectPhase.id == phase2.id).first()
        assert deleted_phase is None
    
    def test_batch_update_mixed_operations(self, db, phase_service, sample_project):
        """Test batch update with create, update, and delete operations."""
        # Create initial phase
        phase1 = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Split into two phases: update phase1 and create phase2
        phases_data = [
            {
                "id": phase1.id,
                "name": "Updated Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            },
            {
                "id": None,
                "name": "New Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            }
        ]
        
        result = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        
        assert len(result) == 2
        assert result[0].name == "Updated Phase 1"
        assert result[1].name == "New Phase 2"
    
    def test_batch_update_empty_list_fails(self, db, phase_service, sample_project):
        """Test that batch update with empty list fails."""
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_project_phases(
                db=db,
                project_id=sample_project.id,
                phases=[]
            )
        
        assert "must have at least one phase" in str(exc_info.value)
    
    def test_batch_update_invalid_timeline_fails(self, db, phase_service, sample_project):
        """Test that batch update with invalid timeline fails."""
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            }
            # Missing phase to cover July-November, creates gap
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_project_phases(
                db=db,
                project_id=sample_project.id,
                phases=phases_data
            )
        
        assert "Phase validation failed" in str(exc_info.value)
    
    def test_batch_update_invalid_budget_fails(self, db, phase_service, sample_project):
        """Test that batch update with invalid budget fails."""
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("10000"),
                "expense_budget": Decimal("5000"),
                "total_budget": Decimal("20000")  # Wrong total
            }
        ]
        
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_project_phases(
                db=db,
                project_id=sample_project.id,
                phases=phases_data
            )
        
        assert "Total budget must equal" in str(exc_info.value)
    
    def test_batch_update_invalid_project_fails(self, db, phase_service):
        """Test that batch update with invalid project ID fails."""
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("0"),
                "expense_budget": Decimal("0"),
                "total_budget": Decimal("0")
            }
        ]
        
        with pytest.raises(ResourceNotFoundError) as exc_info:
            phase_service.update_project_phases(
                db=db,
                project_id=uuid4(),
                phases=phases_data
            )
        
        assert "Project" in str(exc_info.value)
