"""
VarianceAnalysisService for comparing actual vs forecast allocations and costs.
"""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.actual import actual_repository
from app.repositories.resource_assignment import resource_assignment_repository
from app.repositories.project import project_repository


class VarianceType:
    """Types of variances that can be detected."""
    ALLOCATION_OVER = "allocation_over"  # Actual > Forecast
    ALLOCATION_UNDER = "allocation_under"  # Actual < Forecast
    COST_OVER = "cost_over"  # Actual cost > Forecast cost
    COST_UNDER = "cost_under"  # Actual cost < Forecast cost
    UNPLANNED_WORK = "unplanned_work"  # Actual exists but no forecast
    UNWORKED_ASSIGNMENT = "unworked_assignment"  # Forecast exists but no actual


class VarianceRecord:
    """Represents a variance between actual and forecast."""
    
    def __init__(
        self,
        variance_type: str,
        project_id: UUID,
        project_name: str,
        worker_id: str,
        worker_name: str,
        variance_date: date,
        forecast_allocation: Decimal,
        actual_allocation: Decimal,
        forecast_cost: Optional[Decimal] = None,
        actual_cost: Optional[Decimal] = None
    ):
        self.variance_type = variance_type
        self.project_id = project_id
        self.project_name = project_name
        self.worker_id = worker_id
        self.worker_name = worker_name
        self.variance_date = variance_date
        self.forecast_allocation = forecast_allocation
        self.actual_allocation = actual_allocation
        self.forecast_cost = forecast_cost
        self.actual_cost = actual_cost
    
    @property
    def allocation_variance(self) -> Decimal:
        """Calculate allocation variance (actual - forecast)."""
        return self.actual_allocation - self.forecast_allocation
    
    @property
    def allocation_variance_percentage(self) -> Optional[Decimal]:
        """Calculate allocation variance as percentage of forecast."""
        if self.forecast_allocation == Decimal('0.00'):
            return None
        return (self.allocation_variance / self.forecast_allocation) * Decimal('100.00')
    
    @property
    def cost_variance(self) -> Optional[Decimal]:
        """Calculate cost variance (actual - forecast)."""
        if self.actual_cost is None or self.forecast_cost is None:
            return None
        return self.actual_cost - self.forecast_cost
    
    @property
    def cost_variance_percentage(self) -> Optional[Decimal]:
        """Calculate cost variance as percentage of forecast."""
        if self.forecast_cost is None or self.forecast_cost == Decimal('0.00'):
            return None
        if self.actual_cost is None:
            return None
        return (self.cost_variance / self.forecast_cost) * Decimal('100.00')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert variance record to dictionary."""
        return {
            "variance_type": self.variance_type,
            "project_id": str(self.project_id),
            "project_name": self.project_name,
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "date": self.variance_date.isoformat(),
            "forecast_allocation": float(self.forecast_allocation),
            "actual_allocation": float(self.actual_allocation),
            "allocation_variance": float(self.allocation_variance),
            "allocation_variance_percentage": (
                float(self.allocation_variance_percentage)
                if self.allocation_variance_percentage is not None
                else None
            ),
            "forecast_cost": (
                float(self.forecast_cost) if self.forecast_cost is not None else None
            ),
            "actual_cost": (
                float(self.actual_cost) if self.actual_cost is not None else None
            ),
            "cost_variance": (
                float(self.cost_variance) if self.cost_variance is not None else None
            ),
            "cost_variance_percentage": (
                float(self.cost_variance_percentage)
                if self.cost_variance_percentage is not None
                else None
            )
        }


class VarianceAnalysisService:
    """Service for analyzing variances between actual and forecast data."""
    
    DEFAULT_ALLOCATION_THRESHOLD = Decimal('20.00')  # 20% variance threshold
    DEFAULT_COST_THRESHOLD = Decimal('10.00')  # 10% cost variance threshold
    
    def __init__(self):
        pass
    
    def analyze_project_variance(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date,
        allocation_threshold: Optional[Decimal] = None,
        cost_threshold: Optional[Decimal] = None
    ) -> List[VarianceRecord]:
        """
        Analyze variances for a project within a date range.
        
        Args:
            db: Database session
            project_id: Project ID to analyze
            start_date: Start of analysis period
            end_date: End of analysis period
            allocation_threshold: Percentage threshold for allocation variance (default: 20%)
            cost_threshold: Percentage threshold for cost variance (default: 10%)
            
        Returns:
            List of VarianceRecord objects
        """
        if allocation_threshold is None:
            allocation_threshold = self.DEFAULT_ALLOCATION_THRESHOLD
        if cost_threshold is None:
            cost_threshold = self.DEFAULT_COST_THRESHOLD
        
        # Get project
        project = project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} does not exist")
        
        # Get actuals for the period
        actuals = actual_repository.get_by_date_range(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Get assignments (forecasts) for the period
        # Note: This is simplified - in reality, we'd need to get all assignments
        # for the project and filter by date range
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        assignments = [
            a for a in assignments
            if start_date <= a.assignment_date <= end_date
        ]
        
        variances = []
        
        # Create lookup structures
        actuals_by_worker_date: Dict[tuple, List] = {}
        for actual in actuals:
            key = (actual.external_worker_id, actual.actual_date)
            if key not in actuals_by_worker_date:
                actuals_by_worker_date[key] = []
            actuals_by_worker_date[key].append(actual)
        
        assignments_by_date: Dict[date, List] = {}
        for assignment in assignments:
            if assignment.assignment_date not in assignments_by_date:
                assignments_by_date[assignment.assignment_date] = []
            assignments_by_date[assignment.assignment_date].append(assignment)
        
        # Check for unplanned work (actuals without assignments)
        for (worker_id, actual_date), worker_actuals in actuals_by_worker_date.items():
            total_actual_allocation = sum(a.allocation_percentage for a in worker_actuals)
            total_actual_cost = sum(a.actual_cost for a in worker_actuals)
            
            # Check if there's a matching assignment
            has_assignment = False
            if actual_date in assignments_by_date:
                # Simplified: just check if any assignment exists for this date
                # In reality, we'd need to match worker to resource
                has_assignment = len(assignments_by_date[actual_date]) > 0
            
            if not has_assignment:
                variances.append(VarianceRecord(
                    variance_type=VarianceType.UNPLANNED_WORK,
                    project_id=project_id,
                    project_name=project.name,
                    worker_id=worker_id,
                    worker_name=worker_actuals[0].worker_name,
                    variance_date=actual_date,
                    forecast_allocation=Decimal('0.00'),
                    actual_allocation=total_actual_allocation,
                    forecast_cost=Decimal('0.00'),
                    actual_cost=total_actual_cost
                ))
        
        # Check for unworked assignments (assignments without actuals)
        for assignment_date, date_assignments in assignments_by_date.items():
            for assignment in date_assignments:
                # Simplified: check if any actuals exist for this date
                # In reality, we'd need to match resource to worker
                has_actual = any(
                    actual_date == assignment_date
                    for (_, actual_date) in actuals_by_worker_date.keys()
                )
                
                if not has_actual:
                    variances.append(VarianceRecord(
                        variance_type=VarianceType.UNWORKED_ASSIGNMENT,
                        project_id=project_id,
                        project_name=project.name,
                        worker_id="unknown",
                        worker_name="Unknown",
                        variance_date=assignment_date,
                        forecast_allocation=assignment.allocation_percentage,
                        actual_allocation=Decimal('0.00'),
                        forecast_cost=None,  # Would need rate lookup
                        actual_cost=Decimal('0.00')
                    ))
        
        # Filter variances by threshold
        significant_variances = []
        for variance in variances:
            is_significant = False
            
            # Check allocation variance
            if variance.allocation_variance_percentage is not None:
                if abs(variance.allocation_variance_percentage) >= allocation_threshold:
                    is_significant = True
            
            # Check cost variance
            if variance.cost_variance_percentage is not None:
                if abs(variance.cost_variance_percentage) >= cost_threshold:
                    is_significant = True
            
            # Always include unplanned work and unworked assignments
            if variance.variance_type in [
                VarianceType.UNPLANNED_WORK,
                VarianceType.UNWORKED_ASSIGNMENT
            ]:
                is_significant = True
            
            if is_significant:
                significant_variances.append(variance)
        
        return significant_variances
    
    def get_variance_summary(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Get a summary of variances for a project.
        
        Args:
            db: Database session
            project_id: Project ID
            start_date: Start of analysis period
            end_date: End of analysis period
            
        Returns:
            Dictionary with variance summary statistics
        """
        variances = self.analyze_project_variance(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Calculate summary statistics
        total_variances = len(variances)
        variance_by_type = {}
        total_allocation_variance = Decimal('0.00')
        total_cost_variance = Decimal('0.00')
        
        for variance in variances:
            # Count by type
            if variance.variance_type not in variance_by_type:
                variance_by_type[variance.variance_type] = 0
            variance_by_type[variance.variance_type] += 1
            
            # Sum variances
            total_allocation_variance += abs(variance.allocation_variance)
            if variance.cost_variance is not None:
                total_cost_variance += abs(variance.cost_variance)
        
        return {
            "project_id": str(project_id),
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "summary": {
                "total_variances": total_variances,
                "variance_by_type": variance_by_type,
                "total_allocation_variance": float(total_allocation_variance),
                "total_cost_variance": float(total_cost_variance)
            },
            "variances": [v.to_dict() for v in variances]
        }
    
    def identify_exceptions(
        self,
        db: Session,
        project_id: UUID,
        start_date: date,
        end_date: date,
        allocation_threshold: Decimal = Decimal('30.00'),
        cost_threshold: Decimal = Decimal('20.00')
    ) -> List[VarianceRecord]:
        """
        Identify exceptional variances that exceed high thresholds.
        
        Args:
            db: Database session
            project_id: Project ID
            start_date: Start of analysis period
            end_date: End of analysis period
            allocation_threshold: High threshold for allocation variance (default: 30%)
            cost_threshold: High threshold for cost variance (default: 20%)
            
        Returns:
            List of exceptional VarianceRecord objects
        """
        return self.analyze_project_variance(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            allocation_threshold=allocation_threshold,
            cost_threshold=cost_threshold
        )
    
    def compare_actual_vs_forecast(
        self,
        db: Session,
        project_id: UUID,
        worker_id: str,
        analysis_date: date
    ) -> Dict[str, Any]:
        """
        Compare actual vs forecast for a specific worker on a specific date.
        
        Args:
            db: Database session
            project_id: Project ID
            worker_id: Worker's external ID
            analysis_date: Date to analyze
            
        Returns:
            Dictionary with comparison details
        """
        # Get actuals for the worker on the date
        actuals = actual_repository.get_by_date(
            db=db,
            external_worker_id=worker_id,
            actual_date=analysis_date
        )
        actuals = [a for a in actuals if a.project_id == project_id]
        
        total_actual_allocation = sum(a.allocation_percentage for a in actuals)
        total_actual_cost = sum(a.actual_cost for a in actuals)
        
        # Get assignments (forecast) for the date
        # Simplified: get all assignments for the project on the date
        assignments = resource_assignment_repository.get_by_project(db, project_id)
        date_assignments = [a for a in assignments if a.assignment_date == analysis_date]
        
        total_forecast_allocation = sum(a.allocation_percentage for a in date_assignments)
        
        return {
            "project_id": str(project_id),
            "worker_id": worker_id,
            "date": analysis_date.isoformat(),
            "forecast": {
                "allocation": float(total_forecast_allocation),
                "assignments_count": len(date_assignments)
            },
            "actual": {
                "allocation": float(total_actual_allocation),
                "cost": float(total_actual_cost),
                "actuals_count": len(actuals)
            },
            "variance": {
                "allocation": float(total_actual_allocation - total_forecast_allocation),
                "allocation_percentage": (
                    float((total_actual_allocation - total_forecast_allocation) / total_forecast_allocation * 100)
                    if total_forecast_allocation > 0
                    else None
                )
            }
        }


# Create service instance
variance_analysis_service = VarianceAnalysisService()
