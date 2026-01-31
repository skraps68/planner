# Requirements Document

## Introduction

The Portfolio Dashboard feature provides a comprehensive financial overview of programs and projects, serving as the default landing page for the application. The term "Portfolio" represents a conceptual top-level view of all programs in the system, orienting users at the highest level before they select specific programs or projects. Users can view aggregated financial data at the program level or drill down to specific project details through an interactive filtering interface and financial summary table.

## Glossary

- **Portfolio**: A conceptual top-level view representing the collection of all programs; not a formal data model entity but a user-facing concept for navigation
- **Program**: A grouping of related projects with shared objectives; the highest level of the actual data hierarchy
- **Project**: An individual initiative within a program with its own budget and timeline
- **Budget**: The total planned financial allocation for a project or portfolio
- **Actuals**: Historical financial data representing actual costs incurred up to a specific date
- **Forecast**: Projected future costs from a specific date forward based on resource assignments
- **Current_Forecast**: The sum of Actuals and Forecast, representing total expected costs
- **Variance**: The difference between Budget and Current Forecast (Budget - Current Forecast)
- **As_Of_Date**: The date used to split historical actuals from future forecast data
- **Financial_Summary_Table**: A 3x5 grid displaying 15 financial metrics across budget categories
- **Navigation_Bar**: The top-level navigation component of the application
- **Filter_Section**: The dropdown menu area for selecting program and project filters
- **Program_Dropdown**: The left dropdown menu for selecting a program
- **Capital**: Financial category for capital expenditures
- **Expense**: Financial category for operational expenses

## Requirements

### Requirement 1: Portfolio Page Navigation

**User Story:** As a user, I want to access the Portfolio Dashboard as the default landing page, so that I can immediately view financial data when I open the application.

#### Acceptance Criteria

1. WHEN a user navigates to the application root URL, THE System SHALL display the Portfolio Dashboard page
2. WHEN the Portfolio Dashboard loads, THE System SHALL display a Portfolio icon in the top left of the Navigation_Bar
3. THE Navigation_Bar SHALL include a clickable Portfolio link that navigates to the Portfolio Dashboard
4. THE Portfolio link SHALL have a unique icon distinct from other navigation items

### Requirement 2: Program and Project Filtering

**User Story:** As a user, I want to filter financial data by program and project, so that I can view aggregated or specific financial information.

#### Acceptance Criteria

1. WHEN the Portfolio Dashboard loads, THE System SHALL display two dropdown menus in the Filter_Section
2. THE Filter_Section SHALL display the Program_Dropdown on the left side
3. THE Filter_Section SHALL display the Project dropdown on the right side
4. WHEN the Portfolio Dashboard loads, THE Program_Dropdown SHALL contain all available programs
5. WHEN a user selects a program from the Program_Dropdown, THE System SHALL update the Project dropdown to show only projects within the selected program
6. WHEN a user selects a program without selecting a project, THE System SHALL display aggregated financial data for all projects in that program
7. WHEN a user selects both a program and a project, THE System SHALL display financial data for the specific selected project
8. WHEN no program is selected, THE Project dropdown SHALL be empty or disabled

### Requirement 3: Financial Summary Table Structure

**User Story:** As a user, I want to view financial metrics in a structured table, so that I can understand budget, actuals, forecast, and variance data.

#### Acceptance Criteria

1. THE Financial_Summary_Table SHALL display a 3x5 grid with 3 rows and 5 columns
2. THE Financial_Summary_Table SHALL display column headers in the following order: Budget, Actuals, Forecast, Current Forecast, Variance
3. THE Financial_Summary_Table SHALL display row labels in the following order: Total, Capital, Expense
4. THE Financial_Summary_Table SHALL display a '+' symbol between the Actuals and Forecast columns
5. THE Financial_Summary_Table SHALL display an '=' symbol between the Forecast and Current Forecast columns
6. WHEN the Portfolio Dashboard loads, THE Financial_Summary_Table SHALL be visible with empty or default values
7. WHEN a portfolio or project is selected, THE Financial_Summary_Table SHALL populate with corresponding financial data

### Requirement 4: Financial Data Calculation

**User Story:** As a user, I want accurate financial calculations, so that I can trust the displayed budget, actuals, forecast, and variance data.

#### Acceptance Criteria

1. WHEN calculating Budget, THE System SHALL sum all budgeted amounts from project phases
2. WHEN calculating Actuals, THE System SHALL sum all loaded actuals up to the As_Of_Date
3. WHEN calculating Forecast, THE System SHALL sum projected costs from the As_Of_Date forward based on resource assignments
4. WHEN calculating Current_Forecast, THE System SHALL compute the sum of Actuals and Forecast
5. WHEN calculating Variance, THE System SHALL compute Budget minus Current_Forecast
6. THE System SHALL use today's date as the As_Of_Date for splitting actuals from forecast
7. WHEN a program is selected without a project, THE System SHALL aggregate financial data across all projects in the program
8. WHEN a specific project is selected, THE System SHALL display financial data for that project only

### Requirement 5: Financial Data Categorization

**User Story:** As a user, I want to see financial data broken down by category, so that I can distinguish between capital and expense costs.

#### Acceptance Criteria

1. THE Financial_Summary_Table SHALL display a Total row showing combined Capital and Expense values
2. THE Financial_Summary_Table SHALL display a Capital row showing capital expenditure values
3. THE Financial_Summary_Table SHALL display an Expense row showing operational expense values
4. WHEN calculating Total values, THE System SHALL sum the corresponding Capital and Expense values for each column
5. THE System SHALL categorize all financial data as either Capital or Expense based on project phase configuration

### Requirement 6: Backend API Integration

**User Story:** As a developer, I want to leverage existing forecasting service endpoints, so that I can retrieve financial data efficiently.

#### Acceptance Criteria

1. WHEN retrieving program-level data, THE System SHALL call the `/reports/forecast/program/{program_id}` endpoint
2. WHEN retrieving project-level data, THE System SHALL call the `/reports/forecast/project/{project_id}` endpoint
3. WHEN calling forecast endpoints, THE System SHALL include the `as_of_date` parameter set to today's date
4. THE System SHALL handle API response data and map it to the Financial_Summary_Table structure
5. IF an API call fails, THEN THE System SHALL display an error message to the user

### Requirement 7: Currency Formatting

**User Story:** As a user, I want financial values displayed in a readable format, so that I can easily interpret large numbers.

#### Acceptance Criteria

1. THE System SHALL format all currency values in the Financial_Summary_Table with appropriate thousand separators
2. THE System SHALL display currency values with two decimal places
3. THE System SHALL display negative variance values with a minus sign or in a visually distinct format
4. THE System SHALL maintain consistent currency formatting across all cells in the Financial_Summary_Table

### Requirement 8: Chart Section Placeholder

**User Story:** As a user, I want to see a placeholder for future chart functionality, so that I know additional visualizations will be available.

#### Acceptance Criteria

1. THE Portfolio Dashboard SHALL display a Chart Section below the Financial_Summary_Table
2. WHEN the Portfolio Dashboard loads, THE Chart Section SHALL be visible
3. THE Chart Section SHALL display a placeholder message or empty state indicating future implementation
4. THE Chart Section SHALL not interfere with the functionality of the Filter_Section or Financial_Summary_Table
