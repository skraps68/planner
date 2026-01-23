"""
Report and forecast-related Pydantic schemas.
"""
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import Field

from .base import BaseSchema, DateRangeFilter, ScopeFilter


class ReportFilters(DateRangeFilter, ScopeFilter):
    """Base filters for reports."""
    
    cost_center_codes: Optional[List[str]] = Field(default=None, description="Filter by cost center codes")
    worker_types: Optional[List[str]] = Field(default=None, description="Filter by worker types")
    resource_types: Optional[List[str]] = Field(default=None, description="Filter by resource types")


class BudgetBreakdown(BaseSchema):
    """Schema for budget breakdown information."""
    
    capital_budget: Decimal = Field(description="Capital budget amount")
    expense_budget: Decimal = Field(description="Expense budget amount")
    total_budget: Decimal = Field(description="Total budget amount")


class ActualBreakdown(BaseSchema):
    """Schema for actual costs breakdown."""
    
    capital_actual: Decimal = Field(description="Capital actual amount")
    expense_actual: Decimal = Field(description="Expense actual amount")
    total_actual: Decimal = Field(description="Total actual amount")


class ForecastBreakdown(BaseSchema):
    """Schema for forecast breakdown."""
    
    capital_forecast: Decimal = Field(description="Capital forecast amount")
    expense_forecast: Decimal = Field(description="Expense forecast amount")
    total_forecast: Decimal = Field(description="Total forecast amount")


class VarianceBreakdown(BaseSchema):
    """Schema for variance breakdown."""
    
    budget_vs_actual_variance: Decimal = Field(description="Budget vs actual variance")
    budget_vs_forecast_variance: Decimal = Field(description="Budget vs forecast variance")
    actual_vs_forecast_variance: Decimal = Field(description="Actual vs forecast variance")
    budget_vs_actual_percentage: Decimal = Field(description="Budget vs actual variance percentage")
    budget_vs_forecast_percentage: Decimal = Field(description="Budget vs forecast variance percentage")


class ProjectFinancialSummary(BaseSchema):
    """Schema for project financial summary."""
    
    project_id: UUID = Field(description="Project ID")
    project_name: str = Field(description="Project name")
    program_id: UUID = Field(description="Program ID")
    program_name: str = Field(description="Program name")
    cost_center_code: str = Field(description="Cost center code")
    budget: BudgetBreakdown = Field(description="Budget breakdown")
    actual: ActualBreakdown = Field(description="Actual costs breakdown")
    forecast: ForecastBreakdown = Field(description="Forecast breakdown")
    variance: VarianceBreakdown = Field(description="Variance analysis")


class ProgramFinancialSummary(BaseSchema):
    """Schema for program financial summary."""
    
    program_id: UUID = Field(description="Program ID")
    program_name: str = Field(description="Program name")
    project_count: int = Field(description="Number of projects in program")
    budget: BudgetBreakdown = Field(description="Budget breakdown")
    actual: ActualBreakdown = Field(description="Actual costs breakdown")
    forecast: ForecastBreakdown = Field(description="Forecast breakdown")
    variance: VarianceBreakdown = Field(description="Variance analysis")
    projects: List[ProjectFinancialSummary] = Field(description="Project summaries")


class BudgetVsActualReport(BaseSchema):
    """Schema for budget vs actual report."""
    
    report_date: date = Field(description="Report generation date")
    filters: ReportFilters = Field(description="Applied filters")
    summary: Dict[str, Decimal] = Field(description="Overall summary totals")
    programs: List[ProgramFinancialSummary] = Field(description="Program-level data")


class TimeSeriesDataPoint(BaseSchema):
    """Schema for time series data point."""
    
    data_date: date = Field(description="Data point date")
    budget: Decimal = Field(description="Budget amount")
    actual: Decimal = Field(description="Actual amount")
    forecast: Decimal = Field(description="Forecast amount")
    cumulative_budget: Decimal = Field(description="Cumulative budget")
    cumulative_actual: Decimal = Field(description="Cumulative actual")
    cumulative_forecast: Decimal = Field(description="Cumulative forecast")


class ForecastReport(BaseSchema):
    """Schema for forecast report."""
    
    report_date: date = Field(description="Report generation date")
    forecast_date: date = Field(description="Forecast as of date")
    filters: ReportFilters = Field(description="Applied filters")
    summary: Dict[str, Decimal] = Field(description="Overall summary totals")
    time_series: List[TimeSeriesDataPoint] = Field(description="Time series data")
    programs: List[ProgramFinancialSummary] = Field(description="Program-level forecasts")


class VarianceException(BaseSchema):
    """Schema for variance exception."""
    
    entity_type: str = Field(description="Entity type (program/project)")
    entity_id: UUID = Field(description="Entity ID")
    entity_name: str = Field(description="Entity name")
    variance_type: str = Field(description="Type of variance")
    variance_amount: Decimal = Field(description="Variance amount")
    variance_percentage: Decimal = Field(description="Variance percentage")
    threshold_exceeded: Decimal = Field(description="Threshold that was exceeded")
    severity: str = Field(description="Severity level (low/medium/high)")


class VarianceAnalysisReport(BaseSchema):
    """Schema for variance analysis report."""
    
    report_date: date = Field(description="Report generation date")
    filters: ReportFilters = Field(description="Applied filters")
    thresholds: Dict[str, Decimal] = Field(description="Variance thresholds used")
    summary: Dict[str, int] = Field(description="Summary of exceptions by severity")
    exceptions: List[VarianceException] = Field(description="Variance exceptions")


class ResourceUtilization(BaseSchema):
    """Schema for resource utilization data."""
    
    resource_id: UUID = Field(description="Resource ID")
    resource_name: str = Field(description="Resource name")
    resource_type: str = Field(description="Resource type")
    total_allocation: Decimal = Field(description="Total allocation percentage")
    average_allocation: Decimal = Field(description="Average allocation percentage")
    utilization_days: int = Field(description="Number of days with allocation")
    total_days: int = Field(description="Total days in period")
    utilization_percentage: Decimal = Field(description="Utilization percentage")


class WorkerUtilization(BaseSchema):
    """Schema for worker utilization data."""
    
    external_worker_id: str = Field(description="External worker ID")
    worker_name: str = Field(description="Worker name")
    worker_type: str = Field(description="Worker type")
    total_allocation: Decimal = Field(description="Total allocation percentage")
    average_allocation: Decimal = Field(description="Average allocation percentage")
    working_days: int = Field(description="Number of days with actuals")
    total_days: int = Field(description="Total days in period")
    utilization_percentage: Decimal = Field(description="Utilization percentage")
    total_cost: Decimal = Field(description="Total cost")


class ResourceUtilizationReport(BaseSchema):
    """Schema for resource utilization report."""
    
    report_date: date = Field(description="Report generation date")
    filters: ReportFilters = Field(description="Applied filters")
    summary: Dict[str, Decimal] = Field(description="Overall utilization summary")
    resource_utilization: List[ResourceUtilization] = Field(description="Resource utilization data")
    worker_utilization: List[WorkerUtilization] = Field(description="Worker utilization data")


class ExportFormat(BaseSchema):
    """Schema for report export format options."""
    
    format: str = Field(description="Export format (pdf, excel, csv)")
    include_charts: bool = Field(default=True, description="Include charts in export")
    include_details: bool = Field(default=True, description="Include detailed data")


class ReportExportRequest(BaseSchema):
    """Schema for report export request."""
    
    report_type: str = Field(description="Type of report to export")
    filters: ReportFilters = Field(description="Report filters")
    export_format: ExportFormat = Field(description="Export format options")


class ReportExportResponse(BaseSchema):
    """Schema for report export response."""
    
    export_id: UUID = Field(description="Export job ID")
    status: str = Field(description="Export status")
    download_url: Optional[str] = Field(default=None, description="Download URL when ready")
    expires_at: Optional[str] = Field(default=None, description="Download URL expiration")