"""
Forecasting and Reporting API endpoints.
"""
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.forecasting import forecasting_service
from app.services.reporting import reporting_service

router = APIRouter()


@router.get(
    "/forecast/project/{project_id}",
    summary="Get project forecast",
    description="Calculate cost forecast for a project based on resource assignments and actuals"
)
async def get_project_forecast(
    project_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to calculate forecast as of (default: today)"),
    phase_id: Optional[UUID] = Query(default=None, description="Optional phase ID to filter forecast by specific phase"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate forecast for a project.
    
    Returns budget vs actual vs forecast data with analysis metrics.
    If phase_id is provided, filters data to only that phase.
    """
    try:
        forecast_data = forecasting_service.calculate_project_forecast(
            db=db,
            project_id=project_id,
            as_of_date=as_of_date,
            phase_id=phase_id
        )
        return forecast_data.to_dict()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/forecast/program/{program_id}",
    summary="Get program forecast",
    description="Calculate aggregated cost forecast for a program (all its projects)"
)
async def get_program_forecast(
    program_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to calculate forecast as of (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate aggregated forecast for a program.
    
    Returns budget vs actual vs forecast data aggregated across all projects.
    """
    try:
        forecast_data = forecasting_service.calculate_program_forecast(
            db=db,
            program_id=program_id,
            as_of_date=as_of_date
        )
        return forecast_data.to_dict()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/budget-vs-actual/{entity_type}/{entity_id}",
    summary="Get budget vs actual vs forecast report",
    description="Get comprehensive budget vs actual vs forecast report for a project or program"
)
async def get_budget_vs_actual_vs_forecast(
    entity_type: str,
    entity_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to calculate as of (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get budget vs actual vs forecast report.
    
    Args:
        entity_type: "project" or "program"
        entity_id: Project or Program ID
        as_of_date: Date to calculate as of (default: today)
    
    Returns comprehensive financial report with budget, actual, and forecast data.
    """
    if entity_type not in ["project", "program"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="entity_type must be 'project' or 'program'"
        )
    
    try:
        report = forecasting_service.get_budget_vs_actual_vs_forecast(
            db=db,
            entity_id=entity_id,
            entity_type=entity_type,
            as_of_date=as_of_date
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/project/{project_id}/cost-projection",
    summary="Get project cost projection",
    description="Calculate detailed cost projection for a project over a date range"
)
async def get_project_cost_projection(
    project_id: UUID,
    start_date: date = Query(..., description="Start of projection period"),
    end_date: date = Query(..., description="End of projection period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate detailed cost projection for a project over a date range.
    
    Returns daily cost projections with capital/expense breakdown.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    try:
        projection = forecasting_service.calculate_cost_projection(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        return projection
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/project/{project_id}",
    summary="Get project report",
    description="Generate comprehensive report for a single project"
)
async def get_project_report(
    project_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to generate report as of (default: today)"),
    include_variance: bool = Query(default=True, description="Include variance analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate comprehensive report for a single project.
    
    Includes financial summary, budget vs actual vs forecast, and optional variance analysis.
    """
    try:
        report = reporting_service.get_project_report(
            db=db,
            project_id=project_id,
            as_of_date=as_of_date,
            include_variance=include_variance
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/program/{program_id}",
    summary="Get program report",
    description="Generate comprehensive report for a program with aggregated project data"
)
async def get_program_report(
    program_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to generate report as of (default: today)"),
    include_projects: bool = Query(default=True, description="Include individual project details"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate comprehensive report for a program.
    
    Includes aggregated financial summary and optional individual project reports.
    """
    try:
        report = reporting_service.get_program_report(
            db=db,
            program_id=program_id,
            as_of_date=as_of_date,
            include_projects=include_projects
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/budget-status/{entity_type}/{entity_id}",
    summary="Get budget status report",
    description="Get budget status report with status indicators"
)
async def get_budget_status_report(
    entity_type: str,
    entity_id: UUID,
    as_of_date: Optional[date] = Query(default=None, description="Date to generate report as of (default: today)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get budget status report showing budget vs actual vs forecast with status indicators.
    
    Args:
        entity_type: "project" or "program"
        entity_id: Project or Program ID
        as_of_date: Date to generate report as of (default: today)
    
    Returns budget status with indicators (on_track, at_risk, over_budget).
    """
    if entity_type not in ["project", "program"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="entity_type must be 'project' or 'program'"
        )
    
    try:
        report = reporting_service.get_budget_status_report(
            db=db,
            entity_id=entity_id,
            entity_type=entity_type,
            as_of_date=as_of_date
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/project/{project_id}/time-series",
    summary="Get time-series report",
    description="Generate time-series report showing budget vs actual over time"
)
async def get_time_series_report(
    project_id: UUID,
    start_date: date = Query(..., description="Start of reporting period"),
    end_date: date = Query(..., description="End of reporting period"),
    interval: str = Query(default="monthly", description="Time interval: daily, weekly, or monthly"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate time-series report showing budget vs actual over time.
    
    Returns data grouped by specified interval with cumulative totals.
    """
    if interval not in ["daily", "weekly", "monthly"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="interval must be 'daily', 'weekly', or 'monthly'"
        )
    
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    try:
        report = reporting_service.get_time_series_report(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            interval=interval
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/project/{project_id}/drill-down",
    summary="Get drill-down report",
    description="Generate drill-down report with detailed breakdown"
)
async def get_drill_down_report(
    project_id: UUID,
    start_date: date = Query(..., description="Start of reporting period"),
    end_date: date = Query(..., description="End of reporting period"),
    group_by: str = Query(default="worker", description="Group by: worker, date, or phase"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate drill-down report with detailed breakdown.
    
    Returns data grouped by specified dimension (worker, date, or phase).
    """
    if group_by not in ["worker", "date", "phase"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="group_by must be 'worker', 'date', or 'phase'"
        )
    
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    try:
        report = reporting_service.get_drill_down_report(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/project/{project_id}/variance",
    summary="Get variance analysis report",
    description="Generate detailed variance analysis report for a project"
)
async def get_variance_report(
    project_id: UUID,
    start_date: date = Query(..., description="Start of analysis period"),
    end_date: date = Query(..., description="End of analysis period"),
    allocation_threshold: Optional[Decimal] = Query(default=None, ge=0, le=100, description="Percentage threshold for allocation variance"),
    cost_threshold: Optional[Decimal] = Query(default=None, ge=0, le=100, description="Percentage threshold for cost variance"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate detailed variance analysis report for a project.
    
    Compares actual vs forecast allocations and identifies significant variances.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    try:
        report = reporting_service.get_variance_report(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            allocation_threshold=allocation_threshold,
            cost_threshold=cost_threshold
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/project/{project_id}/variance/exceptions",
    summary="Get variance exceptions",
    description="Identify exceptional variances that exceed high thresholds"
)
async def get_variance_exceptions(
    project_id: UUID,
    start_date: date = Query(..., description="Start of analysis period"),
    end_date: date = Query(..., description="End of analysis period"),
    allocation_threshold: Decimal = Query(default=Decimal("30.0"), ge=0, le=100, description="High threshold for allocation variance (default: 30%)"),
    cost_threshold: Decimal = Query(default=Decimal("20.0"), ge=0, le=100, description="High threshold for cost variance (default: 20%)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Identify exceptional variances that exceed high thresholds.
    
    Returns only the most significant variances for management attention.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    try:
        from app.services.variance_analysis import variance_analysis_service
        
        exceptions = variance_analysis_service.identify_exceptions(
            db=db,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            allocation_threshold=allocation_threshold,
            cost_threshold=cost_threshold
        )
        
        return {
            "project_id": str(project_id),
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "thresholds": {
                "allocation_threshold": float(allocation_threshold),
                "cost_threshold": float(cost_threshold)
            },
            "exceptions_count": len(exceptions),
            "exceptions": [e.to_dict() for e in exceptions]
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
