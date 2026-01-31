"""
Unit tests for forecasting and reporting services.
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
from app.models.resource import Resource, ResourceType, Worker, WorkerType
from app.models.rate import Rate
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.services.forecasting import forecasting_service
from app.services.reporting import reporting_service


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
    
    # Add execution phase with budget
    execution_phase = ProjectPhase(
        project_id=project.id,
        name="Execution Phase",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
        capital_budget=Decimal('100000.00'),
        expense_budget=Decimal('50000.00'),
        total_budget=Decimal('150000.00')
    )
    db.add(execution_phase)
    db.commit()
    
    return project


@pytest.fixture
def sample_worker_and_rate(db):
    """Create a sample worker with rate for testing."""
    # Create worker type
    worker_type = WorkerType(
        type="Engineer",
        description="Software Engineer"
    )
    db.add(worker_type)
    db.commit()
    db.refresh(worker_type)
    
    # Create worker
    worker = Worker(
        external_id="EMP001",
        name="John Worker",
        worker_type_id=worker_type.id
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    
    # Create rate
    rate = Rate(
        worker_type_id=worker_type.id,
        rate_amount=Decimal('1000.00'),
        start_date=date(2024, 1, 1),
        end_date=date(2099, 12, 31)
    )
    db.add(rate)
    db.commit()
    
    return worker, rate


@pytest.fixture
def sample_actuals(db, sample_project, sample_worker_and_rate):
    """Create sample actuals for testing."""
    worker, _ = sample_worker_and_rate
    
    actuals = []
    for i in range(5):
        actual = Actual(
            project_id=sample_project.id,
            external_worker_id=worker.external_id,
            worker_name=worker.name,
            actual_date=date(2024, 1, 1) + timedelta(days=i),
            allocation_percentage=Decimal('50.00'),
            actual_cost=Decimal('500.00'),
            capital_amount=Decimal('250.00'),
            expense_amount=Decimal('250.00')
        )
        actuals.append(actual)
        db.add(actual)
    
    db.commit()
    return actuals


class TestForecastingService:
    """Test ForecastingService."""
    
    def test_calculate_project_forecast_basic(self, db, sample_project, sample_actuals):
        """Test basic project forecast calculation."""
        forecast = forecasting_service.calculate_project_forecast(
            db=db,
            project_id=sample_project.id,
            as_of_date=date(2024, 1, 10)
        )
        
        assert forecast is not None
        assert forecast.entity_id == sample_project.id
        assert forecast.entity_name == sample_project.name
        assert forecast.entity_type == "project"
        assert forecast.total_budget == Decimal('150000.00')
        assert forecast.capital_budget == Decimal('100000.00')
        assert forecast.expense_budget == Decimal('50000.00')
        # Should have actuals from the 5 days
        assert forecast.total_actual == Decimal('2500.00')  # 5 days * 500
        assert forecast.capital_actual == Decimal('1250.00')  # 5 days * 250
        assert forecast.expense_actual == Decimal('1250.00')  # 5 days * 250
    
    def test_calculate_project_forecast_nonexistent(self, db):
        """Test forecast calculation for nonexistent project."""
        with pytest.raises(ValueError, match="does not exist"):
            forecasting_service.calculate_project_forecast(
                db=db,
                project_id=uuid4()
            )
    
    def test_calculate_program_forecast(self, db, sample_program, sample_project, sample_actuals):
        """Test program forecast calculation."""
        forecast = forecasting_service.calculate_program_forecast(
            db=db,
            program_id=sample_program.id,
            as_of_date=date(2024, 1, 10)
        )
        
        assert forecast is not None
        assert forecast.entity_id == sample_program.id
        assert forecast.entity_name == sample_program.name
        assert forecast.entity_type == "program"
        # Should aggregate from all projects in the program
        assert forecast.total_budget == Decimal('150000.00')
        assert forecast.total_actual == Decimal('2500.00')
    
    def test_get_budget_vs_actual_vs_forecast(self, db, sample_project, sample_actuals):
        """Test budget vs actual vs forecast report."""
        report = forecasting_service.get_budget_vs_actual_vs_forecast(
            db=db,
            entity_id=sample_project.id,
            entity_type="project",
            as_of_date=date(2024, 1, 10)
        )
        
        assert report is not None
        assert "budget" in report
        assert "actual" in report
        assert "forecast" in report
        assert "analysis" in report
        assert report["budget"]["total"] == 150000.00
        assert report["actual"]["total"] == 2500.00
    
    def test_get_budget_vs_actual_vs_forecast_invalid_type(self, db, sample_project):
        """Test budget vs actual vs forecast with invalid entity type."""
        with pytest.raises(ValueError, match="Invalid entity_type"):
            forecasting_service.get_budget_vs_actual_vs_forecast(
                db=db,
                entity_id=sample_project.id,
                entity_type="invalid"
            )
    
    def test_forecast_data_properties(self, db, sample_project, sample_actuals):
        """Test ForecastData calculated properties."""
        forecast = forecasting_service.calculate_project_forecast(
            db=db,
            project_id=sample_project.id,
            as_of_date=date(2024, 1, 10)
        )
        
        # Test budget_remaining
        assert forecast.budget_remaining == Decimal('147500.00')  # 150000 - 2500
        
        # Test budget_utilization_percentage
        expected_utilization = (Decimal('2500.00') / Decimal('150000.00')) * Decimal('100.00')
        assert abs(forecast.budget_utilization_percentage - expected_utilization) < Decimal('0.01')
    
    def test_calculate_cost_projection(self, db, sample_project):
        """Test cost projection calculation."""
        projection = forecasting_service.calculate_cost_projection(
            db=db,
            project_id=sample_project.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31)
        )
        
        assert projection is not None
        assert "project_id" in projection
        assert "summary" in projection
        assert "daily_projections" in projection


class TestReportingService:
    """Test ReportingService."""
    
    def test_get_project_report(self, db, sample_project, sample_actuals):
        """Test project report generation."""
        report = reporting_service.get_project_report(
            db=db,
            project_id=sample_project.id,
            as_of_date=date(2024, 1, 10),
            include_variance=False
        )
        
        assert report is not None
        assert report["project_id"] == str(sample_project.id)
        assert report["project_name"] == sample_project.name
        assert "financial_summary" in report
        assert "dates" in report
    
    def test_get_project_report_with_variance(self, db, sample_project, sample_actuals):
        """Test project report with variance analysis."""
        report = reporting_service.get_project_report(
            db=db,
            project_id=sample_project.id,
            as_of_date=date(2024, 1, 10),
            include_variance=True
        )
        
        assert report is not None
        assert "variance_analysis" in report
    
    def test_get_program_report(self, db, sample_program, sample_project, sample_actuals):
        """Test program report generation."""
        report = reporting_service.get_program_report(
            db=db,
            program_id=sample_program.id,
            as_of_date=date(2024, 1, 10),
            include_projects=True
        )
        
        assert report is not None
        assert report["program_id"] == str(sample_program.id)
        assert report["program_name"] == sample_program.name
        assert "financial_summary" in report
        assert "projects" in report
        assert report["projects_count"] == 1
    
    def test_get_multi_project_report(self, db, sample_project, sample_actuals):
        """Test multi-project report generation."""
        report = reporting_service.get_multi_project_report(
            db=db,
            project_ids=[sample_project.id],
            as_of_date=date(2024, 1, 10)
        )
        
        assert report is not None
        assert report["report_type"] == "multi_project"
        assert report["projects_count"] == 1
        assert "aggregated_summary" in report
        assert "projects" in report
    
    def test_get_budget_status_report(self, db, sample_project, sample_actuals):
        """Test budget status report generation."""
        report = reporting_service.get_budget_status_report(
            db=db,
            entity_id=sample_project.id,
            entity_type="project",
            as_of_date=date(2024, 1, 10)
        )
        
        assert report is not None
        assert "status" in report
        assert "budget_status" in report["status"]
        assert "completion_status" in report["status"]
    
    def test_get_time_series_report(self, db, sample_project, sample_actuals):
        """Test time-series report generation."""
        report = reporting_service.get_time_series_report(
            db=db,
            project_id=sample_project.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            interval="daily"
        )
        
        assert report is not None
        assert "time_series" in report
        assert "summary" in report
        assert report["period"]["interval"] == "daily"
    
    def test_get_time_series_report_invalid_interval(self, db, sample_project):
        """Test time-series report with invalid interval."""
        with pytest.raises(ValueError, match="Invalid interval"):
            reporting_service.get_time_series_report(
                db=db,
                project_id=sample_project.id,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 31),
                interval="invalid"
            )
    
    def test_get_drill_down_report(self, db, sample_project, sample_actuals):
        """Test drill-down report generation."""
        report = reporting_service.get_drill_down_report(
            db=db,
            project_id=sample_project.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            group_by="worker"
        )
        
        assert report is not None
        assert "breakdown" in report
        assert "summary" in report
        assert report["group_by"] == "worker"
    
    def test_get_drill_down_report_by_date(self, db, sample_project, sample_actuals):
        """Test drill-down report grouped by date."""
        report = reporting_service.get_drill_down_report(
            db=db,
            project_id=sample_project.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            group_by="date"
        )
        
        assert report is not None
        assert report["group_by"] == "date"
        # Should have 5 dates from the sample actuals
        assert len(report["breakdown"]) == 5
    
    def test_get_drill_down_report_invalid_group_by(self, db, sample_project):
        """Test drill-down report with invalid group_by."""
        with pytest.raises(ValueError, match="Invalid group_by"):
            reporting_service.get_drill_down_report(
                db=db,
                project_id=sample_project.id,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 31),
                group_by="invalid"
            )
