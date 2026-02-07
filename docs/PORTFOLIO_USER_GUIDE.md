# Portfolio Management User Guide

## Overview

The Portfolio Management feature introduces a new top-level organizational entity that sits above Programs in the system hierarchy. This guide explains how to use portfolios to organize and manage your strategic initiatives.

### Organizational Hierarchy

```
Portfolio (NEW)
  └── Program
      └── Project
          └── Phases
              └── Resource Assignments
```

**Portfolio**: A strategic collection of related programs representing a major organizational initiative
**Program**: A mid-level grouping of related projects
**Project**: An individual initiative with specific deliverables and timelines
**Phases**: User-defined time periods within a project
**Resource Assignments**: Allocation of resources to specific project phases

## Key Concepts

### What is a Portfolio?

A **Portfolio** is a top-level organizational entity that groups multiple Programs under a strategic umbrella. Portfolios enable:

- **Strategic Alignment**: Group programs that contribute to the same strategic objective
- **Executive Visibility**: Provide high-level views of major initiatives
- **Resource Planning**: Understand resource needs across multiple programs
- **Budget Management**: Track spending across related programs
- **Reporting**: Generate consolidated reports for strategic initiatives

### Portfolio Attributes

Each portfolio has the following attributes:

| Attribute | Description | Required | Example |
|-----------|-------------|----------|---------|
| Name | Portfolio name | Yes | "Digital Transformation Portfolio" |
| Description | Detailed description of the portfolio's purpose | Yes | "Strategic initiatives for digital transformation across the organization" |
| Owner | Person or team responsible for the portfolio | Yes | "CTO Office" |
| Reporting Start Date | Beginning of the reporting period | Yes | 2024-01-01 |
| Reporting End Date | End of the reporting period | Yes | 2024-12-31 |

### Portfolio-Program Relationship

- Each **Portfolio** can contain **multiple Programs**
- Each **Program** belongs to **exactly one Portfolio**
- Programs cannot exist without a portfolio assignment
- Portfolios cannot be deleted if they contain programs

## Getting Started

### Accessing Portfolio Management

1. **Log in** to the application with your credentials
2. **Navigate** to the Portfolios section using the sidebar menu
3. The **Portfolios** menu item appears above "Programs" in the navigation

**Note**: You need the `view_portfolios` permission to access portfolio features.

### Viewing Portfolios

The **Portfolios List Page** displays all portfolios you have access to:

![Portfolio List Page](./images/portfolio-list.png)

**Features**:
- **Search Bar**: Filter portfolios by name or owner
- **Data Table**: View key portfolio information at a glance
  - Portfolio Name
  - Owner
  - Reporting Start Date
  - Reporting End Date
  - Program Count
- **Row Hover**: Rows highlight when you hover over them
- **Row Click**: Click any row to view portfolio details
- **Create Button**: Create new portfolios (requires `create_portfolios` permission)

### Creating a Portfolio

To create a new portfolio:

1. **Click** the "Create Portfolio" button in the top-right corner
2. **Fill in** the required fields:
   - **Name**: Enter a descriptive name (1-255 characters)
   - **Description**: Provide detailed information about the portfolio's purpose (1-1000 characters)
   - **Owner**: Specify who is responsible for this portfolio (1-255 characters)
   - **Reporting Start Date**: Select the beginning of the reporting period
   - **Reporting End Date**: Select the end of the reporting period (must be after start date)
3. **Click** "Submit" to create the portfolio
4. **Review** the success message and navigate to the portfolio detail page

![Portfolio Form](./images/portfolio-form.png)

**Validation Rules**:
- All fields are required
- Name, description, and owner cannot be empty or whitespace-only
- Reporting end date must be after the start date
- Field length limits are enforced

**Tips**:
- Use clear, descriptive names that reflect the strategic purpose
- Include enough detail in the description for stakeholders to understand the portfolio's scope
- Choose reporting periods that align with your fiscal year or strategic planning cycles

### Viewing Portfolio Details

Click on any portfolio in the list to view its details:

![Portfolio Detail Page](./images/portfolio-detail.png)

The **Portfolio Detail Page** shows:

**Details Tab**:
- All portfolio attributes in read-only mode
- Program count
- Creation and modification timestamps
- Created by and updated by information

**Programs Tab**:
- List of all programs in the portfolio
- Program names, descriptions, and dates
- Quick navigation to program details

**Actions**:
- **Edit Button**: Switch to edit mode (requires `update_portfolios` permission)
- **Delete Button**: Delete the portfolio (requires `delete_portfolios` permission, only available if no programs exist)

### Editing a Portfolio

To edit an existing portfolio:

1. **Navigate** to the portfolio detail page
2. **Click** the "Edit" button at the bottom-right
3. **Modify** the fields you want to change
   - All fields become editable
   - Validation rules still apply
4. **Click** "Save" to persist changes, or "Cancel" to discard them

![Portfolio Edit Mode](./images/portfolio-edit.png)

**Edit Mode Features**:
- In-place editing without navigating to a separate page
- Real-time validation feedback
- Save and Cancel buttons replace the Edit button
- Changes are not saved until you click "Save"

**Common Edits**:
- Extending the reporting period
- Updating the owner when responsibilities change
- Refining the description as the portfolio evolves
- Correcting data entry errors

### Deleting a Portfolio

To delete a portfolio:

1. **Navigate** to the portfolio detail page
2. **Verify** the portfolio has no associated programs (check the Programs tab)
3. **Click** the "Delete" button
4. **Confirm** the deletion in the dialog

**Important Notes**:
- You **cannot delete** a portfolio that has programs
- You must first reassign or delete all programs
- Deletion is permanent and cannot be undone
- Requires `delete_portfolios` permission

**Before Deleting**:
1. Review the Programs tab to see all associated programs
2. Reassign programs to other portfolios, or
3. Delete programs if they are no longer needed
4. Only then can you delete the portfolio

## Working with Programs

### Creating Programs in a Portfolio

When creating a new program, you must select a portfolio:

1. **Navigate** to Programs → Create Program
2. **Fill in** the program details
3. **Select** a portfolio from the dropdown (required)
4. **Submit** the form

![Program Form with Portfolio](./images/program-form-portfolio.png)

**Portfolio Selection**:
- The portfolio dropdown shows all portfolios you have access to
- Portfolio selection is **required** - you cannot create a program without one
- The selected portfolio determines the program's organizational context

### Viewing Programs in a Portfolio

To see all programs in a portfolio:

1. **Navigate** to the portfolio detail page
2. **Click** the "Programs" tab
3. **View** the list of associated programs
4. **Click** any program to navigate to its details

![Portfolio Programs Tab](./images/portfolio-programs.png)

**Program Information Displayed**:
- Program name
- Description
- Start and end dates
- Status
- Quick link to program details

### Reassigning Programs

To move a program from one portfolio to another:

1. **Navigate** to the program detail page
2. **Click** "Edit"
3. **Select** a different portfolio from the dropdown
4. **Save** the changes

**Use Cases for Reassignment**:
- Organizational restructuring
- Strategic realignment
- Correcting initial assignments
- Consolidating related programs

## Permissions and Access Control

### Portfolio Permissions

The system enforces the following permissions for portfolio operations:

| Permission | Description | Allows |
|------------|-------------|--------|
| `view_portfolios` | View portfolio information | List and view portfolio details |
| `create_portfolios` | Create new portfolios | Create new portfolio records |
| `update_portfolios` | Modify existing portfolios | Edit portfolio attributes |
| `delete_portfolios` | Delete portfolios | Remove portfolios (if empty) |

**Permission Checks**:
- The "Create Portfolio" button only appears if you have `create_portfolios`
- The "Edit" button only appears if you have `update_portfolios`
- The "Delete" button only appears if you have `delete_portfolios`
- Users without `view_portfolios` cannot access portfolio features

### Scope-Based Access

Portfolio access integrates with the existing scope-based access control:

**Global Scope (Admin)**:
- Full access to all portfolios
- Can create, view, edit, and delete any portfolio
- Can manage all programs across all portfolios

**Portfolio Scope**:
- Access to specific portfolios and their programs
- Can view and manage assigned portfolios
- Can view and manage programs within assigned portfolios

**Program Scope**:
- Access to specific programs and their parent portfolio
- Can view the parent portfolio (read-only)
- Cannot modify portfolio attributes

**Project Scope**:
- Access to specific projects
- Can view the parent program's portfolio (read-only)
- Cannot modify portfolio or program attributes

## Migration and Default Portfolio

### Understanding the Default Portfolio

When the Portfolio feature was first deployed, a **Default Portfolio** was automatically created to ensure all existing programs had a portfolio assignment.

**Default Portfolio Properties**:
- **Name**: "Default Portfolio"
- **Description**: "Default portfolio created during migration"
- **Owner**: "System"
- **Dates**: Based on existing program dates

**All existing programs** were automatically assigned to this default portfolio during migration.

### Post-Migration Actions

After the Portfolio feature is deployed, administrators should:

1. **Review the Default Portfolio**
   - Navigate to the default portfolio
   - Review the programs it contains
   - Decide if it should be kept or replaced

2. **Create Strategic Portfolios**
   - Create portfolios that reflect your organizational structure
   - Use meaningful names and descriptions
   - Set appropriate reporting periods

3. **Reassign Programs**
   - Move programs from the default portfolio to appropriate portfolios
   - Group related programs together
   - Ensure strategic alignment

4. **Clean Up (Optional)**
   - Once all programs are reassigned, you can delete the default portfolio
   - Or keep it for miscellaneous programs that don't fit elsewhere

### Migration Verification

To verify the migration was successful:

1. **Check Program Assignments**
   - Navigate to the default portfolio
   - Verify all pre-existing programs are listed
   - Confirm no programs are missing

2. **Test Program Creation**
   - Create a new program
   - Verify portfolio selection is required
   - Confirm the program appears in the selected portfolio

3. **Test Portfolio Operations**
   - Create a test portfolio
   - Reassign a program to it
   - Verify the program appears in the new portfolio

## Common Workflows

### Workflow 1: Setting Up a New Strategic Initiative

**Scenario**: Your organization is launching a new strategic initiative that will involve multiple programs.

**Steps**:
1. **Create a Portfolio**
   - Name: "Cloud Migration Initiative"
   - Description: "Migrate all on-premise systems to cloud infrastructure"
   - Owner: "CTO Office"
   - Dates: 2024-01-01 to 2025-12-31

2. **Create Programs**
   - Infrastructure Migration Program
   - Application Modernization Program
   - Data Migration Program
   - Each program references the Cloud Migration portfolio

3. **Monitor Progress**
   - View the portfolio's Programs tab to see all related programs
   - Track overall progress across the initiative
   - Generate consolidated reports

### Workflow 2: Reorganizing Existing Programs

**Scenario**: You need to reorganize programs to better reflect your organizational structure.

**Steps**:
1. **Create New Portfolios**
   - Create portfolios for each strategic area
   - Use clear, descriptive names

2. **Review Current Assignments**
   - Navigate to the default portfolio
   - Review all programs currently assigned to it

3. **Reassign Programs**
   - For each program, determine the appropriate portfolio
   - Edit the program and select the new portfolio
   - Save the changes

4. **Verify Reassignments**
   - Check each new portfolio's Programs tab
   - Ensure all programs are correctly assigned
   - Delete the default portfolio if empty

### Workflow 3: Quarterly Portfolio Review

**Scenario**: You need to review portfolio status and update information quarterly.

**Steps**:
1. **Review Portfolio List**
   - Navigate to the Portfolios page
   - Review all active portfolios

2. **Update Portfolio Details**
   - For each portfolio, click to view details
   - Click Edit to update information
   - Update owner if responsibilities changed
   - Extend reporting period if needed
   - Update description to reflect current status

3. **Review Programs**
   - Click the Programs tab
   - Verify all programs are still relevant
   - Reassign or remove programs as needed

4. **Generate Reports**
   - Use the reporting features to generate portfolio-level reports
   - Share with stakeholders

### Workflow 4: Closing Out a Portfolio

**Scenario**: A strategic initiative is complete and you need to close the portfolio.

**Steps**:
1. **Review Programs**
   - Navigate to the portfolio detail page
   - Click the Programs tab
   - Review all associated programs

2. **Close or Reassign Programs**
   - For completed programs, mark them as closed
   - For ongoing programs, reassign to another portfolio
   - Ensure no active programs remain

3. **Archive Documentation**
   - Export any reports or documentation
   - Save for historical reference

4. **Delete Portfolio**
   - Once all programs are removed or reassigned
   - Click the Delete button
   - Confirm deletion

## Best Practices

### Naming Conventions

**Portfolios**:
- Use clear, strategic names that reflect the initiative's purpose
- Include the type of initiative if helpful (e.g., "Digital Transformation Portfolio")
- Avoid abbreviations unless widely understood
- Keep names concise but descriptive

**Examples**:
- ✅ "Digital Transformation Portfolio"
- ✅ "Infrastructure Modernization"
- ✅ "Customer Experience Improvement"
- ❌ "DT Port" (too abbreviated)
- ❌ "Portfolio 1" (not descriptive)

### Organizational Structure

**Strategic Alignment**:
- Create portfolios that align with strategic objectives
- Group programs that contribute to the same goal
- Consider your organization's strategic planning framework

**Hierarchy Depth**:
- Keep the hierarchy manageable (Portfolio → Program → Project)
- Don't create too many portfolios - focus on major initiatives
- Use programs to provide additional grouping within portfolios

**Reporting Periods**:
- Align reporting periods with fiscal years or planning cycles
- Use consistent periods across related portfolios
- Extend periods as initiatives continue beyond initial plans

### Data Quality

**Descriptions**:
- Write clear, comprehensive descriptions
- Include the strategic purpose and expected outcomes
- Update descriptions as initiatives evolve
- Use consistent terminology across portfolios

**Ownership**:
- Assign clear ownership to individuals or teams
- Update ownership when responsibilities change
- Ensure owners have appropriate permissions

**Maintenance**:
- Review portfolio information regularly (quarterly recommended)
- Update dates, descriptions, and ownership as needed
- Remove or archive completed portfolios
- Keep the portfolio list current and relevant

### Permission Management

**Access Control**:
- Grant portfolio permissions based on organizational roles
- Use scope-based access to limit visibility appropriately
- Review permissions regularly
- Follow the principle of least privilege

**Role Assignments**:
- Executives: View all portfolios
- Portfolio Managers: Full access to assigned portfolios
- Program Managers: View parent portfolio, manage programs
- Project Managers: View parent portfolio and program (read-only)

## Troubleshooting

### Cannot Create Portfolio

**Problem**: The "Create Portfolio" button is not visible.

**Solution**:
- Verify you have the `create_portfolios` permission
- Contact your administrator to request access
- Check that you're logged in with the correct account

### Cannot Delete Portfolio

**Problem**: Attempting to delete a portfolio returns an error.

**Solution**:
- Check if the portfolio has associated programs (Programs tab)
- Reassign or delete all programs first
- Verify you have the `delete_portfolios` permission
- Refresh the page and try again

### Program Creation Fails

**Problem**: Cannot create a program without selecting a portfolio.

**Solution**:
- Portfolio selection is required for all programs
- Select a portfolio from the dropdown
- If no portfolios are available, create one first
- Contact your administrator if you cannot see any portfolios

### Cannot See Expected Portfolios

**Problem**: Some portfolios are missing from the list.

**Solution**:
- Check your scope-based access permissions
- You may only have access to specific portfolios
- Contact your administrator to request access to additional portfolios
- Verify you're using the correct user account

### Validation Errors

**Problem**: Form submission fails with validation errors.

**Solution**:
- Ensure all required fields are filled in
- Check that the reporting end date is after the start date
- Verify field lengths are within limits (name: 255, description: 1000)
- Remove any leading/trailing whitespace
- Ensure dates are in the correct format (YYYY-MM-DD)

### Migration Issues

**Problem**: Programs are missing after migration.

**Solution**:
- Check the default portfolio for all pre-existing programs
- Verify the migration completed successfully
- Contact your administrator or database administrator
- Review migration logs for errors

## Frequently Asked Questions

### Q: Can a program belong to multiple portfolios?

**A**: No, each program belongs to exactly one portfolio. This ensures clear organizational hierarchy and reporting.

### Q: Can I change a program's portfolio after creation?

**A**: Yes, you can reassign programs to different portfolios by editing the program and selecting a new portfolio.

### Q: What happens to projects when I reassign a program?

**A**: Projects remain associated with their program. When you reassign a program to a different portfolio, all its projects move with it.

### Q: Can I delete a portfolio with programs?

**A**: No, you must first reassign or delete all programs before deleting a portfolio. This prevents accidental data loss.

### Q: What is the default portfolio?

**A**: The default portfolio was automatically created during migration to ensure all existing programs had a portfolio assignment. You can reassign programs from it and optionally delete it once empty.

### Q: How do reporting periods work?

**A**: Reporting periods define the timeframe for portfolio-level reporting and analytics. They don't restrict program or project dates, but provide context for financial and progress reporting.

### Q: Can I have overlapping reporting periods?

**A**: Yes, different portfolios can have overlapping reporting periods. Each portfolio's reporting period is independent.

### Q: Who can create portfolios?

**A**: Users with the `create_portfolios` permission can create portfolios. This is typically granted to administrators and senior managers.

### Q: How do I generate portfolio-level reports?

**A**: Portfolio-level reporting features are available through the Reports section. Select a portfolio to view consolidated reports across all its programs and projects.

### Q: Can I export portfolio data?

**A**: Yes, you can export portfolio data through the reporting features. Contact your administrator for specific export options.

## Additional Resources

### Documentation

- **[Portfolio API Documentation](../backend/docs/PORTFOLIO_API.md)**: Technical API reference for developers
- **[API Documentation Index](../backend/docs/API_DOCUMENTATION_INDEX.md)**: Complete API documentation
- **[Database Migrations](./deployment/DATABASE_MIGRATIONS.md)**: Migration procedures and best practices

### Related Features

- **Program Management**: Learn about managing programs within portfolios
- **Project Management**: Understand how projects fit into the hierarchy
- **Phase Management**: User-definable project phases
- **Resource Management**: Allocate resources across the portfolio

### Support

For additional help:
- Contact your system administrator
- Review the API documentation for technical details
- Check the troubleshooting section above
- File an issue in the project repository

---

**Document Version**: 1.0.0  
**Last Updated**: February 2026  
**Applies To**: Portfolio Management Feature v1.0.0
