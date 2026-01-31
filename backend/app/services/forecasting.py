"""
ForecastingService for cost projection and budget vs actual vs forecast reporting.
"""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.project import project_repository, project_phase_repository
from app.repositories.program import program_repository
from app.repositories.resource_assignment import resource_assignment_repository
from app.repositories.actual import actual_repository
from app.repositories.resource import worker_repository
from app.repositories.rate import rate_repository


class ForecastData:
    """Represents forecast data for a project or program."""
    
    def __init__(
        self,
        entity_id: UUID,
        entity_name: str,
        entity_type: str,  # "project" or "program"
        total_budget: Decimal,
        capital_budget: Decimal,
        expense_budget: Decimal,
        total_actual: Decimal,
        capital_actual: Decimal,
        expense_actual: Decimal,
        total_forecast: Decimal,
        capital_forecast: Decimal,
        expense_forecast: Decimal
    ):
        self.entity_id = entity_id
        self.entity_name = entity_name
        self.entity_type = entity_type
        self.total_budget = total_budget
        self.capital_budget = capital_budget
        self.expense_budget = expense_budget
        self.total_actual = total_actual
        self.capital_actual = capital_actual
        self.expense_actual = expense_actual
        self.total_forecast = total_forecast
        self.capital_forecast = capital_forecast
        self.expense_forecast = expense_forecast
    
    @property
    def budget_remaining(self) -> Decimal:
        """Calculate remaining budget (budget - actual)."""
        return self.total_budget - self.total_actual
    
    @property
    def forecast_variance(self) -> Decimal:
        """Calculate forecast variance (forecast - budget)."""
        return self.total_forecast - self.total_budget
    
    @property
    def budget_utilization_percentage(self) -> Decimal:
        """Calculate budget utilization percentage."""
        if self.total_budget == Decimal('0.00'):
            return Decimal('0.00')
        return (self.total_actual / self.total_budget) * Decimal('100.00')
    
    @property
    def forecast_to_budget_percentage(self) -> Decimal:
        """Calculate forecast as percentage of budget."""
        if self.total_budget == Decimal('0.00'):
            return Decimal('0.00')
        return (self.total_forecast / self.total_budget) * Decimal('100.00')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert forecast data to dictionary."""
        return {
            "entity_id": str(self.entity_id),
            "entity_name": self.entity_name,
            "entity_type": self.entity_type,
            "budget": {
                "total": float(self.total_budget),
                "capital": float(self.capital_budget),
                "expense": float(self.expense_budget)
            },
            "actual": {
                "total": float(self.total_actual),
                "capital": float(self.capital_actual),
                "expense": float(self.expense_actual)
            },
            "forecast": {
                "total": float(self.total_forecast),
                "capital": float(self.capital_forecast),
                "expense": float(self.expense_forecast)
            },
            "analysis": {
                "budget_remaining": float(self.budget_remaining),
                "forecast_variance": float(self.forecast_variance),
                "budget_utilization_percentage": float(self.budget_utilization_percentage),
                "forecast_to_budget_percentage": float(self.forecast_to_budget_percentage)
            }
        }


class ForecastingService:
    """Service for cost projection and forecasting."""
    
    def __init__(self):
        pass
    
    def calculate_project_forecast(
        self,
        db: Session,
        project_id: UUID,
        as_of_date: Optional[date] = None
    ) -> ForecastData:
        """
        Calculate forecast for a project based on resource assignments and actuals.
        
        Args:
            db: Database session
            project_id: Project ID
            as_of_date: Date to calculate forecast as of (default: today)
            
        Returns:
            ForecastData object with complete forecast information
            
        Raises:
            ValueError: If project not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get project
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Get project phases to calculate total budget
        phases = project_phase_repository.get_by_project(db, project_id)
        total_budget = sum(phase.total_budget for phase in phases)
        capital_budget = sum(phase.capital_budget for phase in phases)
        expense_budget = sum(phase.expense_budget for phase in phases)
        
        # Calculate actuals (historical data up to as_of_date)
        actuals = actual_repository.get_by_date_range(
            db=db,
            project_id=project_id,
            start_date=project.start_date,
            end_date=as_of_date
        )
        
        total_actual = sum(a.actual_cost for a in actuals)
        capital_actual = sum(a.capital_amount for a in actuals)
        expense_actual = sum(a.expense_amount for a in actuals)
        
        # Calculate forecast from resource assignments (future work)
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        
        # Filter assignments for future dates (after as_of_date)
        future_assignments = [a for a in assignments if a.assignment_date > as_of_date]
        
        # Calculate forecast cost from future assignments
        forecast_cost = Decimal('0.00')
        forecast_capital = Decimal('0.00')
        forecast_expense = Decimal('0.00')
        
        for assignment in future_assignments:
            # Get the resource to find worker information
            # Note: This is simplified - in reality, we'd need to handle both
            # labor and non-labor resources differently
            try:
                # Try to get worker rate for cost calculation
                # This assumes the resource is linked to a worker
                # In a full implementation, we'd need to handle non-labor resources
                
                # For now, we'll use a simplified approach:
                # Get rate based on assignment date
                # We need to find the worker associated with this resource
                
                # Simplified: calculate cost based on allocation percentage
                # In reality, we'd look up the worker's rate for that date
                assignment_cost = self._calculate_assignment_cost(
                    db=db,
                    assignment=assignment
                )
                
                if assignment_cost:
                    forecast_cost += assignment_cost
                    
                    # Apply capital/expense split from assignment
                    capital_portion = (assignment_cost * assignment.capital_percentage) / Decimal('100.00')
                    expense_portion = (assignment_cost * assignment.expense_percentage) / Decimal('100.00')
                    
                    forecast_capital += capital_portion
                    forecast_expense += expense_portion
                    
            except Exception:
                # If we can't calculate cost for this assignment, skip it
                continue
        
        # Total forecast = actuals to date + forecast for future
        # Note: We return the future forecast separately, not the total
        # The frontend will calculate current_forecast = actuals + forecast
        
        return ForecastData(
            entity_id=project_id,
            entity_name=project.name,
            entity_type="project",
            total_budget=total_budget,
            capital_budget=capital_budget,
            expense_budget=expense_budget,
            total_actual=total_actual,
            capital_actual=capital_actual,
            expense_actual=expense_actual,
            total_forecast=forecast_cost,  # Return only future forecast, not total
            capital_forecast=forecast_capital,
            expense_forecast=forecast_expense
        )
    
    def _calculate_assignment_cost(
        self,
        db: Session,
        assignment: Any
    ) -> Optional[Decimal]:
        """
        Calculate cost for a resource assignment.
        
        Args:
            db: Database session
            assignment: ResourceAssignment object
            
        Returns:
            Calculated cost or None if cannot be calculated
        """
        try:
            # Get the resource
            from app.repositories.resource import resource_repository
            resource = resource_repository.get(db, assignment.resource_id)
            
            if not resource:
                return None
            
            # For labor resources, try to get actual worker rate
            # Check if this is a labor resource (has worker_id)
            if hasattr(resource, 'worker_id') and resource.worker_id:
                # Get the worker
                worker = worker_repository.get(db, resource.worker_id)
                if worker:
                    # Get the rate for the assignment date
                    rate = rate_repository.get_active_rate(
                        db=db,
                        worker_type_id=worker.worker_type_id,
                        as_of_date=assignment.assignment_date
                    )
                    
                    if rate:
                        # Calculate cost: daily_rate * allocation_percentage / 100
                        cost = (rate.rate_amount * assignment.allocation_percentage) / Decimal('100.00')
                        return cost.quantize(Decimal('0.01'))
            
            # If we can't determine exact rate, use a default daily rate
            # This ensures forecast calculations work even without worker linkage
            # Default: $1000/day for labor resources, $500/day for non-labor
            if resource.resource_type.value == 'labor':
                default_rate = Decimal('1000.00')
            else:
                default_rate = Decimal('500.00')
            
            cost = (default_rate * assignment.allocation_percentage) / Decimal('100.00')
            return cost.quantize(Decimal('0.01'))
            
        except Exception as e:
            # If anything fails, use a conservative default
            default_rate = Decimal('1000.00')
            cost = (default_rate * assignment.allocation_percentage) / Decimal('100.00')
            return cost.quantize(Decimal('0.01'))
    
    def calculate_program_forecast(
        self,
        db: Session,
        program_id: UUID,
        as_of_date: Optional[date] = None
    ) -> ForecastData:
        """
        Calculate aggregated forecast for a program (all its projects).
        
        Args:
            db: Database session
            program_id: Program ID
            as_of_date: Date to calculate forecast as of (default: today)
            
        Returns:
            ForecastData object with aggregated forecast information
            
        Raises:
            ValueError: If program not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get program
        program = program_repository.get(db, program_id)
        if not program:
            raise ValueError(f"Program with ID {program_id} does not exist")
        
        # Get all projects in the program
        projects = project_repository.get_by_program(db, program_id)
        
        # Aggregate forecasts from all projects
        total_budget = Decimal('0.00')
        capital_budget = Decimal('0.00')
        expense_budget = Decimal('0.00')
        total_actual = Decimal('0.00')
        capital_actual = Decimal('0.00')
        expense_actual = Decimal('0.00')
        total_forecast = Decimal('0.00')
        capital_forecast = Decimal('0.00')
        expense_forecast = Decimal('0.00')
        
        for project in projects:
            project_forecast = self.calculate_project_forecast(
                db=db,
                project_id=project.id,
                as_of_date=as_of_date
            )
            
            total_budget += project_forecast.total_budget
            capital_budget += project_forecast.capital_budget
            expense_budget += project_forecast.expense_budget
            total_actual += project_forecast.total_actual
            capital_actual += project_forecast.capital_actual
            expense_actual += project_forecast.expense_actual
            total_forecast += project_forecast.total_forecast
            capital_forecast += project_forecast.capital_forecast
            expense_forecast += project_forecast.expense_forecast
        
        return ForecastData(
            entity_id=program_id,
            entity_name=program.name,
            entity_type="program",
            total_budget=total_budget,
            capital_budget=capital_budget,
            expense_budget=expense_budget,
            total_actual=total_actual,
            capital_actual=capital_actual,
            expense_actual=expense_actual,
            total_forecast=total_forecast,
            capital_forecast=capital_forecast,
            expense_forecast=expense_forecast
        )
    
    def get_budget_vs_actual_vs_forecast(
        self,
        db: Session,
        entity_id: UUID,
        entity_type: str,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive budget vs actual vs forecast report.
        
        Args:
            db: Database session
            entity_id: Project or Program ID
            entity_type: "project" or "program"
            as_of_date: Date to calculate as of (default: today)
            
        Returns:
            Dictionary with complete budget vs actual vs forecast data
            
        Raises:
            ValueError: If entity not found or invalid type
        """
        if entity_type not in ["project", "program"]:
            raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'project' or 'program'")
        
        if entity_type == "project":
            forecast_data = self.calculate_project_forecast(db, entity_id, as_of_date)
        else:
            forecast_data = self.calculate_program_forecast(db, entity_id, as_of_date)
        
        return forecast_data.to_dict()
    
    def get_projects_forecast_summary(
        self,
        db: Session,
        project_ids: List[UUID],
        as_of_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get forecast summary for multiple projects.
        
        Args:
            db: Database session
            project_ids: List of project IDs
            as_of_date: Date to calculate as of (default: today)
            
        Returns:
            List of forecast data dictionaries
        """
        forecasts = []
        for project_id in project_ids:
            try:
                forecast = self.calculate_project_forecast(db, project_id, as_of_date)
                forecasts.append(forecast.to_dict())
            except ValueError:
                # Skip projects that don't exist
                continue
        
        return forecasts
    
    def calculate_cost_projection(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Calculate detailed cost projection for a project over a date range.
        
        Args:
            db: Database session
            project_id: Project ID
            start_date: Start of projection period
            end_date: End of projection period
            
        Returns:
            Dictionary with detailed cost projection by date
        """
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Get assignments in the date range
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        assignments_in_range = [
            a for a in assignments
            if start_date <= a.assignment_date <= end_date
        ]
        
        # Group by date
        projections_by_date = {}
        
        for assignment in assignments_in_range:
            assignment_date = assignment.assignment_date
            
            if assignment_date not in projections_by_date:
                projections_by_date[assignment_date] = {
                    "date": assignment_date.isoformat(),
                    "total_cost": Decimal('0.00'),
                    "capital_cost": Decimal('0.00'),
                    "expense_cost": Decimal('0.00'),
                    "assignments_count": 0
                }
            
            # Calculate cost for this assignment
            cost = self._calculate_assignment_cost(db, assignment)
            
            if cost:
                capital_portion = (cost * assignment.capital_percentage) / Decimal('100.00')
                expense_portion = (cost * assignment.expense_percentage) / Decimal('100.00')
                
                projections_by_date[assignment_date]["total_cost"] += cost
                projections_by_date[assignment_date]["capital_cost"] += capital_portion
                projections_by_date[assignment_date]["expense_cost"] += expense_portion
                projections_by_date[assignment_date]["assignments_count"] += 1
        
        # Convert to list and format
        projections = []
        for date_key in sorted(projections_by_date.keys()):
            projection = projections_by_date[date_key]
            projections.append({
                "date": projection["date"],
                "total_cost": float(projection["total_cost"]),
                "capital_cost": float(projection["capital_cost"]),
                "expense_cost": float(projection["expense_cost"]),
                "assignments_count": projection["assignments_count"]
            })
        
        # Calculate totals
        total_cost = sum(p["total_cost"] for p in projections)
        total_capital = sum(p["capital_cost"] for p in projections)
        total_expense = sum(p["expense_cost"] for p in projections)
        
        return {
            "project_id": str(project_id),
            "project_name": project.name,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_cost": total_cost,
                "capital_cost": total_capital,
                "expense_cost": total_expense,
                "days_count": len(projections)
            },
            "daily_projections": projections
        }


# Create service instance
forecasting_service = ForecastingService()
