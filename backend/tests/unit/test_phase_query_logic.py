"""
Unit tests for phase query logic.

Tests cover:
- get_phase_for_date with various dates
- get_assignments_for_phase with various date ranges
- Phase cost calculations
- Phase forecast calculations
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.resource import Resource, WorkerType
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.models.rate import Rate
from app.core.exceptions import ResourceNotFoundError
from app.services.phase_service import PhaseService
from app.services.forecasting import ForecastingService


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
def forecasting_service():
    """Create ForecastingService instance."""
    return ForecastingService()


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


@pytest.fixture
def sample_worker_type(db):
    """Create a sample worker type for testing."""
    worker_type = WorkerType(
        type="Software Engineer",
        description="Software development role"
    )
    db.add(worker_type)
    db.commit()
    db.refresh(worker_type)
    return worker_type


@pytest.fixture
def sample_resource(db, sample_worker_type):
    """Create a sample resource for testing."""
    resource = Resource(
        name="Test Resource",
        resource_type="labor"
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource



class TestGetPhaseForDate:
    """Test get_phase_for_date with various dates."""
    
    def test_get_phase_for_date_within_single_phase(self, db, phase_service, sample_project):
        """Test getting phase for a date within a single phase."""
        # Create single phase covering entire project
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Test date in the middle of the phase
        result = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 6, 15)
        )
        
        assert result is not None
        assert result.id == phase.id
        assert result.name == "Phase 1"
    
    def test_get_phase_for_date_at_phase_start(self, db, phase_service, sample_project):
        """Test getting phase for a date at phase start boundary."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Test date at start boundary
        result = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 2, 1)
        )
        
        assert result is not None
        assert result.id == phase.id
    
    def test_get_phase_for_date_at_phase_end(self, db, phase_service, sample_project):
        """Test getting phase for a date at phase end boundary."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Test date at end boundary
        result = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 11, 30)
        )
        
        assert result is not None
        assert result.id == phase.id

    
    def test_get_phase_for_date_with_multiple_phases(self, db, phase_service, sample_project):
        """Test getting phase for dates across multiple phases."""
        # Create two phases
        phases_data = [
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
        phases = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        phase1 = phases[0]
        phase2 = phases[1]
        
        # Test date in first phase
        result1 = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 3, 15)
        )
        assert result1 is not None
        assert result1.id == phase1.id
        assert result1.name == "Phase 1"
        
        # Test date in second phase
        result2 = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 9, 15)
        )
        assert result2 is not None
        assert result2.id == phase2.id
        assert result2.name == "Phase 2"
    
    def test_get_phase_for_date_at_phase_boundary(self, db, phase_service, sample_project):
        """Test getting phase for date at boundary between two phases."""
        # Create two phases
        phases_data = [
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
        phases = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        phase1 = phases[0]
        phase2 = phases[1]
        
        # Test last day of phase 1
        result1 = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 6, 30)
        )
        assert result1 is not None
        assert result1.id == phase1.id
        
        # Test first day of phase 2
        result2 = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 7, 1)
        )
        assert result2 is not None
        assert result2.id == phase2.id

    
    def test_get_phase_for_date_before_project_start(self, db, phase_service, sample_project):
        """Test getting phase for date before project start returns None."""
        # Create single phase
        phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Test date before project start
        result = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 1, 15)
        )
        
        assert result is None
    
    def test_get_phase_for_date_after_project_end(self, db, phase_service, sample_project):
        """Test getting phase for date after project end returns None."""
        # Create single phase
        phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Test date after project end
        result = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 12, 15)
        )
        
        assert result is None
    
    def test_get_phase_for_date_no_phases(self, db, phase_service, sample_project):
        """Test getting phase when no phases exist returns None."""
        # Don't create any phases
        result = phase_service.get_phase_for_date(
            db=db,
            project_id=sample_project.id,
            target_date=date(2024, 6, 15)
        )
        
        assert result is None



class TestGetAssignmentsForPhase:
    """Test get_assignments_for_phase with various date ranges."""
    
    def test_get_assignments_for_phase_with_assignments(self, db, phase_service, sample_project, sample_resource):
        """Test getting assignments that fall within a phase's date range."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Create assignments within the phase
        assignment1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 6, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        
        # Get assignments for phase
        result = phase_service.get_assignments_for_phase(db=db, phase_id=phase.id)
        
        assert len(result) == 2
        assert result[0].assignment_date == date(2024, 3, 15)
        assert result[1].assignment_date == date(2024, 6, 15)
    
    def test_get_assignments_for_phase_at_boundaries(self, db, phase_service, sample_project, sample_resource):
        """Test getting assignments at phase start and end boundaries."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Create assignments at boundaries
        assignment_start = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 2, 1),  # Phase start
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment_end = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 11, 30),  # Phase end
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment_start)
        db.add(assignment_end)
        db.commit()
        
        # Get assignments for phase
        result = phase_service.get_assignments_for_phase(db=db, phase_id=phase.id)
        
        assert len(result) == 2
        assert result[0].assignment_date == date(2024, 2, 1)
        assert result[1].assignment_date == date(2024, 11, 30)

    
    def test_get_assignments_for_phase_excludes_outside_dates(self, db, phase_service, sample_project, sample_resource):
        """Test that assignments outside phase date range are excluded."""
        # Create two phases
        phases_data = [
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
        phases = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        phase1 = phases[0]
        phase2 = phases[1]
        
        # Create assignments in both phases
        assignment_phase1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),  # In phase 1
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment_phase2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 9, 15),  # In phase 2
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment_phase1)
        db.add(assignment_phase2)
        db.commit()
        
        # Get assignments for phase 1 - should only include phase 1 assignment
        result1 = phase_service.get_assignments_for_phase(db=db, phase_id=phase1.id)
        assert len(result1) == 1
        assert result1[0].assignment_date == date(2024, 3, 15)
        
        # Get assignments for phase 2 - should only include phase 2 assignment
        result2 = phase_service.get_assignments_for_phase(db=db, phase_id=phase2.id)
        assert len(result2) == 1
        assert result2[0].assignment_date == date(2024, 9, 15)
    
    def test_get_assignments_for_phase_empty(self, db, phase_service, sample_project):
        """Test getting assignments for phase with no assignments."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Don't create any assignments
        result = phase_service.get_assignments_for_phase(db=db, phase_id=phase.id)
        
        assert len(result) == 0
    
    def test_get_assignments_for_phase_invalid_phase_id(self, db, phase_service):
        """Test getting assignments for non-existent phase raises error."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            phase_service.get_assignments_for_phase(db=db, phase_id=uuid4())
        
        assert "Phase" in str(exc_info.value)

    
    def test_get_assignments_for_phase_ordered_by_date(self, db, phase_service, sample_project, sample_resource):
        """Test that assignments are returned ordered by date."""
        # Create single phase
        phase = phase_service.create_phase(
            db=db,
            project_id=sample_project.id,
            name="Phase 1",
            start_date=date(2024, 2, 1),
            end_date=date(2024, 11, 30)
        )
        
        # Create assignments in non-chronological order
        assignment3 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 9, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 6, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment3)
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        
        # Get assignments for phase
        result = phase_service.get_assignments_for_phase(db=db, phase_id=phase.id)
        
        # Verify they are ordered by date
        assert len(result) == 3
        assert result[0].assignment_date == date(2024, 3, 15)
        assert result[1].assignment_date == date(2024, 6, 15)
        assert result[2].assignment_date == date(2024, 9, 15)



class TestPhaseCostCalculations:
    """Test phase cost calculations."""
    
    def test_calculate_phase_cost_with_actuals(self, db, forecasting_service, phase_service, sample_project, sample_resource):
        """Test calculating phase cost with actual data."""
        # Create single phase
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
        
        # Create assignment
        assignment = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("60"),
            expense_percentage=Decimal("40")
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        
        # Create actuals
        actual1 = Actual(
            project_id=sample_project.id,
            resource_assignment_id=assignment.id,
            actual_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            actual_cost=Decimal("1000"),
            capital_amount=Decimal("600"),
            expense_amount=Decimal("400"),
            external_worker_id="W001",
            worker_name="Test Worker"
        )
        db.add(actual1)
        db.commit()
        
        # Calculate phase cost
        result = forecasting_service.calculate_phase_cost(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 3, 31)
        )
        
        assert result["phase_id"] == str(phase.id)
        assert result["phase_name"] == "Phase 1"
        assert result["budget"]["total"] == 15000.0
        assert result["budget"]["capital"] == 10000.0
        assert result["budget"]["expense"] == 5000.0
        assert result["actual"]["total"] == 1000.0
        assert result["actual"]["capital"] == 600.0
        assert result["actual"]["expense"] == 400.0
        assert result["variance"]["total"] == 14000.0  # budget - actual
    
    def test_calculate_phase_cost_no_actuals(self, db, forecasting_service, phase_service, sample_project):
        """Test calculating phase cost with no actuals."""
        # Create single phase
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
        
        # Calculate phase cost without any actuals
        result = forecasting_service.calculate_phase_cost(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 3, 31)
        )
        
        assert result["actual"]["total"] == 0.0
        assert result["actual"]["capital"] == 0.0
        assert result["actual"]["expense"] == 0.0
        assert result["variance"]["total"] == 15000.0

    
    def test_calculate_phase_cost_only_includes_phase_dates(self, db, forecasting_service, phase_service, sample_project, sample_resource):
        """Test that phase cost only includes actuals within phase date range."""
        # Create two phases
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "capital_budget": Decimal("10000"),
                "expense_budget": Decimal("5000"),
                "total_budget": Decimal("15000")
            },
            {
                "id": None,
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("20000"),
                "expense_budget": Decimal("10000"),
                "total_budget": Decimal("30000")
            }
        ]
        phases = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        phase1 = phases[0]
        phase2 = phases[1]
        
        # Create assignments in both phases
        assignment1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 9, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        db.refresh(assignment1)
        db.refresh(assignment2)
        
        # Create actuals in both phases
        actual1 = Actual(
            project_id=sample_project.id,
            resource_assignment_id=assignment1.id,
            actual_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            actual_cost=Decimal("1000"),
            capital_amount=Decimal("500"),
            expense_amount=Decimal("500"),
            external_worker_id="W001",
            worker_name="Test Worker"
        )
        actual2 = Actual(
            project_id=sample_project.id,
            resource_assignment_id=assignment2.id,
            actual_date=date(2024, 9, 15),
            allocation_percentage=Decimal("100"),
            actual_cost=Decimal("2000"),
            capital_amount=Decimal("1000"),
            expense_amount=Decimal("1000"),
            external_worker_id="W001",
            worker_name="Test Worker"
        )
        db.add(actual1)
        db.add(actual2)
        db.commit()
        
        # Calculate phase 1 cost - should only include actual1
        result1 = forecasting_service.calculate_phase_cost(
            db=db,
            phase_id=phase1.id,
            as_of_date=date(2024, 12, 31)
        )
        assert result1["actual"]["total"] == 1000.0
        
        # Calculate phase 2 cost - should only include actual2
        result2 = forecasting_service.calculate_phase_cost(
            db=db,
            phase_id=phase2.id,
            as_of_date=date(2024, 12, 31)
        )
        assert result2["actual"]["total"] == 2000.0

    
    def test_calculate_phase_cost_respects_as_of_date(self, db, forecasting_service, phase_service, sample_project, sample_resource):
        """Test that phase cost calculation respects as_of_date parameter."""
        # Create single phase
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
        
        # Create assignments
        assignment1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 6, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        db.refresh(assignment1)
        db.refresh(assignment2)
        
        # Create actuals
        actual1 = Actual(
            project_id=sample_project.id,
            resource_assignment_id=assignment1.id,
            actual_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            actual_cost=Decimal("1000"),
            capital_amount=Decimal("500"),
            expense_amount=Decimal("500"),
            external_worker_id="W001",
            worker_name="Test Worker"
        )
        actual2 = Actual(
            project_id=sample_project.id,
            resource_assignment_id=assignment2.id,
            actual_date=date(2024, 6, 15),
            allocation_percentage=Decimal("100"),
            actual_cost=Decimal("2000"),
            capital_amount=Decimal("1000"),
            expense_amount=Decimal("1000"),
            external_worker_id="W001",
            worker_name="Test Worker"
        )
        db.add(actual1)
        db.add(actual2)
        db.commit()
        
        # Calculate cost as of March 31 - should only include actual1
        result1 = forecasting_service.calculate_phase_cost(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 3, 31)
        )
        assert result1["actual"]["total"] == 1000.0
        
        # Calculate cost as of June 30 - should include both actuals
        result2 = forecasting_service.calculate_phase_cost(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 6, 30)
        )
        assert result2["actual"]["total"] == 3000.0
    
    def test_calculate_phase_cost_invalid_phase_id(self, db, forecasting_service):
        """Test calculating cost for non-existent phase raises error."""
        with pytest.raises(ValueError) as exc_info:
            forecasting_service.calculate_phase_cost(
                db=db,
                phase_id=uuid4(),
                as_of_date=date(2024, 3, 31)
            )
        
        assert "does not exist" in str(exc_info.value)



class TestPhaseForecastCalculations:
    """Test phase forecast calculations."""
    
    def test_calculate_phase_forecast_with_future_assignments(self, db, forecasting_service, phase_service, sample_project, sample_resource, sample_worker_type):
        """Test calculating phase forecast with future assignments."""
        # Create single phase
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
        
        # Create rate for cost calculation
        rate = Rate(
            worker_type_id=sample_worker_type.id,
            rate_amount=Decimal("1000"),
            start_date=date(2024, 1, 1)
        )
        db.add(rate)
        db.commit()
        
        # Create future assignments
        assignment1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 6, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("60"),
            expense_percentage=Decimal("40")
        )
        assignment2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 9, 15),
            allocation_percentage=Decimal("50"),
            capital_percentage=Decimal("60"),
            expense_percentage=Decimal("40")
        )
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        
        # Calculate forecast as of March 31 (both assignments are in future)
        result = forecasting_service.calculate_phase_forecast(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 3, 31)
        )
        
        assert result["phase_id"] == str(phase.id)
        assert result["phase_name"] == "Phase 1"
        assert result["budget"]["total"] == 15000.0
        # Forecast should include both future assignments
        # assignment1: 100% * 1000 = 1000
        # assignment2: 50% * 1000 = 500
        # Total forecast = 1500
        assert result["forecast"]["total"] == 1500.0
    
    def test_calculate_phase_forecast_no_future_assignments(self, db, forecasting_service, phase_service, sample_project):
        """Test calculating phase forecast with no future assignments."""
        # Create single phase
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
        
        # Calculate forecast without any assignments
        result = forecasting_service.calculate_phase_forecast(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 3, 31)
        )
        
        assert result["forecast"]["total"] == 0.0
        assert result["forecast"]["capital"] == 0.0
        assert result["forecast"]["expense"] == 0.0

    
    def test_calculate_phase_forecast_only_includes_future_dates(self, db, forecasting_service, phase_service, sample_project, sample_resource, sample_worker_type):
        """Test that phase forecast only includes assignments after as_of_date."""
        # Create single phase
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
        
        # Create rate
        rate = Rate(
            worker_type_id=sample_worker_type.id,
            rate_amount=Decimal("1000"),
            start_date=date(2024, 1, 1)
        )
        db.add(rate)
        db.commit()
        
        # Create assignments in past and future
        assignment_past = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment_future = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 9, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment_past)
        db.add(assignment_future)
        db.commit()
        
        # Calculate forecast as of June 30 - should only include future assignment
        result = forecasting_service.calculate_phase_forecast(
            db=db,
            phase_id=phase.id,
            as_of_date=date(2024, 6, 30)
        )
        
        # Only assignment_future should be included (100% * 1000 = 1000)
        assert result["forecast"]["total"] == 1000.0
    
    def test_calculate_phase_forecast_only_includes_phase_dates(self, db, forecasting_service, phase_service, sample_project, sample_resource, sample_worker_type):
        """Test that phase forecast only includes assignments within phase date range."""
        # Create two phases
        phases_data = [
            {
                "id": None,
                "name": "Phase 1",
                "start_date": date(2024, 2, 1),
                "end_date": date(2024, 6, 30),
                "capital_budget": Decimal("10000"),
                "expense_budget": Decimal("5000"),
                "total_budget": Decimal("15000")
            },
            {
                "id": None,
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 11, 30),
                "capital_budget": Decimal("20000"),
                "expense_budget": Decimal("10000"),
                "total_budget": Decimal("30000")
            }
        ]
        phases = phase_service.update_project_phases(
            db=db,
            project_id=sample_project.id,
            phases=phases_data
        )
        phase1 = phases[0]
        phase2 = phases[1]
        
        # Create rate
        rate = Rate(
            worker_type_id=sample_worker_type.id,
            rate_amount=Decimal("1000"),
            start_date=date(2024, 1, 1)
        )
        db.add(rate)
        db.commit()
        
        # Create assignments in both phases
        assignment1 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 5, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        assignment2 = ResourceAssignment(
            resource_id=sample_resource.id,
            project_id=sample_project.id,
            assignment_date=date(2024, 9, 15),
            allocation_percentage=Decimal("100"),
            capital_percentage=Decimal("50"),
            expense_percentage=Decimal("50")
        )
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        
        # Calculate forecast for phase 1 as of March 1 - should only include assignment1
        result1 = forecasting_service.calculate_phase_forecast(
            db=db,
            phase_id=phase1.id,
            as_of_date=date(2024, 3, 1)
        )
        assert result1["forecast"]["total"] == 1000.0
        
        # Calculate forecast for phase 2 as of March 1 - should only include assignment2
        result2 = forecasting_service.calculate_phase_forecast(
            db=db,
            phase_id=phase2.id,
            as_of_date=date(2024, 3, 1)
        )
        assert result2["forecast"]["total"] == 1000.0
    
    def test_calculate_phase_forecast_invalid_phase_id(self, db, forecasting_service):
        """Test calculating forecast for non-existent phase raises error."""
        with pytest.raises(ValueError) as exc_info:
            forecasting_service.calculate_phase_forecast(
                db=db,
                phase_id=uuid4(),
                as_of_date=date(2024, 3, 31)
            )
        
        assert "does not exist" in str(exc_info.value)
