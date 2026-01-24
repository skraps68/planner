# Actuals Import and Variance Analysis - User Guide

## Quick Start

### Accessing Actuals Features

1. **Navigate to Actuals**: Click "Actuals" in the sidebar menu
2. **Import CSV**: Click "Import CSV" button in the top-right
3. **Variance Analysis**: Navigate to `/actuals/variance` or add a link from the actuals list

## CSV Import Guide

### Step 1: Prepare Your CSV File

**Required Format:**
```csv
project_id,external_worker_id,worker_name,date,percentage
550e8400-e29b-41d4-a716-446655440000,EMP001,John Smith,2024-01-15,75.0
550e8400-e29b-41d4-a716-446655440000,EMP002,Jane Doe,2024-01-15,50.0
```

**Field Descriptions:**
- `project_id`: UUID of the project (must exist in system)
- `external_worker_id`: Worker's external identifier (must match existing worker)
- `worker_name`: Worker's display name (must match worker record)
- `date`: Work date in YYYY-MM-DD format
- `percentage`: Allocation percentage (0-100)

**Download Template:**
- Click "Download CSV Template" link in the import wizard
- Use the template as a starting point for your data

### Step 2: Upload and Validate

1. **Upload File:**
   - Drag and drop CSV file onto the upload zone, OR
   - Click the upload zone to browse and select file
   
2. **Automatic Validation:**
   - System validates file format
   - Checks for required fields
   - Validates data types and ranges
   - Checks project and worker existence
   - Detects allocation conflicts

3. **Review Validation Results:**
   - ✅ Green chip: Valid records
   - ❌ Red chip: Validation errors
   - ⚠️ Yellow chip: Allocation conflicts

### Step 3: Resolve Issues

**If Validation Errors:**
- Review error table showing row numbers and specific issues
- Fix errors in your CSV file
- Start over with corrected file

**If Allocation Conflicts:**
- Review conflict table showing:
  - Worker name and ID
  - Date of conflict
  - Existing allocation
  - New allocation
  - Total (will exceed 100%)
  
**Resolution Options:**
1. Adjust percentages in CSV to stay within 100% total
2. Remove conflicting existing actuals first
3. Split work across multiple days

### Step 4: Import

1. **Review Summary:**
   - File name
   - Total rows
   - Valid records count
   
2. **Confirm Import:**
   - Click "Import Actuals" button
   - Wait for processing
   
3. **View Results:**
   - Success count
   - Failure count (if any)
   - Option to import another file or view actuals list

## Variance Analysis Guide

### Setting Up Analysis

1. **Navigate to Variance Analysis:**
   - Go to `/actuals/variance`
   - Or add navigation link from actuals list

2. **Enter Parameters:**
   - **Project ID**: UUID of project to analyze (required)
   - **Start Date**: Beginning of analysis period (required)
   - **End Date**: End of analysis period (required)
   - **Allocation Threshold**: Variance % to flag (default: 20%)
   - **Cost Threshold**: Cost variance % to flag (default: 10%)

3. **Click "Analyze":**
   - System calculates variances
   - Displays results in dashboard

### Understanding the Dashboard

#### Summary Cards

**Total Variances:**
- Count of all variance records found
- Includes all variance types

**Over Allocated (Red):**
- Workers who worked MORE than forecasted
- May indicate scope creep or underestimation
- Shows up arrow icon

**Under Allocated (Orange):**
- Workers who worked LESS than forecasted
- May indicate efficiency or incomplete work
- Shows down arrow icon

**Unplanned Work (Blue):**
- Work performed without forecast
- Requires investigation
- May indicate missing planning

**Unworked Assignments (Gray):**
- Forecasted work not performed
- May indicate delays or unavailability
- Needs follow-up

#### Variance Charts

**Pie Chart:**
- Visual distribution of variance types
- Shows proportion of each type
- Hover for exact counts

**Bar Chart:**
- Variance breakdown by type
- Color-coded bars
- Easy comparison

### Exploring Variances

#### All Variances Tab

**Table Columns:**
- **Worker**: Name and ID
- **Date**: Date of variance
- **Forecast %**: Planned allocation
- **Actual %**: Actual allocation
- **Variance**: Difference (with direction icon)
- **Type**: Variance type (color-coded chip)

**Actions:**
- **Expand Row**: Click arrow icon for more details
- **Drill Down**: Click row to open detailed dialog

#### Exceptional Variances Tab

**Purpose:**
- Shows only high-severity variances
- Uses higher thresholds (default: +10% above normal)
- Focus on critical issues

**Features:**
- Warning alert with threshold display
- Severity indicators (HIGH, MEDIUM, LOW)
- Same table structure as all variances

### Drill-Down Investigation

**Click any variance row to open detailed dialog:**

**Worker Information:**
- Full name and ID
- Date of variance

**Allocation Comparison:**
- Side-by-side cards showing forecast vs actual
- Clear visual comparison

**Variance Metrics:**
- Absolute variance (percentage points)
- Relative variance (percentage)
- Severity level with color coding
- Direction indicators (up/down arrows)

**Variance Type:**
- Type chip with color
- Contextual explanation of what it means
- Implications for project

**Recommendations:**
- Context-specific action items
- Best practices for resolution
- Documentation guidance

**Actions:**
- Close dialog
- Mark as Reviewed (future enhancement)

## Best Practices

### CSV Import

1. **Validate Before Import:**
   - Always review validation results
   - Fix all errors before importing
   - Resolve conflicts proactively

2. **Batch Imports:**
   - Import in reasonable batch sizes
   - Don't import months of data at once
   - Easier to troubleshoot smaller batches

3. **Data Quality:**
   - Ensure worker IDs match exactly
   - Use correct date format (YYYY-MM-DD)
   - Verify project IDs before import
   - Keep percentages realistic (0-100)

4. **Conflict Prevention:**
   - Check existing actuals before import
   - Coordinate with team on data entry
   - Use consistent allocation percentages

### Variance Analysis

1. **Regular Reviews:**
   - Analyze variances weekly or bi-weekly
   - Don't wait until end of project
   - Early detection prevents bigger issues

2. **Threshold Tuning:**
   - Adjust thresholds based on project type
   - Tighter thresholds for critical projects
   - Looser thresholds for exploratory work

3. **Investigation:**
   - Use drill-down for detailed investigation
   - Document reasons for variances
   - Share findings with project team

4. **Action Items:**
   - Follow recommendations in drill-down
   - Update forecasts based on actuals
   - Adjust resource allocation as needed

5. **Trend Analysis:**
   - Compare variances across time periods
   - Identify patterns in over/under allocation
   - Use insights for future planning

## Troubleshooting

### Import Issues

**"File format not supported"**
- Ensure file has .csv extension
- Check file is not corrupted
- Try re-saving as CSV from Excel

**"Project not found"**
- Verify project ID exists in system
- Check for typos in UUID
- Ensure project hasn't been deleted

**"Worker not found"**
- Verify worker external ID exists
- Check for typos or extra spaces
- Ensure worker hasn't been deleted

**"Worker name mismatch"**
- Name in CSV must match worker record exactly
- Check for spelling differences
- Verify capitalization

**"Allocation exceeds 100%"**
- Check existing actuals for same worker/date
- Reduce percentages in CSV
- Split work across multiple days

### Variance Analysis Issues

**"No variances found"**
- Verify date range includes actual work
- Check if actuals have been imported
- Ensure forecasts exist for comparison
- Try wider date range

**"Analysis taking too long"**
- Reduce date range
- Analyze one project at a time
- Check backend performance

**"Unexpected variance types"**
- Review forecast data quality
- Check actual data accuracy
- Verify worker assignments

## Tips and Tricks

### CSV Import

1. **Use Excel Formulas:**
   - Generate UUIDs with formulas
   - Calculate percentages automatically
   - Validate data before export

2. **Template Customization:**
   - Add your own validation columns
   - Include notes for reference
   - Remove before import

3. **Incremental Imports:**
   - Import daily or weekly
   - Easier to track and fix issues
   - Better data quality

### Variance Analysis

1. **Bookmark Analysis:**
   - Save URL with parameters
   - Quick access to common analyses
   - Share with team members

2. **Export Results:**
   - Take screenshots of charts
   - Copy table data to Excel
   - Document in project reports

3. **Comparative Analysis:**
   - Run analysis for multiple periods
   - Compare variance trends
   - Identify improvement areas

4. **Team Collaboration:**
   - Share exceptional variances
   - Discuss in team meetings
   - Assign investigation tasks

## Keyboard Shortcuts

- **Esc**: Close dialogs
- **Enter**: Submit forms
- **Tab**: Navigate form fields
- **Arrow Keys**: Navigate table rows

## Support

For issues or questions:
1. Check this user guide
2. Review error messages carefully
3. Contact system administrator
4. Report bugs to development team

## Glossary

**Actual**: Historical record of work performed
**Allocation**: Percentage of worker's time on project
**Conflict**: Situation where total allocation exceeds 100%
**Forecast**: Planned future work based on assignments
**Variance**: Difference between forecast and actual
**Exceptional Variance**: Variance exceeding high threshold
**Drill-Down**: Detailed investigation of specific variance
**CSV**: Comma-Separated Values file format
**UUID**: Universally Unique Identifier (project/worker ID)
