"""
Property-based tests for phase service.

These tests use Hypothesis to verify universal properties across all possible
phase configurations and operations.
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.project import Project, ProjectPhase
from app.models.program import Program
from app.services.phase_service import phase_service
from app.core.exceptions import ValidationError, ResourceNotFoundError


# Test database setup
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def test_program(db_session):
    """Create a test program."""
    program = Program(
        id=uuid4(),
        name="Test Program",
        business_sponsor="Test Sponsor",
        program_manager="Test Manager",
        technical_lead="Test Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        description="Test program for phase service tests"
    )
    db_session.add(program)
    db_session.commit()
    db_session.refresh(program)
    return program


@pytest.fixture
def test_project(db_session, test_program):
    """Create a test project."""
    project = Project(
        id=uuid4(),
        program_id=test_program.id,
        name="Test Project",
        business_sponsor="Test Sponsor",
        project_manager="Test Manager",
        technical_lead="Test Lead",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        cost_center_code=f"CC-{uuid4().hex[:8]}"
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


# Property Tests

@pytest.mark.property_test
class TestPhaseServiceProperties:
    """Property-based tests for phase service."""
    
    @given(
        project_duration=st.integers(min_value=30, max_value=730)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_1_default_phase_creation(self, db_session, test_program, project_duration):
        """
        Property 1: Default Phase Creation
        
        For any newly created project, the system should automatically create
        exactly one phase named "Default Phase" with start_date equal to the
        project's start_date, end_date equal to the project's end_date, and
        all budget values set to zero.
        
        **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
        """
        # Create project with random duration
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        
        project = Project(
            id=uuid4(),
            program_id=test_program.id,
            name=f"Test Project {uuid4().hex[:8]}",
            business_sponsor="Test Sponsor",
            project_manager="Test Manager",
            technical_lead="Test Lead",
            start_date=project_start,
            end_date=project_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        
        # Create default phase
        default_phase = phase_service.create_default_phase(
            db_session,
            project.id,
            project.start_date,
            project.end_date
        )
        
        # Get all phases for the project
        phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project.id
        ).all()
        
        # Property: Exactly one phase should exist
        assert len(phases) == 1, f"Expected exactly 1 phase, found {len(phases)}"
        
        # Property: Phase should be named "Default Phase"
        assert default_phase.name == "Default Phase", \
            f"Expected phase name 'Default Phase', got '{default_phase.name}'"
        
        # Property: Phase start_date should equal project start_date
        assert default_phase.start_date == project.start_date, \
            f"Expected phase start {project.start_date}, got {default_phase.start_date}"
        
        # Property: Phase end_date should equal project end_date
        assert default_phase.end_date == project.end_date, \
            f"Expected phase end {project.end_date}, got {default_phase.end_date}"
        
        # Property: All budget values should be zero
        assert default_phase.capital_budget == Decimal("0"), \
            f"Expected capital_budget 0, got {default_phase.capital_budget}"
        assert default_phase.expense_budget == Decimal("0"), \
            f"Expected expense_budget 0, got {default_phase.expense_budget}"
        assert default_phase.total_budget == Decimal("0"), \
            f"Expected total_budget 0, got {default_phase.total_budget}"
    
    @given(
        initial_duration=st.integers(min_value=30, max_value=365),
        new_duration=st.integers(min_value=30, max_value=365)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_2_default_phase_date_synchronization(self, db_session, test_program, 
                                                           initial_duration, new_duration):
        """
        Property 2: Default Phase Date Synchronization
        
        For any project that has only a default phase, when the project's
        start_date or end_date is updated, the default phase's dates should
        automatically update to match the new project dates.
        
        **Validates: Requirements 2.6**
        
        Note: This property tests the expected behavior. The actual implementation
        of automatic synchronization would be in the project service update method.
        This test verifies that manual synchronization works correctly.
        """
        # Create project
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=initial_duration)
        
        project = Project(
            id=uuid4(),
            program_id=test_program.id,
            name=f"Test Project {uuid4().hex[:8]}",
            business_sponsor="Test Sponsor",
            project_manager="Test Manager",
            technical_lead="Test Lead",
            start_date=project_start,
            end_date=project_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        
        # Create default phase
        default_phase = phase_service.create_default_phase(
            db_session,
            project.id,
            project.start_date,
            project.end_date
        )
        
        # Verify only one phase exists (the default phase)
        phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == project.id
        ).all()
        assert len(phases) == 1, "Should have only default phase"
        assert phases[0].name == "Default Phase", "Should be default phase"
        
        # Update project dates
        new_start = date(2024, 2, 1)
        new_end = new_start + timedelta(days=new_duration)
        project.start_date = new_start
        project.end_date = new_end
        db_session.commit()
        
        # Update default phase to match (simulating automatic synchronization)
        updated_phase = phase_service.update_phase(
            db_session,
            default_phase.id,
            start_date=new_start,
            end_date=new_end
        )
        
        # Property: Default phase dates should match new project dates
        assert updated_phase.start_date == new_start, \
            f"Expected phase start {new_start}, got {updated_phase.start_date}"
        assert updated_phase.end_date == new_end, \
            f"Expected phase end {new_end}, got {updated_phase.end_date}"
        
        # Property: Phase should still be named "Default Phase"
        assert updated_phase.name == "Default Phase", \
            "Phase name should remain 'Default Phase'"
        
        # Property: Budget values should remain zero
        assert updated_phase.capital_budget == Decimal("0"), \
            "Capital budget should remain 0"
        assert updated_phase.expense_budget == Decimal("0"), \
            "Expense budget should remain 0"
        assert updated_phase.total_budget == Decimal("0"), \
            "Total budget should remain 0"
    
    @given(
        project_duration=st.integers(min_value=60, max_value=365)
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_7_validation_rejection_gap(self, db_session, test_project, project_duration):
        """
        Property 7: Validation Rejection (Gap Scenario)
        
        For any phase configuration that violates timeline continuity by creating
        a gap, the system should reject the save operation and return specific
        validation errors.
        
        **Validates: Requirements 3.7**
        """
        # Update project dates
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        test_project.start_date = project_start
        test_project.end_date = project_end
        db_session.commit()
        
        # Create a default phase first to have valid coverage
        default_phase = phase_service.create_default_phase(
            db_session,
            test_project.id,
            project_start,
            project_end
        )
        
        # Calculate split points that would create a gap
        midpoint = project_duration // 2
        gap_size = 5
        
        # Try to update the default phase to end early (creating a gap at the end)
        phase1_end = project_start + timedelta(days=midpoint - gap_size)
        
        # Property: Updating phase to create a gap should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_phase(
                db_session,
                default_phase.id,
                end_date=phase1_end  # This creates a gap from phase1_end+1 to project_end
            )
        
        # Property: Error should have code VALIDATION_FAILED
        assert exc_info.value.code == "VALIDATION_FAILED", \
            f"Expected error code VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error details should contain specific validation errors
        assert "errors" in exc_info.value.details, \
            "Error details should contain 'errors' field"
        
        errors = exc_info.value.details["errors"]
        assert len(errors) > 0, "Should have at least one validation error"
    
    @given(
        project_duration=st.integers(min_value=60, max_value=365)
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_7_validation_rejection_overlap(self, db_session, test_project, project_duration):
        """
        Property 7: Validation Rejection (Overlap Scenario)
        
        For any phase configuration that violates the no-overlap constraint,
        the system should reject the save operation and return specific
        validation errors.
        
        **Validates: Requirements 3.7**
        """
        # Update project dates
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        test_project.start_date = project_start
        test_project.end_date = project_end
        db_session.commit()
        
        # Create first phase covering first half
        midpoint = project_duration // 2
        phase1_end = project_start + timedelta(days=midpoint)
        
        phase1 = phase_service.create_default_phase(
            db_session,
            test_project.id,
            project_start,
            project_end
        )
        
        # Directly update phase1 in database to create incomplete coverage
        phase1.end_date = phase1_end
        db_session.commit()
        
        # Try to create overlapping phase (starts before phase1 ends)
        overlap_start = phase1_end - timedelta(days=5)
        
        # Property: Creating overlapping phase should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            phase_service.create_phase(
                db_session,
                test_project.id,
                "Phase 2",
                overlap_start,
                project_end
            )
        
        # Property: Error should have code VALIDATION_FAILED
        assert exc_info.value.code == "VALIDATION_FAILED", \
            f"Expected error code VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error details should contain specific validation errors
        assert "errors" in exc_info.value.details, \
            "Error details should contain 'errors' field"
        
        errors = exc_info.value.details["errors"]
        assert len(errors) > 0, "Should have at least one validation error"
    
    @given(
        project_duration=st.integers(min_value=30, max_value=365),
        boundary_violation=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_7_validation_rejection_boundary(self, db_session, test_project, project_duration, boundary_violation):
        """
        Property 7: Validation Rejection (Boundary Violation Scenario)
        
        For any phase configuration that violates project boundary constraints
        (phase dates outside project dates), the system should reject the save
        operation and return specific validation errors.
        
        **Validates: Requirements 3.7**
        """
        # Update project dates
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        test_project.start_date = project_start
        test_project.end_date = project_end
        db_session.commit()
        
        # Try to create phase that extends beyond project end
        phase_start = project_start
        phase_end = project_end + timedelta(days=boundary_violation)
        
        # Property: Creating phase beyond project boundary should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            phase_service.create_phase(
                db_session,
                test_project.id,
                "Phase 1",
                phase_start,
                phase_end
            )
        
        # Property: Error should have code VALIDATION_FAILED
        assert exc_info.value.code == "VALIDATION_FAILED", \
            f"Expected error code VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error details should contain specific validation errors
        assert "errors" in exc_info.value.details, \
            "Error details should contain 'errors' field"
        
        errors = exc_info.value.details["errors"]
        assert len(errors) > 0, "Should have at least one validation error"
        
        # Property: At least one error should mention boundary or project dates
        error_str = str(errors).lower()
        assert any(keyword in error_str for keyword in ["boundary", "project", "exceed", "beyond"]), \
            "Validation errors should mention boundary violation"
    
    @given(
        phase_duration=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_7_validation_rejection_date_ordering(self, db_session, test_project, phase_duration):
        """
        Property 7: Validation Rejection (Date Ordering Violation Scenario)
        
        For any phase where end_date is before start_date, the system should
        reject the save operation and return specific validation errors.
        
        **Validates: Requirements 3.7**
        """
        # Try to create phase with end_date before start_date
        phase_start = test_project.start_date + timedelta(days=10)
        phase_end = phase_start - timedelta(days=phase_duration)
        
        # Property: Creating phase with invalid date ordering should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            phase_service.create_phase(
                db_session,
                test_project.id,
                "Invalid Phase",
                phase_start,
                phase_end
            )
        
        # Property: Error should have code VALIDATION_FAILED
        assert exc_info.value.code == "VALIDATION_FAILED", \
            f"Expected error code VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error details should contain specific validation errors
        assert "errors" in exc_info.value.details, \
            "Error details should contain 'errors' field"
        
        errors = exc_info.value.details["errors"]
        assert len(errors) > 0, "Should have at least one validation error"
        
        # Property: Error should be present (date ordering is validated)
        # The specific error message may vary, but validation should fail
        assert exc_info.value.code == "VALIDATION_FAILED", \
            "Validation should fail for invalid date ordering"
    
    @given(
        name_variant=st.sampled_from([
            "",  # Empty string
            "   ",  # Whitespace only
            "\t\n",  # Tabs and newlines
        ])
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_12_required_phase_fields_empty_name(self, db_session, test_project, name_variant):
        """
        Property 12: Required Phase Fields (Empty Name)
        
        For any phase creation request, if the name field is empty or contains
        only whitespace, the system should reject the request with a validation error.
        
        **Validates: Requirements 5.1**
        """
        # First create a default phase so the project has valid phase coverage
        default_phase = phase_service.create_default_phase(
            db_session,
            test_project.id,
            test_project.start_date,
            test_project.end_date
        )
        
        # Now try to update the default phase with an empty/whitespace name
        # This tests the required field validation
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_phase(
                db_session,
                default_phase.id,
                name=name_variant  # Empty or whitespace name
            )
        
        # Property: Should raise ValidationError
        assert exc_info.value.code == "VALIDATION_FAILED", \
            f"Expected error code VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error should mention empty name
        error_str = str(exc_info.value.details).lower()
        assert "name" in error_str and ("empty" in error_str or "cannot be" in error_str), \
            "Error should mention empty name"
    
    @given(
        name_length=st.integers(min_value=101, max_value=200)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_12_required_phase_fields_name_too_long(self, db_session, test_project, name_length):
        """
        Property 12: Required Phase Fields (Name Too Long)
        
        For any phase creation request, if the name field exceeds 100 characters,
        the system should reject the request with a validation error.
        
        **Validates: Requirements 5.1**
        """
        # First create a default phase so the project has valid phase coverage
        default_phase = phase_service.create_default_phase(
            db_session,
            test_project.id,
            test_project.start_date,
            test_project.end_date
        )
        
        # Create a name that exceeds maximum length
        long_name = "A" * name_length
        
        # Try to update the phase with an overly long name
        with pytest.raises(ValidationError) as exc_info:
            phase_service.update_phase(
                db_session,
                default_phase.id,
                name=long_name
            )
        
        # Property: Should raise ValidationError
        assert exc_info.value.code == "VALIDATION_FAILED", \
            f"Expected error code VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error should mention name length
        error_str = str(exc_info.value.details).lower()
        assert "name" in error_str and ("length" in error_str or "exceeds" in error_str or "maximum" in error_str), \
            "Error should mention name length violation"
    
    @given(
        name_update=st.text(min_size=1, max_size=100),
        budget_update=st.decimals(min_value=0, max_value=100000, places=2),
        description_update=st.one_of(st.none(), st.text(max_size=500))
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_13_phase_update_flexibility(self, db_session, test_program, name_update, budget_update, description_update):
        """
        Property 13: Phase Update Flexibility
        
        For any existing phase, updates to the name, description, start_date,
        end_date, capital_budget, expense_budget, or total_budget fields should
        succeed if the resulting phase configuration maintains timeline continuity
        and satisfies all validation constraints.
        
        **Validates: Requirements 5.3**
        """
        # Filter out problematic characters from name
        name_update = ''.join(c for c in name_update if c.isprintable() and c not in '\x00\r\n')
        if not name_update or not name_update.strip():
            name_update = "Updated Phase"
        
        # Filter out problematic characters from description if present
        if description_update:
            description_update = ''.join(c for c in description_update if c.isprintable() and c not in '\x00\r\n')
        
        # Create a fresh project for this test iteration to avoid phase accumulation
        project = Project(
            id=uuid4(),
            program_id=test_program.id,
            name=f"Test Project {uuid4().hex[:8]}",
            business_sponsor="Test Sponsor",
            project_manager="Test Manager",
            technical_lead="Test Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        
        # Create initial phase covering entire project
        phase = phase_service.create_default_phase(
            db_session,
            project.id,
            project.start_date,
            project.end_date
        )
        
        # Update phase with new name, description, and budget (dates remain the same to maintain continuity)
        updated_phase = phase_service.update_phase(
            db_session,
            phase.id,
            name=name_update,
            description=description_update,
            capital_budget=budget_update,
            expense_budget=Decimal("0"),
            total_budget=budget_update
        )
        
        # Property: Update should succeed
        assert updated_phase is not None, "Update should succeed"
        
        # Property: Name should be updated
        assert updated_phase.name == name_update, \
            f"Expected name '{name_update}', got '{updated_phase.name}'"
        
        # Property: Description should be updated
        assert updated_phase.description == description_update, \
            f"Expected description '{description_update}', got '{updated_phase.description}'"
        
        # Property: Budget should be updated
        assert updated_phase.capital_budget == budget_update, \
            f"Expected capital budget {budget_update}, got {updated_phase.capital_budget}"
        assert updated_phase.expense_budget == Decimal("0"), \
            f"Expected expense budget 0, got {updated_phase.expense_budget}"
        assert updated_phase.total_budget == budget_update, \
            f"Expected total budget {budget_update}, got {updated_phase.total_budget}"
        
        # Property: Dates should remain unchanged (maintaining continuity)
        assert updated_phase.start_date == project.start_date, \
            "Start date should remain unchanged"
        assert updated_phase.end_date == project.end_date, \
            "End date should remain unchanged"
    
    @given(
        project_duration=st.integers(min_value=60, max_value=365)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_14_gap_creating_deletion_prevention(self, db_session, test_program, project_duration):
        """
        Property 14: Gap-Creating Deletion Prevention
        
        For any phase deletion request, if removing the phase would create a gap
        in the project timeline, the system should reject the deletion with a
        validation error.
        
        **Validates: Requirements 5.4**
        """
        # Create a fresh project for this test iteration
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        
        project = Project(
            id=uuid4(),
            program_id=test_program.id,
            name=f"Test Project {uuid4().hex[:8]}",
            business_sponsor="Test Sponsor",
            project_manager="Test Manager",
            technical_lead="Test Lead",
            start_date=project_start,
            end_date=project_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        
        # Create three phases covering the entire project directly in DB (bypassing validation)
        # This allows us to set up the test scenario
        third_point = project_duration // 3
        two_thirds_point = (project_duration * 2) // 3
        
        phase1 = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Phase 1",
            start_date=project_start,
            end_date=project_start + timedelta(days=third_point),
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        phase2 = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Phase 2",
            start_date=project_start + timedelta(days=third_point + 1),
            end_date=project_start + timedelta(days=two_thirds_point),
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        phase3 = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Phase 3",
            start_date=project_start + timedelta(days=two_thirds_point + 1),
            end_date=project_end,
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        db_session.add(phase1)
        db_session.add(phase2)
        db_session.add(phase3)
        db_session.commit()
        
        # Try to delete middle phase (would create gap between phase1 and phase3)
        # Property: Deletion should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            phase_service.delete_phase(db_session, phase2.id)
        
        # Property: Error should indicate gap creation or validation failure
        assert exc_info.value.code in ["DELETION_CREATES_GAP", "VALIDATION_FAILED"], \
            f"Expected error code DELETION_CREATES_GAP or VALIDATION_FAILED, got {exc_info.value.code}"
        
        # Property: Error message should mention gap
        error_str = str(exc_info.value).lower()
        assert "gap" in error_str, "Error should mention gap in timeline"
    
    @given(
        project_duration=st.integers(min_value=90, max_value=365)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_15_valid_deletion_allowance(self, db_session, test_project, project_duration):
        """
        Property 15: Valid Deletion Allowance
        
        For any phase deletion request, if the remaining phases after deletion
        still form a continuous, non-overlapping timeline covering the entire
        project duration, the system should allow the deletion.
        
        **Validates: Requirements 5.5**
        
        Test scenario: Create a phase that completely overlaps with another,
        then delete the redundant phase. The remaining phase should still
        cover the timeline.
        """
        # Update project dates
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        test_project.start_date = project_start
        test_project.end_date = project_end
        db_session.commit()
        
        # Delete any existing phases first
        existing_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == test_project.id
        ).all()
        for phase in existing_phases:
            db_session.delete(phase)
        db_session.commit()
        
        # Create a single phase covering entire project
        # This will be our "main" phase that covers everything
        phase_main = ProjectPhase(
            id=uuid4(),
            project_id=test_project.id,
            name="Main Phase",
            start_date=project_start,
            end_date=project_end,
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        db_session.add(phase_main)
        db_session.commit()
        
        # Now we want to test that we can delete a redundant phase
        # But we can't create an overlapping phase through the service
        # So we'll create it directly in the database (simulating a scenario
        # where phases were adjusted and one became redundant)
        
        # Create a redundant phase that's completely covered by phase_main
        midpoint = project_duration // 2
        phase_redundant = ProjectPhase(
            id=uuid4(),
            project_id=test_project.id,
            name="Redundant Phase",
            start_date=project_start + timedelta(days=midpoint - 10),
            end_date=project_start + timedelta(days=midpoint + 10),
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        db_session.add(phase_redundant)
        db_session.commit()
        
        # Now delete the redundant phase
        # Property: Deletion should succeed because phase_main still covers entire project
        phase_service.delete_phase(db_session, phase_redundant.id)
        
        # Verify redundant phase is deleted
        remaining_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == test_project.id
        ).all()
        
        # Property: Only one phase should remain
        assert len(remaining_phases) == 1, \
            f"Expected 1 remaining phase, found {len(remaining_phases)}"
        
        # Property: Remaining phase should be phase_main
        assert remaining_phases[0].id == phase_main.id, \
            "Remaining phase should be phase_main"
        
        # Property: Remaining phase should cover entire project
        assert remaining_phases[0].start_date == project_start, \
            "Remaining phase should start at project start"
        assert remaining_phases[0].end_date == project_end, \
            "Remaining phase should end at project end"
    
    @given(
        project_duration=st.integers(min_value=30, max_value=365),
        assignment_offset=st.integers(min_value=0, max_value=20)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_16_date_based_phase_association(self, db_session, test_project, 
                                                      project_duration, assignment_offset):
        """
        Property 16: Date-Based Phase Association
        
        For any resource assignment with an assignment_date, querying for the
        phase that contains that assignment should return the unique phase where
        start_date <= assignment_date <= end_date within the assignment's project.
        
        **Validates: Requirements 6.2, 6.3**
        """
        # Ensure assignment date is within project
        assume(assignment_offset < project_duration)
        
        # Update project dates
        project_start = date(2024, 1, 1)
        project_end = project_start + timedelta(days=project_duration)
        test_project.start_date = project_start
        test_project.end_date = project_end
        db_session.commit()
        
        # Delete any existing phases first
        existing_phases = db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == test_project.id
        ).all()
        for phase in existing_phases:
            db_session.delete(phase)
        db_session.commit()
        
        # Create two phases covering the entire project
        midpoint = project_duration // 2
        
        phase1 = ProjectPhase(
            id=uuid4(),
            project_id=test_project.id,
            name="Phase 1",
            start_date=project_start,
            end_date=project_start + timedelta(days=midpoint),
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        phase2 = ProjectPhase(
            id=uuid4(),
            project_id=test_project.id,
            name="Phase 2",
            start_date=project_start + timedelta(days=midpoint + 1),
            end_date=project_end,
            capital_budget=Decimal("0"),
            expense_budget=Decimal("0"),
            total_budget=Decimal("0")
        )
        
        db_session.add(phase1)
        db_session.add(phase2)
        db_session.commit()
        
        # Pick an assignment date
        assignment_date = project_start + timedelta(days=assignment_offset)
        
        # Get phase for this date
        phase_for_date = phase_service.get_phase_for_date(
            db_session,
            test_project.id,
            assignment_date
        )
        
        # Property: Should find exactly one phase
        assert phase_for_date is not None, \
            f"Should find phase for date {assignment_date}"
        
        # Property: Assignment date should be within phase date range
        assert phase_for_date.start_date <= assignment_date <= phase_for_date.end_date, \
            f"Assignment date {assignment_date} should be within phase range " \
            f"[{phase_for_date.start_date}, {phase_for_date.end_date}]"
        
        # Property: Should be either phase1 or phase2
        assert phase_for_date.id in [phase1.id, phase2.id], \
            "Phase should be one of the created phases"
        
        # Property: Verify correct phase based on date
        if assignment_date <= phase1.end_date:
            assert phase_for_date.id == phase1.id, \
                f"Date {assignment_date} should be in Phase 1"
        else:
            assert phase_for_date.id == phase2.id, \
                f"Date {assignment_date} should be in Phase 2"
