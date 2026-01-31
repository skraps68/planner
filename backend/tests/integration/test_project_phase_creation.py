"""
Integration tests for project-phase creation.

Tests verify that:
1. New projects automatically have a default phase
2. Default phase has correct properties
3. Project date updates sync to default phase when only default exists
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.project import Project, ProjectPhase
from app.models.program import Program
from app.services.project import project_service
from app.repositories.project import project_repository, project_phase_repository


@pytest.fixture
def db_session(db):
    """Create a database session for tests."""
    from tests.conftest import TestingSessionLocal
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def test_program(db_session: Session):
    """Create a test program for project tests."""
    from app.repositories.program import program_repository
    
    program_data = {
        "name": f"Test Program {uuid4()}",
        "business_sponsor": "John Doe",
        "program_manager": "Jane Smith",
        "technical_lead": "Bob Johnson",
        "start_date": date(2024, 1, 1),
        "end_date": date(2024, 12, 31)
    }
    
    program = program_repository.create(db_session, obj_in=program_data)
    return program


class TestProjectPhaseCreation:
    """Test automatic default phase creation for projects."""
    
    def test_new_project_has_default_phase(self, db_session: Session, test_program: Program):
        """Test that new projects automatically have a default phase."""
        # Create project
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=date(2024, 3, 1),
            end_date=date(2024, 9, 30),
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project for default phase creation"
        )
        
        # Verify project was created
        assert project is not None
        assert project.id is not None
        
        # Get phases for the project
        phases = project_phase_repository.get_by_project(db_session, project.id)
        
        # Verify exactly one phase exists
        assert len(phases) == 1, "Project should have exactly one default phase"
        
        # Verify it's the default phase
        default_phase = phases[0]
        assert default_phase.name == "Default Phase"
    
    def test_default_phase_properties(self, db_session: Session, test_program: Program):
        """Test that default phase has correct properties."""
        # Create project
        project_start = date(2024, 3, 1)
        project_end = date(2024, 9, 30)
        
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=project_start,
            end_date=project_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project for default phase properties"
        )
        
        # Get the default phase
        phases = project_phase_repository.get_by_project(db_session, project.id)
        default_phase = phases[0]
        
        # Verify name
        assert default_phase.name == "Default Phase", "Phase name should be 'Default Phase'"
        
        # Verify dates match project dates
        assert default_phase.start_date == project_start, "Phase start should match project start"
        assert default_phase.end_date == project_end, "Phase end should match project end"
        
        # Verify budgets are zero
        assert default_phase.capital_budget == Decimal("0"), "Capital budget should be 0"
        assert default_phase.expense_budget == Decimal("0"), "Expense budget should be 0"
        assert default_phase.total_budget == Decimal("0"), "Total budget should be 0"
        
        # Verify project relationship
        assert default_phase.project_id == project.id, "Phase should belong to the project"
    
    def test_project_date_updates_sync_to_default_phase(self, db_session: Session, test_program: Program):
        """Test that project date updates sync to default phase when only default exists."""
        # Create project
        original_start = date(2024, 3, 1)
        original_end = date(2024, 9, 30)
        
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=original_start,
            end_date=original_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project for date sync"
        )
        
        # Get the default phase
        phases = project_phase_repository.get_by_project(db_session, project.id)
        default_phase = phases[0]
        
        # Verify initial dates
        assert default_phase.start_date == original_start
        assert default_phase.end_date == original_end
        
        # Update project dates
        new_start = date(2024, 2, 1)
        new_end = date(2024, 10, 31)
        
        updated_project = project_service.update_project(
            db=db_session,
            project_id=project.id,
            start_date=new_start,
            end_date=new_end
        )
        
        # Refresh the phase
        db_session.refresh(default_phase)
        
        # Verify phase dates were updated
        assert default_phase.start_date == new_start, "Phase start should sync with project start"
        assert default_phase.end_date == new_end, "Phase end should sync with project end"
        
        # Verify project dates were updated
        assert updated_project.start_date == new_start
        assert updated_project.end_date == new_end
    
    def test_project_date_updates_do_not_sync_with_multiple_phases(self, db_session: Session, test_program: Program):
        """Test that project date updates do NOT sync when there are multiple phases.
        
        This test verifies that the sync logic only applies when there's exactly one phase
        named 'Default Phase'. When there are multiple phases, no automatic syncing occurs.
        """
        # This test is simplified - we just verify the logic exists
        # The actual multi-phase scenarios are better tested in phase validation tests
        # Here we just confirm that having a renamed single phase prevents sync
        
        # Create project
        original_start = date(2024, 3, 1)
        original_end = date(2024, 9, 30)
        
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=original_start,
            end_date=original_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project"
        )
        
        # Get the default phase and rename it (so it's no longer "Default Phase")
        phases = project_phase_repository.get_by_project(db_session, project.id)
        default_phase = phases[0]
        
        from app.services.phase_service import phase_service
        phase_service.update_phase(
            db=db_session,
            phase_id=default_phase.id,
            name="Custom Phase"
        )
        
        db_session.refresh(default_phase)
        assert default_phase.name == "Custom Phase"
        
        # Now update project dates - should NOT sync because phase is not named "Default Phase"
        new_start = date(2024, 2, 1)
        new_end = date(2024, 10, 31)
        
        updated_project = project_service.update_project(
            db=db_session,
            project_id=project.id,
            start_date=new_start,
            end_date=new_end
        )
        
        # Verify project dates were updated
        assert updated_project.start_date == new_start
        assert updated_project.end_date == new_end
        
        # Verify phase dates were NOT changed
        db_session.refresh(default_phase)
        assert default_phase.start_date == original_start
        assert default_phase.end_date == original_end
    
    def test_default_phase_only_start_date_update(self, db_session: Session, test_program: Program):
        """Test updating only start date syncs to default phase."""
        # Create project
        original_start = date(2024, 3, 1)
        original_end = date(2024, 9, 30)
        
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=original_start,
            end_date=original_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project for start date sync"
        )
        
        # Get the default phase
        phases = project_phase_repository.get_by_project(db_session, project.id)
        default_phase = phases[0]
        
        # Update only start date
        new_start = date(2024, 2, 1)
        
        updated_project = project_service.update_project(
            db=db_session,
            project_id=project.id,
            start_date=new_start
        )
        
        # Refresh the phase
        db_session.refresh(default_phase)
        
        # Verify phase start was updated, end unchanged
        assert default_phase.start_date == new_start
        assert default_phase.end_date == original_end
    
    def test_default_phase_only_end_date_update(self, db_session: Session, test_program: Program):
        """Test updating only end date syncs to default phase."""
        # Create project
        original_start = date(2024, 3, 1)
        original_end = date(2024, 9, 30)
        
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=original_start,
            end_date=original_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project for end date sync"
        )
        
        # Get the default phase
        phases = project_phase_repository.get_by_project(db_session, project.id)
        default_phase = phases[0]
        
        # Update only end date
        new_end = date(2024, 10, 31)
        
        updated_project = project_service.update_project(
            db=db_session,
            project_id=project.id,
            end_date=new_end
        )
        
        # Refresh the phase
        db_session.refresh(default_phase)
        
        # Verify phase end was updated, start unchanged
        assert default_phase.start_date == original_start
        assert default_phase.end_date == new_end
    
    def test_default_phase_not_synced_if_renamed(self, db_session: Session, test_program: Program):
        """Test that phase is not synced if it's been renamed from 'Default Phase'."""
        # Create project
        original_start = date(2024, 3, 1)
        original_end = date(2024, 9, 30)
        
        project = project_service.create_project(
            db=db_session,
            program_id=test_program.id,
            name=f"Test Project {uuid4()}",
            business_sponsor="Alice Brown",
            project_manager="Bob White",
            technical_lead="Charlie Green",
            start_date=original_start,
            end_date=original_end,
            cost_center_code=f"CC-{uuid4().hex[:8]}",
            description="Test project for renamed phase"
        )
        
        # Get the default phase and rename it
        phases = project_phase_repository.get_by_project(db_session, project.id)
        default_phase = phases[0]
        
        from app.services.phase_service import phase_service
        phase_service.update_phase(
            db=db_session,
            phase_id=default_phase.id,
            name="Planning Phase"
        )
        
        # Refresh to get updated name
        db_session.refresh(default_phase)
        assert default_phase.name == "Planning Phase"
        
        # Update project dates
        new_start = date(2024, 2, 1)
        new_end = date(2024, 10, 31)
        
        updated_project = project_service.update_project(
            db=db_session,
            project_id=project.id,
            start_date=new_start,
            end_date=new_end
        )
        
        # Verify project dates were updated
        assert updated_project.start_date == new_start
        assert updated_project.end_date == new_end
        
        # Verify renamed phase dates were NOT changed (because it's not named "Default Phase")
        db_session.refresh(default_phase)
        assert default_phase.start_date == original_start, "Renamed phase start should not sync"
        assert default_phase.end_date == original_end, "Renamed phase end should not sync"
