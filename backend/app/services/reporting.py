"""
ReportingService for real-time budget vs actual vs forecast reports with scope-aware filtering.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.project import project_repository, project_phase_repository
from app.repositories.program import program_repository
from app.repositories.actual import actual_repository
from app.services.forecasting import forecasting_service, ForecastData
from app.services.variance_analysis import variance_analysis_service


class ReportingService:
    """Service for generating reports with scope-aware data filtering."""
    
    def __init__(self):
        pass
    
    def get_project_report(
        self,
        db: Session,
        project_id: UUID,
        as_of_date: Optional[date] = None,
        include_variance: bool = True
    ) -> Dict[str, Any]:
        """
        Generate comprehensive report for a single project.
        
        Args:
            db: Database session
            project_id: Project ID
            as_of_date: Date to generate report as of (default: today)
            include_variance: Whether to include variance analysis
            
        Returns:
            Dictionary with complete project report
            
        Raises:
            ValueError: If project not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get project details
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Get forecast data
        forecast_data = forecasting_service.calculate_project_forecast(
            db=db,
            project_id=project_id,
            as_of_date=as_of_date
        )
        
        # Build base report
        report = {
            "project_id": str(project_id),
            "project_name": project.name,
            "program_id": str(project.program_id),
            "cost_center_code": project.cost_center_code,
            "project_manager": project.project_manager,
            "dates": {
                "start_date": project.start_date.isoformat(),
                "end_date": project.end_date.isoformat(),
                "report_date": as_of_date.isoformat()
            },
            "financial_summary": forecast_data.to_dict()
        }
        
        # Add variance analysis if requested
        if include_variance:
            # Calculate variance for the project period up to as_of_date
            variance_summary = variance_analysis_service.get_variance_summary(
                db=db,
                project_id=project_id,
                start_date=project.start_date,
                end_date=as_of_date
            )
            report["variance_analysis"] = variance_summary
        
        return report
    
    def get_program_report(
        self,
        db: Session,
        program_id: UUID,
        as_of_date: Optional[date] = None,
        include_projects: bool = True
    ) -> Dict[str, Any]:
        """
        Generate comprehensive report for a program with aggregated project data.
        
        Args:
            db: Database session
            program_id: Program ID
            as_of_date: Date to generate report as of (default: today)
            include_projects: Whether to include individual project details
            
        Returns:
            Dictionary with complete program report
            
        Raises:
            ValueError: If program not found
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get program details
        program = program_repository.get(db, program_id)
        if not program:
            raise ValueError(f"Program with ID {program_id} does not exist")
        
        # Get aggregated forecast data
        forecast_data = forecasting_service.calculate_program_forecast(
            db=db,
            program_id=program_id,
            as_of_date=as_of_date
        )
        
        # Build base report
        report = {
            "program_id": str(program_id),
            "program_name": program.name,
            "program_manager": program.program_manager,
            "business_sponsor": program.business_sponsor,
            "dates": {
                "start_date": program.start_date.isoformat(),
                "end_date": program.end_date.isoformat(),
                "report_date": as_of_date.isoformat()
            },
            "financial_summary": forecast_data.to_dict()
        }
        
        # Add individual project reports if requested
        if include_projects:
            projects = project_repository.get_by_program(db, program_id)
            project_reports = []
            
            for project in projects:
                try:
                    project_report = self.get_project_report(
                        db=db,
                        project_id=project.id,
                        as_of_date=as_of_date,
                        include_variance=False  # Don't include detailed variance in summary
                    )
                    project_reports.append(project_report)
                except ValueError:
                    # Skip projects that can't be reported
                    continue
            
            report["projects"] = project_reports
            report["projects_count"] = len(project_reports)
        
        return report
    
    def get_multi_project_report(
        self,
        db: Session,
        project_ids: List[UUID],
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generate report for multiple projects with aggregated summary.
        
        Args:
            db: Database session
            project_ids: List of project IDs
            as_of_date: Date to generate report as of (default: today)
            
        Returns:
            Dictionary with multi-project report
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Get individual project reports
        project_reports = []
        
        # Aggregated totals
        total_budget = Decimal('0.00')
        total_capital_budget = Decimal('0.00')
        total_expense_budget = Decimal('0.00')
        total_actual = Decimal('0.00')
        total_capital_actual = Decimal('0.00')
        total_expense_actual = Decimal('0.00')
        total_forecast = Decimal('0.00')
        total_capital_forecast = Decimal('0.00')
        total_expense_forecast = Decimal('0.00')
        
        for project_id in project_ids:
            try:
                project_report = self.get_project_report(
                    db=db,
                    project_id=project_id,
                    as_of_date=as_of_date,
                    include_variance=False
                )
                project_reports.append(project_report)
                
                # Aggregate financial data
                financial = project_report["financial_summary"]
                total_budget += Decimal(str(financial["budget"]["total"]))
                total_capital_budget += Decimal(str(financial["budget"]["capital"]))
                total_expense_budget += Decimal(str(financial["budget"]["expense"]))
                total_actual += Decimal(str(financial["actual"]["total"]))
                total_capital_actual += Decimal(str(financial["actual"]["capital"]))
                total_expense_actual += Decimal(str(financial["actual"]["expense"]))
                total_forecast += Decimal(str(financial["forecast"]["total"]))
                total_capital_forecast += Decimal(str(financial["forecast"]["capital"]))
                total_expense_forecast += Decimal(str(financial["forecast"]["expense"]))
                
            except ValueError:
                # Skip projects that don't exist
                continue
        
        # Calculate aggregated metrics
        budget_utilization = Decimal('0.00')
        if total_budget > Decimal('0.00'):
            budget_utilization = (total_actual / total_budget) * Decimal('100.00')
        
        forecast_to_budget = Decimal('0.00')
        if total_budget > Decimal('0.00'):
            forecast_to_budget = (total_forecast / total_budget) * Decimal('100.00')
        
        return {
            "report_type": "multi_project",
            "report_date": as_of_date.isoformat(),
            "projects_count": len(project_reports),
            "aggregated_summary": {
                "budget": {
                    "total": float(total_budget),
                    "capital": float(total_capital_budget),
                    "expense": float(total_expense_budget)
                },
                "actual": {
                    "total": float(total_actual),
                    "capital": float(total_capital_actual),
                    "expense": float(total_expense_actual)
                },
                "forecast": {
                    "total": float(total_forecast),
                    "capital": float(total_capital_forecast),
                    "expense": float(total_expense_forecast)
                },
                "analysis": {
                    "budget_remaining": float(total_budget - total_actual),
                    "forecast_variance": float(total_forecast - total_budget),
                    "budget_utilization_percentage": float(budget_utilization),
                    "forecast_to_budget_percentage": float(forecast_to_budget)
                }
            },
            "projects": project_reports
        }
    
    def get_variance_report(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date,
        allocation_threshold: Optional[Decimal] = None,
        cost_threshold: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Generate detailed variance analysis report for a project.
        
        Args:
            db: Database session
            project_id: Project ID
            start_date: Start of analysis period
            end_date: End of analysis period
            allocation_threshold: Percentage threshold for allocation variance
            cost_threshold: Percentage threshold for cost variance
            
        Returns:
            Dictionary with variance report
        """
        return variance_analysis_service.get_variance_summary(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
    
    def get_budget_status_report(
        self,
        db: Session,
        entity_id: UUID,
        entity_type: str,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generate budget status report showing budget vs actual vs forecast.
        
        Args:
            db: Database session
            entity_id: Project or Program ID
            entity_type: "project" or "program"
            as_of_date: Date to generate report as of (default: today)
            
        Returns:
            Dictionary with budget status report
            
        Raises:
            ValueError: If entity not found or invalid type
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        if entity_type not in ["project", "program"]:
            raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'project' or 'program'")
        
        # Get forecast data
        forecast_dict = forecasting_service.get_budget_vs_actual_vs_forecast(
            db=db,
            entity_id=entity_id,
            entity_type=entity_type,
            as_of_date=as_of_date
        )
        
        # Add status indicators
        budget = Decimal(str(forecast_dict["budget"]["total"]))
        actual = Decimal(str(forecast_dict["actual"]["total"]))
        forecast = Decimal(str(forecast_dict["forecast"]["total"]))
        
        # Determine budget status
        status = "on_track"
        if forecast > budget * Decimal('1.10'):  # More than 10% over budget
            status = "over_budget"
        elif forecast > budget * Decimal('1.05'):  # 5-10% over budget
            status = "at_risk"
        
        # Determine completion status
        utilization = Decimal(str(forecast_dict["analysis"]["budget_utilization_percentage"]))
        completion_status = "in_progress"
        if utilization >= Decimal('100.00'):
            completion_status = "complete"
        elif utilization >= Decimal('90.00'):
            completion_status = "near_complete"
        
        forecast_dict["status"] = {
            "budget_status": status,
            "completion_status": completion_status,
            "is_over_budget": forecast > budget,
            "is_under_budget": forecast < budget
        }
        
        return forecast_dict
    
    def get_time_series_report(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date,
        interval: str = "monthly"
    ) -> Dict[str, Any]:
        """
        Generate time-series report showing budget vs actual over time.
        
        Args:
            db: Database session
            project_id: Project ID
            start_date: Start of reporting period
            end_date: End of reporting period
            interval: "daily", "weekly", or "monthly"
            
        Returns:
            Dictionary with time-series data
            
        Raises:
            ValueError: If project not found or invalid interval
        """
        if interval not in ["daily", "weekly", "monthly"]:
            raise ValueError(f"Invalid interval: {interval}. Must be 'daily', 'weekly', or 'monthly'")
        
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Get all actuals in the date range
        actuals = actual_repository.get_by_date_range(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Group actuals by interval
        time_series = []
        current_date = start_date
        
        while current_date <= end_date:
            # Determine period end based on interval
            if interval == "daily":
                period_end = current_date
                next_date = current_date + timedelta(days=1)
            elif interval == "weekly":
                period_end = current_date + timedelta(days=6)
                next_date = current_date + timedelta(days=7)
            else:  # monthly
                # Move to end of month
                if current_date.month == 12:
                    period_end = date(current_date.year, 12, 31)
                    next_date = date(current_date.year + 1, 1, 1)
                else:
                    next_month = current_date.month + 1
                    period_end = date(current_date.year, next_month, 1) - timedelta(days=1)
                    next_date = date(current_date.year, next_month, 1)
            
            # Don't go past end_date
            if period_end > end_date:
                period_end = end_date
            
            # Get actuals for this period
            period_actuals = [
                a for a in actuals
                if current_date <= a.actual_date <= period_end
            ]
            
            total_cost = sum(a.actual_cost for a in period_actuals)
            capital_cost = sum(a.capital_amount for a in period_actuals)
            expense_cost = sum(a.expense_amount for a in period_actuals)
            
            time_series.append({
                "period_start": current_date.isoformat(),
                "period_end": period_end.isoformat(),
                "total_cost": float(total_cost),
                "capital_cost": float(capital_cost),
                "expense_cost": float(expense_cost),
                "actuals_count": len(period_actuals)
            })
            
            current_date = next_date
            if current_date > end_date:
                break
        
        # Calculate cumulative totals
        cumulative_total = Decimal('0.00')
        cumulative_capital = Decimal('0.00')
        cumulative_expense = Decimal('0.00')
        
        for period in time_series:
            cumulative_total += Decimal(str(period["total_cost"]))
            cumulative_capital += Decimal(str(period["capital_cost"]))
            cumulative_expense += Decimal(str(period["expense_cost"]))
            
            period["cumulative_total"] = float(cumulative_total)
            period["cumulative_capital"] = float(cumulative_capital)
            period["cumulative_expense"] = float(cumulative_expense)
        
        # Get project budget for comparison
        phases = project_phase_repository.get_by_project(db, project_id)
        total_budget = sum(phase.total_budget for phase in phases)
        
        return {
            "project_id": str(project_id),
            "project_name": project.name,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "interval": interval
            },
            "budget": {
                "total": float(total_budget)
            },
            "summary": {
                "total_actual": float(cumulative_total),
                "total_capital": float(cumulative_capital),
                "total_expense": float(cumulative_expense),
                "budget_utilization": float((cumulative_total / total_budget * 100) if total_budget > 0 else 0)
            },
            "time_series": time_series
        }
    
    def get_drill_down_report(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date,
        group_by: str = "worker"
    ) -> Dict[str, Any]:
        """
        Generate drill-down report with detailed breakdown.
        
        Args:
            db: Database session
            project_id: Project ID
            start_date: Start of reporting period
            end_date: End of reporting period
            group_by: "worker", "date", or "phase"
            
        Returns:
            Dictionary with drill-down data
            
        Raises:
            ValueError: If project not found or invalid group_by
        """
        if group_by not in ["worker", "date", "phase"]:
            raise ValueError(f"Invalid group_by: {group_by}. Must be 'worker', 'date', or 'phase'")
        
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Get actuals in the date range
        actuals = actual_repository.get_by_date_range(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Group data based on group_by parameter
        grouped_data = {}
        
        for actual in actuals:
            if group_by == "worker":
                key = actual.external_worker_id
                name = actual.worker_name
            elif group_by == "date":
                key = actual.actual_date.isoformat()
                name = actual.actual_date.isoformat()
            else:  # phase
                # This would require looking up the phase from resource_assignment
                # For now, use a simplified approach
                key = "execution"
                name = "Execution Phase"
            
            if key not in grouped_data:
                grouped_data[key] = {
                    "key": key,
                    "name": name,
                    "total_cost": Decimal('0.00'),
                    "capital_cost": Decimal('0.00'),
                    "expense_cost": Decimal('0.00'),
                    "total_allocation": Decimal('0.00'),
                    "actuals_count": 0
                }
            
            grouped_data[key]["total_cost"] += actual.actual_cost
            grouped_data[key]["capital_cost"] += actual.capital_amount
            grouped_data[key]["expense_cost"] += actual.expense_amount
            grouped_data[key]["total_allocation"] += actual.allocation_percentage
            grouped_data[key]["actuals_count"] += 1
        
        # Convert to list and format
        breakdown = []
        for key in sorted(grouped_data.keys()):
            item = grouped_data[key]
            breakdown.append({
                "key": item["key"],
                "name": item["name"],
                "total_cost": float(item["total_cost"]),
                "capital_cost": float(item["capital_cost"]),
                "expense_cost": float(item["expense_cost"]),
                "total_allocation": float(item["total_allocation"]),
                "actuals_count": item["actuals_count"]
            })
        
        # Calculate totals
        total_cost = sum(Decimal(str(item["total_cost"])) for item in breakdown)
        total_capital = sum(Decimal(str(item["capital_cost"])) for item in breakdown)
        total_expense = sum(Decimal(str(item["expense_cost"])) for item in breakdown)
        
        return {
            "project_id": str(project_id),
            "project_name": project.name,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "group_by": group_by,
            "summary": {
                "total_cost": float(total_cost),
                "capital_cost": float(total_capital),
                "expense_cost": float(total_expense),
                "groups_count": len(breakdown)
            },
            "breakdown": breakdown
        }


# Create service instance
reporting_service = ReportingService()
