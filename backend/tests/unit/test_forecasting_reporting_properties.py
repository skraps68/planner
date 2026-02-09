"""
Property-based tests for forecasting and reporting services with date-based phase filtering.

These tests verify universal properties for phase cost calculation, phase forecast
calculation, and phase budget aggregation.
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
from app.models.resource import Resource, ResourceType, WorkerType
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.models.rate import Rate
from app.services.forecasting import forecasting_service
from app.services.reporting import reporting_service


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
        description="Test program"
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


@pytest.fixture
def test_worker_type(db_session):
    """Create a test worker type."""
    worker_type = WorkerType(
        id=uuid4(),
        name="Software Engineer",
        description="Test worker type"
    )
    db_session.add(worker_type)
    db_session.commit()
    db_session.refresh(worker_type)
    return worker_type


@pytest.fixture
def test_resource(db_session):
    """Create a test resource."""
    resource = Resource(
        id=uuid4(),
        name="Test Resource",
        resource_type=ResourceType.LABOR
    )
    db_session.add(resource)
    db_session.commit()
    db_session.refresh(resource)
    return resource


# Property Tests

@pytest.mark.property_test
class TestForecastingReportingProperties:
    """Property-based tests for forecasting and reporting services."""
    
    @given(
        num_phases=st.integers(min_value=1, max_value=5),
        num_actuals_per_phase=st.integers(min_value=0, max_value=10)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_17_phase_cost_calculation(
        self,
        db_session,
        test_project,
        test_resource,
        num_phases,
        num_actuals_per_phase
    ):
        """
        Property 17: Phase Cost Calculation
        
        For any phase, the calculated actual cost should equal the sum of all
        actual costs from resource assignments where the assignment_date falls
        within the phase's date range.
        
        Validates: Requirements 8.2
        """
        # Clear any existing data from previous Hypothesis examples
        db_session.query(Actual).delete()
        db_session.query(ProjectPhase).delete()
        db_session.commit()
        
        # Create continuous phases
        project_start = test_project.start_date
        project_end = test_project.end_date
        total_days = (project_end - project_start).days
        
        # Ensure we have enough days for the phases
        assume(total_days >= num_phases)
        
        days_per_phase = total_days // num_phases
        phases = []
        current_date = project_start
        
        for i in range(num_phases):
            if i == num_phases - 1:
                # Last phase ends at project end
                phase_end = project_end
            else:
                phase_end = current_date + timedelta(days=days_per_phase - 1)
            
            phase = ProjectPhase(
                id=uuid4(),
                project_id=test_project.id,
                name=f"Phase {i+1}",
                start_date=current_date,
                end_date=phase_end,
                capital_budget=Decimal("10000.00"),
                expense_budget=Decimal("5000.00"),
                total_budget=Decimal("15000.00")
            )
            db_session.add(phase)
            phases.append(phase)
            
            current_date = phase_end + timedelta(days=1)
        
        db_session.commit()
        
        # For each phase, create actuals and track expected cost
        for phase in phases:
            expected_cost = Decimal("0.00")
            
            # Create actuals within the phase date range
            phase_days = (phase.end_date - phase.start_date).days + 1
            
            for j in range(min(num_actuals_per_phase, phase_days)):
                # Distribute actuals across the phase
                actual_date = phase.start_date + timedelta(days=j * (phase_days // max(num_actuals_per_phase, 1)))
                
                # Ensure actual_date is within phase bounds
                if actual_date > phase.end_date:
                    actual_date = phase.end_date
                
                actual_cost = Decimal("100.00") * (j + 1)
                capital_amount = actual_cost * Decimal("0.6")
                expense_amount = actual_cost * Decimal("0.4")
                
                actual = Actual(
                    id=uuid4(),
                    project_id=test_project.id,
                    resource_assignment_id=None,  # Not linked to a specific assignment
                    external_worker_id=f"WORKER-{j}",
                    worker_name=f"Worker {j}",
                    actual_date=actual_date,
                    actual_cost=actual_cost,
                    capital_amount=capital_amount,
                    expense_amount=expense_amount
                )
                db_session.add(actual)
                expected_cost += actual_cost
            
            db_session.commit()
            
            # Calculate phase cost using the service
            phase_cost_result = forecasting_service.calculate_phase_cost(
                db=db_session,
                phase_id=phase.id,
                as_of_date=phase.end_date
            )
            
            calculated_cost = Decimal(str(phase_cost_result["actual"]["total"]))
            
            # Property: Calculated cost should equal sum of actuals in phase date range
            assert calculated_cost == expected_cost, (
                f"Phase cost calculation mismatch: "
                f"expected {expected_cost}, got {calculated_cost}"
            )
    
    @given(
        num_phases=st.integers(min_value=1, max_value=5),
        num_assignments_per_phase=st.integers(min_value=0, max_value=10)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_18_phase_forecast_calculation(
        self,
        db_session,
        test_project,
        test_resource,
        num_phases,
        num_assignments_per_phase
    ):
        """
        Property 18: Phase Forecast Calculation
        
        For any phase, the calculated forecast cost should equal the sum of all
        forecast costs from resource assignments where the assignment_date falls
        within the phase's date range and is in the future.
        
        Validates: Requirements 8.3
        """
        # Clear any existing data from previous Hypothesis examples
        db_session.query(ResourceAssignment).delete()
        db_session.query(ProjectPhase).delete()
        db_session.commit()
        
        # Create continuous phases
        project_start = test_project.start_date
        project_end = test_project.end_date
        total_days = (project_end - project_start).days
        
        # Ensure we have enough days for the phases
        assume(total_days >= num_phases)
        
        days_per_phase = total_days // num_phases
        phases = []
        current_date = project_start
        
        for i in range(num_phases):
            if i == num_phases - 1:
                # Last phase ends at project end
                phase_end = project_end
            else:
                phase_end = current_date + timedelta(days=days_per_phase - 1)
            
            phase = ProjectPhase(
                id=uuid4(),
                project_id=test_project.id,
                name=f"Phase {i+1}",
                start_date=current_date,
                end_date=phase_end,
                capital_budget=Decimal("10000.00"),
                expense_budget=Decimal("5000.00"),
                total_budget=Decimal("15000.00")
            )
            db_session.add(phase)
            phases.append(phase)
            
            current_date = phase_end + timedelta(days=1)
        
        db_session.commit()
        
        # Set as_of_date to middle of project
        as_of_date = project_start + timedelta(days=total_days // 2)
        
        # For each phase, create future assignments and track expected forecast
        for phase in phases:
            expected_forecast = Decimal("0.00")
            
            # Create assignments within the phase date range
            phase_days = (phase.end_date - phase.start_date).days + 1
            
            for j in range(min(num_assignments_per_phase, phase_days)):
                # Distribute assignments across the phase
                assignment_date = phase.start_date + timedelta(days=j * (phase_days // max(num_assignments_per_phase, 1)))
                
                # Ensure assignment_date is within phase bounds
                if assignment_date > phase.end_date:
                    assignment_date = phase.end_date
                
                assignment = ResourceAssignment(
                    id=uuid4(),
                    resource_id=test_resource.id,
                    project_id=test_project.id,
                    assignment_date=assignment_date,
                    capital_percentage=Decimal("60.00"),
                    expense_percentage=Decimal("40.00")
                )
                db_session.add(assignment)
                
                # Only count assignments after as_of_date for forecast
                if assignment_date > as_of_date:
                    # Default cost calculation: $1000/day * 100% allocation
                    expected_forecast += Decimal("1000.00")
            
            db_session.commit()
            
            # Calculate phase forecast using the service
            phase_forecast_result = forecasting_service.calculate_phase_forecast(
                db=db_session,
                phase_id=phase.id,
                as_of_date=as_of_date
            )
            
            calculated_forecast = Decimal(str(phase_forecast_result["forecast"]["total"]))
            
            # Property: Calculated forecast should equal sum of future assignments in phase date range
            assert calculated_forecast == expected_forecast, (
                f"Phase forecast calculation mismatch: "
                f"expected {expected_forecast}, got {calculated_forecast}"
            )
    
    @given(
        num_phases=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_19_phase_budget_aggregation(
        self,
        db_session,
        test_project,
        num_phases
    ):
        """
        Property 19: Phase Budget Aggregation
        
        For any project, the sum of all phase budgets (capital_budget, expense_budget,
        total_budget) should equal the project-level budget totals.
        
        Validates: Requirements 8.5
        """
        # Delete any existing phases for this project to ensure clean state
        db_session.query(ProjectPhase).filter(
            ProjectPhase.project_id == test_project.id
        ).delete()
        db_session.commit()
        
        # Create continuous phases with varying budgets
        project_start = test_project.start_date
        project_end = test_project.end_date
        total_days = (project_end - project_start).days
        
        # Ensure we have enough days for the phases
        assume(total_days >= num_phases)
        
        days_per_phase = total_days // num_phases
        phases = []
        current_date = project_start
        
        expected_total_capital = Decimal("0.00")
        expected_total_expense = Decimal("0.00")
        expected_total_budget = Decimal("0.00")
        
        for i in range(num_phases):
            if i == num_phases - 1:
                # Last phase ends at project end
                phase_end = project_end
            else:
                phase_end = current_date + timedelta(days=days_per_phase - 1)
            
            # Generate varying budgets for each phase
            capital_budget = Decimal("1000.00") * (i + 1)
            expense_budget = Decimal("500.00") * (i + 1)
            total_budget = capital_budget + expense_budget
            
            phase = ProjectPhase(
                id=uuid4(),
                project_id=test_project.id,
                name=f"Phase {i+1}",
                start_date=current_date,
                end_date=phase_end,
                capital_budget=capital_budget,
                expense_budget=expense_budget,
                total_budget=total_budget
            )
            db_session.add(phase)
            phases.append(phase)
            
            expected_total_capital += capital_budget
            expected_total_expense += expense_budget
            expected_total_budget += total_budget
            
            current_date = phase_end + timedelta(days=1)
        
        db_session.commit()
        
        # Get phase-level report which aggregates budgets
        phase_report = reporting_service.get_phase_level_report(
            db=db_session,
            project_id=test_project.id,
            as_of_date=date.today()
        )
        
        aggregated_capital = Decimal(str(phase_report["project_totals"]["budget"]["capital"]))
        aggregated_expense = Decimal(str(phase_report["project_totals"]["budget"]["expense"]))
        aggregated_total = Decimal(str(phase_report["project_totals"]["budget"]["total"]))
        
        # Property: Aggregated budgets should equal sum of phase budgets
        assert aggregated_capital == expected_total_capital, (
            f"Capital budget aggregation mismatch: "
            f"expected {expected_total_capital}, got {aggregated_capital}"
        )
        
        assert aggregated_expense == expected_total_expense, (
            f"Expense budget aggregation mismatch: "
            f"expected {expected_total_expense}, got {aggregated_expense}"
        )
        
        assert aggregated_total == expected_total_budget, (
            f"Total budget aggregation mismatch: "
            f"expected {expected_total_budget}, got {aggregated_total}"
        )
        
        # Additional property: Total should equal capital + expense
        assert aggregated_total == aggregated_capital + aggregated_expense, (
            "Total budget should equal capital + expense"
        )
