"""
ForecastingService for cost projection and budget vs actual vs forecast reporting.
"""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resource import ResourceType
from app.models.nonlabor_plan import (
    NonLaborCostTreatment,
    NonLaborPlanLine,
    NonLaborPlanOccurrence,
    NonLaborPlanStatus,
)
from app.repositories.project import project_repository, project_phase_repository
from app.repositories.program import program_repository
from app.repositories.portfolio import portfolio_repository
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
        expense_forecast: Decimal,
        # Four-way labor/non-labor breakdown (portfolio-extensibility requirement:
        # these accumulate generically across the Portfolio -> Program -> Project
        # hierarchy; keyword-only with defaults so existing call sites don't break).
        budget_labor_capital: Decimal = Decimal('0.00'),
        budget_labor_expense: Decimal = Decimal('0.00'),
        budget_nonlabor_capital: Decimal = Decimal('0.00'),
        budget_nonlabor_expense: Decimal = Decimal('0.00'),
        actual_labor_capital: Decimal = Decimal('0.00'),
        actual_labor_expense: Decimal = Decimal('0.00'),
        actual_nonlabor_capital: Decimal = Decimal('0.00'),
        actual_nonlabor_expense: Decimal = Decimal('0.00'),
        forecast_labor_capital: Decimal = Decimal('0.00'),
        forecast_labor_expense: Decimal = Decimal('0.00'),
        forecast_nonlabor_capital: Decimal = Decimal('0.00'),
        forecast_nonlabor_expense: Decimal = Decimal('0.00')
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
        self.budget_labor_capital = budget_labor_capital
        self.budget_labor_expense = budget_labor_expense
        self.budget_nonlabor_capital = budget_nonlabor_capital
        self.budget_nonlabor_expense = budget_nonlabor_expense
        self.actual_labor_capital = actual_labor_capital
        self.actual_labor_expense = actual_labor_expense
        self.actual_nonlabor_capital = actual_nonlabor_capital
        self.actual_nonlabor_expense = actual_nonlabor_expense
        self.forecast_labor_capital = forecast_labor_capital
        self.forecast_labor_expense = forecast_labor_expense
        self.forecast_nonlabor_capital = forecast_nonlabor_capital
        self.forecast_nonlabor_expense = forecast_nonlabor_expense
    
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
        """Convert forecast data to dictionary.

        Derived capital/expense per series are computed from the four-way
        values for internal consistency; "total" remains whatever was stored.
        Legacy-caller fallback: if all four-way keys are zero (indicating a
        construction with only the original 9 params), emit the stored
        capital/expense so old-style callers keep their values.
        """
        # Budget series: derive capital/expense, fall back to legacy params if four-way is entirely zero
        derived_budget_capital = self.budget_labor_capital + self.budget_nonlabor_capital
        derived_budget_expense = self.budget_labor_expense + self.budget_nonlabor_expense
        if derived_budget_capital == Decimal('0.00') and derived_budget_expense == Decimal('0.00'):
            budget_capital = self.capital_budget
            budget_expense = self.expense_budget
        else:
            budget_capital = derived_budget_capital
            budget_expense = derived_budget_expense

        # Actual series: derive capital/expense, fall back to legacy params if four-way is entirely zero
        derived_actual_capital = self.actual_labor_capital + self.actual_nonlabor_capital
        derived_actual_expense = self.actual_labor_expense + self.actual_nonlabor_expense
        if derived_actual_capital == Decimal('0.00') and derived_actual_expense == Decimal('0.00'):
            actual_capital = self.capital_actual
            actual_expense = self.expense_actual
        else:
            actual_capital = derived_actual_capital
            actual_expense = derived_actual_expense

        # Forecast series: derive capital/expense, fall back to legacy params if four-way is entirely zero
        derived_forecast_capital = self.forecast_labor_capital + self.forecast_nonlabor_capital
        derived_forecast_expense = self.forecast_labor_expense + self.forecast_nonlabor_expense
        if derived_forecast_capital == Decimal('0.00') and derived_forecast_expense == Decimal('0.00'):
            forecast_capital = self.capital_forecast
            forecast_expense = self.expense_forecast
        else:
            forecast_capital = derived_forecast_capital
            forecast_expense = derived_forecast_expense
        return {
            "entity_id": str(self.entity_id),
            "entity_name": self.entity_name,
            "entity_type": self.entity_type,
            "budget": {
                "total": float(self.total_budget),
                "capital": float(budget_capital),
                "expense": float(budget_expense),
                "labor_capital": float(self.budget_labor_capital),
                "labor_expense": float(self.budget_labor_expense),
                "nonlabor_capital": float(self.budget_nonlabor_capital),
                "nonlabor_expense": float(self.budget_nonlabor_expense)
            },
            "actual": {
                "total": float(self.total_actual),
                "capital": float(actual_capital),
                "expense": float(actual_expense),
                "labor_capital": float(self.actual_labor_capital),
                "labor_expense": float(self.actual_labor_expense),
                "nonlabor_capital": float(self.actual_nonlabor_capital),
                "nonlabor_expense": float(self.actual_nonlabor_expense)
            },
            "forecast": {
                "total": float(self.total_forecast),
                "capital": float(forecast_capital),
                "expense": float(forecast_expense),
                "labor_capital": float(self.forecast_labor_capital),
                "labor_expense": float(self.forecast_labor_expense),
                "nonlabor_capital": float(self.forecast_nonlabor_capital),
                "nonlabor_expense": float(self.forecast_nonlabor_expense)
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
        as_of_date: Optional[date] = None,
        phase_id: Optional[UUID] = None
    ) -> ForecastData:
        """
        Calculate forecast for a project based on resource assignments and actuals.
        
        Args:
            db: Database session
            project_id: Project ID
            as_of_date: Date to calculate forecast as of (default: today)
            phase_id: Optional phase ID to filter by specific phase
            
        Returns:
            ForecastData object with complete forecast information
            
        Raises:
            ValueError: If project or phase not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get project
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Determine date range for filtering
        phase_start_date = None
        phase_end_date = None
        
        if phase_id:
            # Get specific phase
            phase = project_phase_repository.get(db, phase_id)
            if not phase:
                raise ValueError(f"Phase with ID {phase_id} does not exist")
            if phase.project_id != project_id:
                raise ValueError(f"Phase {phase_id} does not belong to project {project_id}")
            
            phase_start_date = phase.start_date
            phase_end_date = phase.end_date

            # Calculate budget from single phase
            total_budget = phase.total_budget
            capital_budget = phase.capital_budget
            expense_budget = phase.expense_budget
            budget_labor_capital = phase.labor_capital_budget
            budget_labor_expense = phase.labor_expense_budget
            budget_nonlabor_capital = phase.nonlabor_capital_budget
            budget_nonlabor_expense = phase.nonlabor_expense_budget
        else:
            # Get all project phases to calculate total budget
            phases = project_phase_repository.get_by_project(db, project_id)
            total_budget = sum(phase.total_budget for phase in phases)
            capital_budget = sum(phase.capital_budget for phase in phases)
            expense_budget = sum(phase.expense_budget for phase in phases)
            budget_labor_capital = sum(phase.labor_capital_budget for phase in phases)
            budget_labor_expense = sum(phase.labor_expense_budget for phase in phases)
            budget_nonlabor_capital = sum(phase.nonlabor_capital_budget for phase in phases)
            budget_nonlabor_expense = sum(phase.nonlabor_expense_budget for phase in phases)
        
        # Calculate actuals (historical data up to as_of_date)
        # Filter by phase date range if phase_id is provided
        actuals_start_date = phase_start_date if phase_start_date else project.start_date
        actuals_end_date = min(phase_end_date, as_of_date) if phase_end_date else as_of_date
        
        actuals = actual_repository.get_by_date_range(
            db=db,
            project_id=project_id,
            start_date=actuals_start_date,
            end_date=actuals_end_date,
            eager_resource=True
        )

        total_actual = sum(a.actual_cost for a in actuals)
        capital_actual = sum(a.capital_amount for a in actuals)
        expense_actual = sum(a.expense_amount for a in actuals)

        # Route each actual's capital/expense amounts into labor/non-labor
        # buckets by its resource's resource_type (the only classifier).
        actual_labor_capital = Decimal('0.00')
        actual_labor_expense = Decimal('0.00')
        actual_nonlabor_capital = Decimal('0.00')
        actual_nonlabor_expense = Decimal('0.00')
        actual_nonlabor_by_resource_treatment = {}
        for a in actuals:
            if a.resource and a.resource.resource_type == ResourceType.LABOR:
                actual_labor_capital += a.capital_amount
                actual_labor_expense += a.expense_amount
            else:
                actual_nonlabor_capital += a.capital_amount
                actual_nonlabor_expense += a.expense_amount
                if a.resource:
                    capital_key = (
                        a.resource_id,
                        NonLaborCostTreatment.CAPITAL,
                    )
                    expense_key = (
                        a.resource_id,
                        NonLaborCostTreatment.EXPENSE,
                    )
                    actual_nonlabor_by_resource_treatment[capital_key] = (
                        actual_nonlabor_by_resource_treatment.get(
                            capital_key, Decimal("0")
                        )
                        + a.capital_amount
                    )
                    actual_nonlabor_by_resource_treatment[expense_key] = (
                        actual_nonlabor_by_resource_treatment.get(
                            expense_key, Decimal("0")
                        )
                        + a.expense_amount
                    )
        
        # Calculate forecast from resource assignments (future work)
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        
        # Filter assignments for future dates (after as_of_date)
        # Also filter by phase date range if phase_id is provided
        if phase_id:
            future_assignments = [
                a for a in assignments 
                if a.assignment_date > as_of_date 
                and phase_start_date <= a.assignment_date <= phase_end_date
            ]
        else:
            future_assignments = [a for a in assignments if a.assignment_date > as_of_date]
        
        # Calculate forecast cost from future assignments
        forecast_cost = Decimal('0.00')
        forecast_capital = Decimal('0.00')
        forecast_expense = Decimal('0.00')
        forecast_labor_capital = Decimal('0.00')
        forecast_labor_expense = Decimal('0.00')
        forecast_nonlabor_capital = Decimal('0.00')
        forecast_nonlabor_expense = Decimal('0.00')

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
                result = self._calculate_assignment_cost(
                    db=db,
                    assignment=assignment
                )

                if result:
                    assignment_cost, resource_type = result
                    # Percentage assignments are the labor forecast source.
                    # Non-labor forecasts are sourced from exact plan
                    # occurrences below.
                    if resource_type != ResourceType.LABOR:
                        continue
                    forecast_cost += assignment_cost

                    # Apply capital/expense split from assignment
                    capital_portion = (assignment_cost * assignment.capital_percentage) / Decimal('100.00')
                    expense_portion = (assignment_cost * assignment.expense_percentage) / Decimal('100.00')

                    forecast_capital += capital_portion
                    forecast_expense += expense_portion

                    forecast_labor_capital += capital_portion
                    forecast_labor_expense += expense_portion

            except Exception:
                # If we can't calculate cost for this assignment, skip it
                continue

        # Exact non-labor cash forecast occurrences. Future values are always
        # forecast. Past-due values remain forecast until actuals for the same
        # resource and treatment consume them; this keeps an unactualized cost
        # plan from silently disappearing after its scheduled date.
        occurrence_query = (
            db.query(NonLaborPlanOccurrence, NonLaborPlanLine)
            .join(
                NonLaborPlanLine,
                NonLaborPlanOccurrence.plan_line_id == NonLaborPlanLine.id,
            )
            .filter(
                NonLaborPlanLine.project_id == project_id,
                NonLaborPlanLine.status == NonLaborPlanStatus.ACTIVE,
            )
        )
        if phase_id:
            occurrence_query = occurrence_query.filter(
                NonLaborPlanOccurrence.occurrence_date >= phase_start_date,
                NonLaborPlanOccurrence.occurrence_date <= phase_end_date,
            )

        future_nonlabor = {}
        overdue_nonlabor = {}
        for occurrence, plan_line in occurrence_query.all():
            key = (plan_line.resource_id, plan_line.cost_treatment)
            bucket = (
                future_nonlabor
                if occurrence.occurrence_date > as_of_date
                else overdue_nonlabor
            )
            bucket[key] = (
                bucket.get(key, Decimal("0"))
                + occurrence.effective_amount
            )

        all_nonlabor_keys = set(future_nonlabor) | set(overdue_nonlabor)
        for key in all_nonlabor_keys:
            future_amount = future_nonlabor.get(key, Decimal("0"))
            overdue_amount = overdue_nonlabor.get(key, Decimal("0"))
            actual_amount = actual_nonlabor_by_resource_treatment.get(
                key, Decimal("0")
            )
            amount = future_amount + max(
                overdue_amount - actual_amount,
                Decimal("0"),
            )
            forecast_cost += amount
            if key[1] == NonLaborCostTreatment.CAPITAL:
                forecast_capital += amount
                forecast_nonlabor_capital += amount
            else:
                forecast_expense += amount
                forecast_nonlabor_expense += amount

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
            expense_forecast=forecast_expense,
            budget_labor_capital=budget_labor_capital,
            budget_labor_expense=budget_labor_expense,
            budget_nonlabor_capital=budget_nonlabor_capital,
            budget_nonlabor_expense=budget_nonlabor_expense,
            actual_labor_capital=actual_labor_capital,
            actual_labor_expense=actual_labor_expense,
            actual_nonlabor_capital=actual_nonlabor_capital,
            actual_nonlabor_expense=actual_nonlabor_expense,
            forecast_labor_capital=forecast_labor_capital,
            forecast_labor_expense=forecast_labor_expense,
            forecast_nonlabor_capital=forecast_nonlabor_capital,
            forecast_nonlabor_expense=forecast_nonlabor_expense
        )
    
    def _calculate_assignment_cost(
        self,
        db: Session,
        assignment: Any
    ) -> Optional[tuple]:
        """
        Calculate cost for a resource assignment.

        Args:
            db: Database session
            assignment: ResourceAssignment object

        Returns:
            Tuple of (calculated cost, resource_type) or None if cannot be calculated
        """
        try:
            # Get the resource
            from app.repositories.resource import resource_repository
            resource = resource_repository.get(db, assignment.resource_id)

            if not resource:
                return None

            # For labor resources, try to get actual worker rate via FK
            if resource.resource_type == ResourceType.LABOR and resource.worker_id:
                worker = worker_repository.get(db, resource.worker_id)

                if worker:
                    # Get the rate for the assignment date
                    rate = rate_repository.get_active_rate(
                        db=db,
                        worker_type_id=worker.worker_type_id,
                        as_of_date=assignment.assignment_date
                    )

                    if rate:
                        # Calculate total allocation from capital + expense percentages
                        total_allocation = assignment.capital_percentage + assignment.expense_percentage
                        # Calculate cost: daily_rate * total_allocation / 100
                        cost = (rate.rate_amount * total_allocation) / Decimal('100.00')
                        return (cost.quantize(Decimal('0.01')), resource.resource_type)

            # If we can't determine exact rate, use a default daily rate
            # This ensures forecast calculations work even without worker linkage
            # Default: $1000/day for labor resources, $500/day for non-labor
            if resource.resource_type == ResourceType.LABOR:
                default_rate = Decimal('1000.00')
            else:
                default_rate = Decimal('500.00')

            # Calculate total allocation from capital + expense percentages
            total_allocation = assignment.capital_percentage + assignment.expense_percentage
            cost = (default_rate * total_allocation) / Decimal('100.00')
            return (cost.quantize(Decimal('0.01')), resource.resource_type)

        except Exception as e:
            # If anything fails, use a conservative default. We don't know the
            # resource's type on this path (resource lookup itself may have
            # failed), so default to LABOR since $1000/day is the labor default.
            default_rate = Decimal('1000.00')
            # Calculate total allocation from capital + expense percentages
            total_allocation = assignment.capital_percentage + assignment.expense_percentage
            cost = (default_rate * total_allocation) / Decimal('100.00')
            return (cost.quantize(Decimal('0.01')), ResourceType.LABOR)
    
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
        
        # Aggregate forecasts from all projects.
        #
        # Portfolio-extensibility: this is a generic per-series summation over
        # a list of child ForecastData objects. A future calculate_portfolio_forecast
        # can reuse this exact pattern by looping `portfolio.programs` and summing
        # each program's ForecastData the same way - no two-level assumption here.
        total_budget = Decimal('0.00')
        capital_budget = Decimal('0.00')
        expense_budget = Decimal('0.00')
        total_actual = Decimal('0.00')
        capital_actual = Decimal('0.00')
        expense_actual = Decimal('0.00')
        total_forecast = Decimal('0.00')
        capital_forecast = Decimal('0.00')
        expense_forecast = Decimal('0.00')
        budget_labor_capital = Decimal('0.00')
        budget_labor_expense = Decimal('0.00')
        budget_nonlabor_capital = Decimal('0.00')
        budget_nonlabor_expense = Decimal('0.00')
        actual_labor_capital = Decimal('0.00')
        actual_labor_expense = Decimal('0.00')
        actual_nonlabor_capital = Decimal('0.00')
        actual_nonlabor_expense = Decimal('0.00')
        forecast_labor_capital = Decimal('0.00')
        forecast_labor_expense = Decimal('0.00')
        forecast_nonlabor_capital = Decimal('0.00')
        forecast_nonlabor_expense = Decimal('0.00')

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
            budget_labor_capital += project_forecast.budget_labor_capital
            budget_labor_expense += project_forecast.budget_labor_expense
            budget_nonlabor_capital += project_forecast.budget_nonlabor_capital
            budget_nonlabor_expense += project_forecast.budget_nonlabor_expense
            actual_labor_capital += project_forecast.actual_labor_capital
            actual_labor_expense += project_forecast.actual_labor_expense
            actual_nonlabor_capital += project_forecast.actual_nonlabor_capital
            actual_nonlabor_expense += project_forecast.actual_nonlabor_expense
            forecast_labor_capital += project_forecast.forecast_labor_capital
            forecast_labor_expense += project_forecast.forecast_labor_expense
            forecast_nonlabor_capital += project_forecast.forecast_nonlabor_capital
            forecast_nonlabor_expense += project_forecast.forecast_nonlabor_expense

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
            expense_forecast=expense_forecast,
            budget_labor_capital=budget_labor_capital,
            budget_labor_expense=budget_labor_expense,
            budget_nonlabor_capital=budget_nonlabor_capital,
            budget_nonlabor_expense=budget_nonlabor_expense,
            actual_labor_capital=actual_labor_capital,
            actual_labor_expense=actual_labor_expense,
            actual_nonlabor_capital=actual_nonlabor_capital,
            actual_nonlabor_expense=actual_nonlabor_expense,
            forecast_labor_capital=forecast_labor_capital,
            forecast_labor_expense=forecast_labor_expense,
            forecast_nonlabor_capital=forecast_nonlabor_capital,
            forecast_nonlabor_expense=forecast_nonlabor_expense
        )

    def calculate_portfolio_forecast(
        self,
        db: Session,
        portfolio_id: UUID,
        as_of_date: Optional[date] = None
    ) -> ForecastData:
        """
        Calculate aggregated forecast for a portfolio (all its programs).

        Sums each program's ForecastData using the same per-series accumulation
        as calculate_program_forecast (which sums its projects) — a generic
        summation over child ForecastData objects.

        Raises:
            ValueError: If portfolio not found
        """
        if as_of_date is None:
            as_of_date = date.today()

        portfolio = portfolio_repository.get(db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio with ID {portfolio_id} does not exist")

        total_budget = Decimal('0.00')
        capital_budget = Decimal('0.00')
        expense_budget = Decimal('0.00')
        total_actual = Decimal('0.00')
        capital_actual = Decimal('0.00')
        expense_actual = Decimal('0.00')
        total_forecast = Decimal('0.00')
        capital_forecast = Decimal('0.00')
        expense_forecast = Decimal('0.00')
        budget_labor_capital = Decimal('0.00')
        budget_labor_expense = Decimal('0.00')
        budget_nonlabor_capital = Decimal('0.00')
        budget_nonlabor_expense = Decimal('0.00')
        actual_labor_capital = Decimal('0.00')
        actual_labor_expense = Decimal('0.00')
        actual_nonlabor_capital = Decimal('0.00')
        actual_nonlabor_expense = Decimal('0.00')
        forecast_labor_capital = Decimal('0.00')
        forecast_labor_expense = Decimal('0.00')
        forecast_nonlabor_capital = Decimal('0.00')
        forecast_nonlabor_expense = Decimal('0.00')

        for program in (portfolio.programs or []):
            pf = self.calculate_program_forecast(
                db=db,
                program_id=program.id,
                as_of_date=as_of_date
            )
            total_budget += pf.total_budget
            capital_budget += pf.capital_budget
            expense_budget += pf.expense_budget
            total_actual += pf.total_actual
            capital_actual += pf.capital_actual
            expense_actual += pf.expense_actual
            total_forecast += pf.total_forecast
            capital_forecast += pf.capital_forecast
            expense_forecast += pf.expense_forecast
            budget_labor_capital += pf.budget_labor_capital
            budget_labor_expense += pf.budget_labor_expense
            budget_nonlabor_capital += pf.budget_nonlabor_capital
            budget_nonlabor_expense += pf.budget_nonlabor_expense
            actual_labor_capital += pf.actual_labor_capital
            actual_labor_expense += pf.actual_labor_expense
            actual_nonlabor_capital += pf.actual_nonlabor_capital
            actual_nonlabor_expense += pf.actual_nonlabor_expense
            forecast_labor_capital += pf.forecast_labor_capital
            forecast_labor_expense += pf.forecast_labor_expense
            forecast_nonlabor_capital += pf.forecast_nonlabor_capital
            forecast_nonlabor_expense += pf.forecast_nonlabor_expense

        return ForecastData(
            entity_id=portfolio_id,
            entity_name=portfolio.name,
            entity_type="portfolio",
            total_budget=total_budget,
            capital_budget=capital_budget,
            expense_budget=expense_budget,
            total_actual=total_actual,
            capital_actual=capital_actual,
            expense_actual=expense_actual,
            total_forecast=total_forecast,
            capital_forecast=capital_forecast,
            expense_forecast=expense_forecast,
            budget_labor_capital=budget_labor_capital,
            budget_labor_expense=budget_labor_expense,
            budget_nonlabor_capital=budget_nonlabor_capital,
            budget_nonlabor_expense=budget_nonlabor_expense,
            actual_labor_capital=actual_labor_capital,
            actual_labor_expense=actual_labor_expense,
            actual_nonlabor_capital=actual_nonlabor_capital,
            actual_nonlabor_expense=actual_nonlabor_expense,
            forecast_labor_capital=forecast_labor_capital,
            forecast_labor_expense=forecast_labor_expense,
            forecast_nonlabor_capital=forecast_nonlabor_capital,
            forecast_nonlabor_expense=forecast_nonlabor_expense,
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
            result = self._calculate_assignment_cost(db, assignment)
            cost, _resource_type = result if result else (None, None)

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
    
    def calculate_phase_cost(
        self,
        db: Session,
        phase_id: UUID,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate actual cost for a phase based on assignments within its date range.
        
        Args:
            db: Database session
            phase_id: Phase ID
            as_of_date: Date to calculate cost as of (default: today)
            
        Returns:
            Dictionary with phase cost information
            
        Raises:
            ValueError: If phase not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get phase
        phase = project_phase_repository.get(db, phase_id)
        if not phase:
            raise ValueError(f"Phase with ID {phase_id} does not exist")
        
        # Get actuals for the phase date range up to as_of_date
        end_date = min(phase.end_date, as_of_date)
        
        actuals = actual_repository.get_by_date_range(
            db=db,
            project_id=phase.project_id,
            start_date=phase.start_date,
            end_date=end_date
        )
        
        # Calculate totals
        total_actual = sum(a.actual_cost for a in actuals)
        capital_actual = sum(a.capital_amount for a in actuals)
        expense_actual = sum(a.expense_amount for a in actuals)
        
        return {
            "phase_id": str(phase_id),
            "phase_name": phase.name,
            "date_range": {
                "start_date": phase.start_date.isoformat(),
                "end_date": phase.end_date.isoformat()
            },
            "budget": {
                "total": float(phase.total_budget),
                "capital": float(phase.capital_budget),
                "expense": float(phase.expense_budget)
            },
            "actual": {
                "total": float(total_actual),
                "capital": float(capital_actual),
                "expense": float(expense_actual)
            },
            "variance": {
                "total": float(phase.total_budget - total_actual),
                "capital": float(phase.capital_budget - capital_actual),
                "expense": float(phase.expense_budget - expense_actual)
            }
        }
    
    def calculate_phase_forecast(
        self,
        db: Session,
        phase_id: UUID,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate forecast cost for a phase based on future assignments within its date range.
        
        Args:
            db: Database session
            phase_id: Phase ID
            as_of_date: Date to calculate forecast from (default: today)
            
        Returns:
            Dictionary with phase forecast information
            
        Raises:
            ValueError: If phase not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get phase
        phase = project_phase_repository.get(db, phase_id)
        if not phase:
            raise ValueError(f"Phase with ID {phase_id} does not exist")
        
        # Get assignments for the phase date range
        assignments = resource_assignment_repository.get_by_project(db, phase.project_id)
        
        # Filter assignments that fall within phase date range and are after as_of_date
        future_assignments = [
            a for a in assignments
            if phase.start_date <= a.assignment_date <= phase.end_date
            and a.assignment_date > as_of_date
        ]
        
        # Calculate forecast cost from future assignments
        forecast_cost = Decimal('0.00')
        forecast_capital = Decimal('0.00')
        forecast_expense = Decimal('0.00')
        
        for assignment in future_assignments:
            result = self._calculate_assignment_cost(db, assignment)
            assignment_cost, _resource_type = result if result else (None, None)

            if assignment_cost:
                forecast_cost += assignment_cost
                
                # Apply capital/expense split from assignment
                capital_portion = (assignment_cost * assignment.capital_percentage) / Decimal('100.00')
                expense_portion = (assignment_cost * assignment.expense_percentage) / Decimal('100.00')
                
                forecast_capital += capital_portion
                forecast_expense += expense_portion
        
        return {
            "phase_id": str(phase_id),
            "phase_name": phase.name,
            "date_range": {
                "start_date": phase.start_date.isoformat(),
                "end_date": phase.end_date.isoformat()
            },
            "budget": {
                "total": float(phase.total_budget),
                "capital": float(phase.capital_budget),
                "expense": float(phase.expense_budget)
            },
            "forecast": {
                "total": float(forecast_cost),
                "capital": float(forecast_capital),
                "expense": float(forecast_expense)
            },
            "forecast_variance": {
                "total": float(forecast_cost - phase.total_budget),
                "capital": float(forecast_capital - phase.capital_budget),
                "expense": float(forecast_expense - phase.expense_budget)
            }
        }


# Create service instance
forecasting_service = ForecastingService()
