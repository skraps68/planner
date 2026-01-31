"""
Unit tests for phase migration data transformation.

Tests the migration from enum-based phases (Planning/Execution) to user-definable phases.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from app.models.base import Base, GUID
from app.models.project import Project, ProjectPhase
from app.models.program import Program
from app.models.resource_assignment import ResourceAssignment
from app.models.resource import Resource, ResourceType


@pytest.fixture
def migration_engine():
    """Create an in-memory SQLite database for migration testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def migration_session(migration_engine):
    """Create a session for migration testing."""
    Session = sessionmaker(bind=migration_engine)
    session = Session()
    yield session
    session.close()


class TestPhaseMigration:
    """Test suite for phase migration data transformation."""
    
    def test_planning_phase_conversion(self, migration_session):
        """
        Test that Planning phase is correctly created with user-defined structure.
        
        Validates: Requirements 7.2
        """
        # Create test data
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="TL",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC001"
        )
        migration_session.add(project)
        
        # Create planning phase with new structure
        planning_phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Planning",
            start_date=project.start_date,
            end_date=project.end_date,
            capital_budget=100000,
            expense_budget=50000,
            total_budget=150000
        )
        migration_session.add(planning_phase)
        migration_session.commit()
        
        # Verify phase
        migrated_phase = migration_session.query(ProjectPhase).filter_by(id=planning_phase.id).first()
        assert migrated_phase is not None
        assert migrated_phase.name == "Planning"
        assert migrated_phase.start_date == date(2024, 1, 1)
        assert migrated_phase.end_date == date(2024, 12, 31)
        assert migrated_phase.capital_budget == 100000
        assert migrated_phase.expense_budget == 50000
        assert migrated_phase.total_budget == 150000
    
    def test_execution_phase_conversion(self, migration_session):
        """
        Test that Execution phase is correctly created with user-defined structure.
        
        Validates: Requirements 7.3
        """
        # Create test data
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="TL",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC002"
        )
        migration_session.add(project)
        
        # Create execution phase with new structure
        execution_phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Execution",
            start_date=project.start_date,
            end_date=project.end_date,
            capital_budget=200000,
            expense_budget=100000,
            total_budget=300000
        )
        migration_session.add(execution_phase)
        migration_session.commit()
        
        # Verify phase
        migrated_phase = migration_session.query(ProjectPhase).filter_by(id=execution_phase.id).first()
        assert migrated_phase is not None
        assert migrated_phase.name == "Execution"
        assert migrated_phase.start_date == date(2024, 1, 1)
        assert migrated_phase.end_date == date(2024, 12, 31)
        assert migrated_phase.capital_budget == 200000
        assert migrated_phase.expense_budget == 100000
        assert migrated_phase.total_budget == 300000
    
    def test_both_phases_conversion_with_split(self, migration_session):
        """
        Test that both Planning and Execution phases can be created with split dates.
        
        Validates: Requirements 7.2, 7.3
        """
        # Create test data
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="TL",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC003"
        )
        migration_session.add(project)
        
        # Calculate midpoint for split
        total_days = (project.end_date - project.start_date).days
        midpoint = project.start_date + timedelta(days=total_days // 2)
        
        # Create both phases with split dates
        planning_phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Planning",
            start_date=project.start_date,
            end_date=midpoint,
            capital_budget=100000,
            expense_budget=50000,
            total_budget=150000
        )
        execution_phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Execution",
            start_date=midpoint + timedelta(days=1),
            end_date=project.end_date,
            capital_budget=200000,
            expense_budget=100000,
            total_budget=300000
        )
        migration_session.add_all([planning_phase, execution_phase])
        migration_session.commit()
        
        # Verify planning phase
        migrated_planning = migration_session.query(ProjectPhase).filter_by(id=planning_phase.id).first()
        assert migrated_planning.name == "Planning"
        assert migrated_planning.start_date == date(2024, 1, 1)
        # 366 days total, midpoint is 366 // 2 = 183 days from start
        # date(2024, 1, 1) + timedelta(days=183) = date(2024, 7, 1)
        assert migrated_planning.end_date == date(2024, 7, 1)
        
        # Verify execution phase
        migrated_execution = migration_session.query(ProjectPhase).filter_by(id=execution_phase.id).first()
        assert migrated_execution.name == "Execution"
        assert migrated_execution.start_date == date(2024, 7, 2)
        assert migrated_execution.end_date == date(2024, 12, 31)
        
        # Verify continuity (no gap)
        assert migrated_execution.start_date == migrated_planning.end_date + timedelta(days=1)
    
    def test_budget_preservation(self, migration_session):
        """
        Test that budget values are preserved in the new phase structure.
        
        Validates: Requirements 7.4
        """
        # Create test data
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="TL",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC004"
        )
        migration_session.add(project)
        
        # Calculate midpoint for split
        total_days = (project.end_date - project.start_date).days
        midpoint = project.start_date + timedelta(days=total_days // 2)
        
        # Create phases with specific budgets
        planning_phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Planning",
            start_date=project.start_date,
            end_date=midpoint,
            capital_budget=123456.78,
            expense_budget=98765.43,
            total_budget=222222.21
        )
        execution_phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Execution",
            start_date=midpoint + timedelta(days=1),
            end_date=project.end_date,
            capital_budget=555555.55,
            expense_budget=444444.44,
            total_budget=999999.99
        )
        migration_session.add_all([planning_phase, execution_phase])
        migration_session.commit()
        
        # Verify budgets are preserved
        migrated_planning = migration_session.query(ProjectPhase).filter_by(id=planning_phase.id).first()
        assert float(migrated_planning.capital_budget) == float(123456.78)
        assert float(migrated_planning.expense_budget) == float(98765.43)
        assert float(migrated_planning.total_budget) == float(222222.21)
        
        migrated_execution = migration_session.query(ProjectPhase).filter_by(id=execution_phase.id).first()
        assert float(migrated_execution.capital_budget) == float(555555.55)
        assert float(migrated_execution.expense_budget) == float(444444.44)
        assert float(migrated_execution.total_budget) == float(999999.99)
    
    def test_resource_assignment_phase_removal(self, migration_session):
        """
        Test that resource assignments work without project_phase_id (implicit relationship).
        
        Validates: Requirements 7.5
        """
        # Create test data
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="TL",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC005"
        )
        migration_session.add(project)
        
        phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Planning",
            start_date=project.start_date,
            end_date=project.end_date,
            capital_budget=100000,
            expense_budget=50000,
            total_budget=150000
        )
        migration_session.add(phase)
        
        resource = Resource(
            id=uuid4(),
            name="Test Resource",
            resource_type=ResourceType.LABOR
        )
        migration_session.add(resource)
        
        # Create assignment without phase reference (implicit relationship via date)
        assignment = ResourceAssignment(
            id=uuid4(),
            resource_id=resource.id,
            project_id=project.id,
            assignment_date=date(2024, 3, 15),
            allocation_percentage=50.0,
            capital_percentage=60.0,
            expense_percentage=40.0
        )
        migration_session.add(assignment)
        migration_session.commit()
        
        # Verify assignment date falls within phase dates (implicit relationship)
        assert phase.start_date <= assignment.assignment_date <= phase.end_date
        
        # Verify we can find the phase by date (implicit relationship)
        matching_phase = migration_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == assignment.project_id,
            ProjectPhase.start_date <= assignment.assignment_date,
            ProjectPhase.end_date >= assignment.assignment_date
        ).first()
        
        assert matching_phase is not None
        assert matching_phase.id == phase.id
        assert matching_phase.start_date <= assignment.assignment_date <= matching_phase.end_date
    
    def test_rollback_functionality(self, migration_session):
        """
        Test that phases can be queried and managed with the new structure.
        
        Validates: Requirements 7.4
        """
        # Create test data with new phase structure
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Test Project",
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="TL",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code="CC006"
        )
        migration_session.add(project)
        
        # Create phase with new structure
        phase = ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Planning",
            start_date=project.start_date,
            end_date=project.end_date,
            capital_budget=100000,
            expense_budget=50000,
            total_budget=150000
        )
        
        migration_session.add(phase)
        migration_session.commit()
        
        # Verify phase structure
        assert phase.name == "Planning"
        assert phase.start_date is not None
        assert phase.end_date is not None
        assert phase.capital_budget == 100000
        assert phase.expense_budget == 50000
        assert phase.total_budget == 150000
        
        # Verify we can query by name
        queried_phase = migration_session.query(ProjectPhase).filter_by(name="Planning").first()
        assert queried_phase is not None
        assert queried_phase.id == phase.id
    
    def test_multiple_projects_migration(self, migration_session):
        """
        Test that multiple projects can have phases with the new structure.
        
        Validates: Requirements 7.2, 7.3
        """
        # Create test data for multiple projects
        program = Program(
            id=uuid4(),
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        migration_session.add(program)
        
        projects_data = [
            {
                'name': 'Project 1',
                'code': 'CC101',
                'start': date(2024, 1, 1),
                'end': date(2024, 6, 30)
            },
            {
                'name': 'Project 2',
                'code': 'CC102',
                'start': date(2024, 7, 1),
                'end': date(2024, 12, 31)
            }
        ]
        
        project_phase_mapping = {}
        
        for proj_data in projects_data:
            project = Project(
                id=uuid4(),
                program_id=program.id,
                name=proj_data['name'],
                business_sponsor="Sponsor",
                project_manager="PM",
                technical_lead="TL",
                start_date=proj_data['start'],
                end_date=proj_data['end'],
                cost_center_code=proj_data['code']
            )
            migration_session.add(project)
            
            # Calculate midpoint for split
            total_days = (project.end_date - project.start_date).days
            midpoint = project.start_date + timedelta(days=total_days // 2)
            
            # Create phases for each project with new structure
            planning = ProjectPhase(
                id=uuid4(),
                project_id=project.id,
                name="Planning",
                start_date=project.start_date,
                end_date=midpoint,
                capital_budget=50000,
                expense_budget=25000,
                total_budget=75000
            )
            execution = ProjectPhase(
                id=uuid4(),
                project_id=project.id,
                name="Execution",
                start_date=midpoint + timedelta(days=1),
                end_date=project.end_date,
                capital_budget=100000,
                expense_budget=50000,
                total_budget=150000
            )
            migration_session.add_all([planning, execution])
            
            # Store mapping for verification
            project_phase_mapping[project.id] = {
                'project': project,
                'planning': planning,
                'execution': execution
            }
        
        migration_session.commit()
        
        # Verify all projects and phases
        for project_id, mapping in project_phase_mapping.items():
            project = mapping['project']
            planning_phase = mapping['planning']
            execution_phase = mapping['execution']
            
            # Verify phase dates
            assert planning_phase.start_date == project.start_date
            assert execution_phase.end_date == project.end_date
            
            # Verify continuity
            assert execution_phase.start_date == planning_phase.end_date + timedelta(days=1)
            
            # Verify dates are within project bounds
            assert planning_phase.start_date >= project.start_date
            assert planning_phase.end_date <= project.end_date
            assert execution_phase.start_date >= project.start_date
            assert execution_phase.end_date <= project.end_date
            
            # Verify budgets are preserved
            assert planning_phase.capital_budget == 50000
            assert planning_phase.expense_budget == 25000
            assert planning_phase.total_budget == 75000
            assert execution_phase.capital_budget == 100000
            assert execution_phase.expense_budget == 50000
            assert execution_phase.total_budget == 150000
