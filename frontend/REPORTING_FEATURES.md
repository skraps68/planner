# Reporting and Forecasting Dashboard Features

## Overview

This document describes the reporting and forecasting dashboard features implemented for the Program and Project Management System.

## Available Reports

### 1. Budget vs Actual vs Forecast Dashboard

**Location:** `/reports/budget-vs-actual`

**Features:**
- Compare budget, actual costs, and forecasts for projects or programs
- Visual breakdown with bar charts and pie charts
- Capital vs Expense categorization
- Variance analysis with color-coded indicators
- Program-level aggregation with drill-down to individual projects
- Export to Excel and PDF (coming soon)

**Key Metrics:**
- Total Budget (Capital + Expense)
- Total Actual with variance percentage
- Total Forecast with variance percentage
- Budget vs Actual variance
- Budget vs Forecast variance

### 2. Time Series Cost Tracking

**Location:** `/reports/time-series`

**Features:**
- Track costs over time with customizable intervals (daily, weekly, monthly)
- Toggle between period and cumulative views
- Switch between line and area chart visualizations
- Compare budget, actual, and forecast trends
- Summary statistics with variance calculations
- Export functionality (coming soon)

**Customization Options:**
- Date range selection
- Interval selection (daily/weekly/monthly)
- Chart type (line/area)
- View mode (period/cumulative)

### 3. Resource Utilization Report

**Location:** `/reports/resource-utilization`

**Features:**
- Analyze resource utilization across projects
- Multiple visualization modes:
  - Bar chart view
  - Table view with detailed metrics
  - Heatmap view with color-coded intensity
- Utilization metrics:
  - Average allocation percentage
  - Days utilized vs total days
  - Utilization percentage
  - Status indicators (High/Good/Moderate/Low/Very Low)
- Summary statistics:
  - Total resources
  - Average utilization
  - High utilization count (≥80%)
  - Low utilization count (<40%)

**Color Coding:**
- Green (80-100%): High utilization
- Light Green (60-80%): Good utilization
- Yellow (40-60%): Moderate utilization
- Orange (20-40%): Low utilization
- Red (0-20%): Very low utilization

### 4. Drill-Down Report

**Location:** `/reports/drill-down`

**Features:**
- Detailed breakdown of costs by different dimensions
- Group by options:
  - Worker: See costs per worker
  - Date: See costs per date
  - Phase: See costs per project phase
- Expandable rows for hierarchical data
- Sortable columns
- Variance analysis at each level
- Color-coded variance indicators

**Metrics:**
- Budget
- Actual
- Forecast
- Variance (amount and percentage)

### 5. Variance Analysis

**Location:** `/actuals/variance`

**Features:**
- Compare actual vs planned allocations
- Identify significant variances
- Configurable thresholds
- Exception reporting
- Drill-down capabilities

## Reports Index Page

**Location:** `/reports`

The reports index page provides:
- Overview of all available reports
- Quick access cards with descriptions
- Visual icons for each report type
- Quick statistics about reporting capabilities

## Export Functionality

All reports include export buttons for:
- **Excel (.xlsx)**: Includes data tables and optional charts
- **PDF (.pdf)**: Formatted report with visualizations

**Export Options:**
- Include charts and visualizations
- Include detailed breakdown
- Include raw data (Excel only)

**Note:** Export functionality is currently in development and will generate downloadable files with selected options.

## Technical Implementation

### Frontend Components

**Pages:**
- `BudgetVsActualDashboard.tsx`: Main financial dashboard
- `TimeSeriesCostReport.tsx`: Time-based cost tracking
- `ResourceUtilizationReport.tsx`: Resource utilization analysis
- `DrillDownReport.tsx`: Detailed breakdown reports
- `ReportsIndexPage.tsx`: Reports landing page

**Shared Components:**
- `ExportDialog.tsx`: Reusable export dialog
- `BudgetComparisonChart.tsx`: Reusable chart component

**API Client:**
- `reports.ts`: API client for all reporting endpoints

### Backend Endpoints

All reports consume the following API endpoints:
- `/api/v1/reports/forecast/project/{id}`
- `/api/v1/reports/forecast/program/{id}`
- `/api/v1/reports/budget-vs-actual/{type}/{id}`
- `/api/v1/reports/project/{id}/time-series`
- `/api/v1/reports/project/{id}/drill-down`
- `/api/v1/reports/project/{id}/variance`

### Charting Library

Reports use **Recharts** for all visualizations:
- Line charts
- Area charts
- Bar charts
- Pie charts
- Responsive containers
- Custom tooltips and legends

## Navigation

Reports are accessible from:
1. Main sidebar navigation (Reports icon)
2. Direct URL navigation
3. Reports index page with quick access cards

## Future Enhancements

- Real-time data updates via WebSocket
- Scheduled report generation
- Email report delivery
- Custom report builder
- Advanced filtering options
- Saved report configurations
- Report sharing and collaboration
- Mobile-optimized views
- Interactive drill-through capabilities
- Predictive analytics and forecasting
