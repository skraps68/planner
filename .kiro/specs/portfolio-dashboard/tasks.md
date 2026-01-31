# Implementation Plan: Portfolio Dashboard

## Overview

This implementation plan breaks down the Portfolio Dashboard feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to catch errors early. The implementation follows the existing React + TypeScript + Material-UI patterns in the codebase.

## Tasks

- [x] 1. Set up Portfolio Dashboard page structure and routing
  - Create `frontend/src/pages/PortfolioDashboardPage.tsx` with basic component structure
  - Add route for `/portfolio` in `frontend/src/App.tsx`
  - Update root route `/` to redirect to `/portfolio` instead of `/dashboard`
  - Add Portfolio navigation item to `frontend/src/components/layout/Sidebar.tsx` with unique icon
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.1 Write unit tests for Portfolio Dashboard routing
  - Test that navigating to "/" redirects to Portfolio Dashboard
  - Test that Portfolio link appears in navigation
  - Test that clicking Portfolio link navigates to Portfolio Dashboard
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create API client functions for forecast endpoints
  - Create `frontend/src/api/forecast.ts` with functions for program and project forecast endpoints
  - Implement `getProgramForecast(programId: string, asOfDate: string)` function
  - Implement `getProjectForecast(projectId: string, asOfDate: string)` function
  - Add TypeScript interfaces for API request/response types
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2.1 Write property test for API date parameter
  - **Property 7: API Date Parameter**
  - **Validates: Requirements 6.3**
  - Test that for any forecast API call, as_of_date parameter is set to today's date
  - _Requirements: 6.3_

- [x] 3. Implement data transformation logic
  - Create `frontend/src/utils/forecastTransform.ts` with transformation function
  - Implement `transformForecastData(apiResponse: ForecastApiResponse): FinancialTableData` function
  - Calculate currentForecast as actuals + forecast for each category
  - Calculate variance as budget - currentForecast for each category
  - _Requirements: 4.4, 4.5, 6.4_

- [x] 3.1 Write property test for current forecast calculation
  - **Property 5: Current Forecast Calculation**
  - **Validates: Requirements 4.4**
  - Test that for any actuals A and forecast F, current forecast equals A + F
  - _Requirements: 4.4_

- [x] 3.2 Write property test for variance calculation
  - **Property 6: Variance Calculation**
  - **Validates: Requirements 4.5**
  - Test that for any budget B and current forecast CF, variance equals B - CF
  - _Requirements: 4.5_

- [x] 3.3 Write property test for data transformation correctness
  - **Property 8: Data Transformation Correctness**
  - **Validates: Requirements 6.4**
  - Test that for any valid API response, transformation produces correct FinancialTableData
  - _Requirements: 6.4_

- [x] 4. Create currency formatting utility
  - Create `frontend/src/utils/currencyFormat.ts` with formatting function
  - Implement `formatCurrency(value: number): string` function
  - Add thousand separators and two decimal places
  - Handle negative values with minus sign or distinct styling
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4.1 Write property test for currency formatting consistency
  - **Property 10: Currency Formatting Consistency**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  - Test that for any numeric value, formatting includes thousand separators, two decimals, and consistent styling
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 5. Implement FilterSection component
  - Create `frontend/src/components/portfolio/FilterSection.tsx`
  - Implement program dropdown using Material-UI Select component
  - Implement project dropdown using Material-UI Select component
  - Add props for programs, projects, selected values, and change handlers
  - Disable project dropdown when no program is selected
  - _Requirements: 2.1, 2.2, 2.3, 2.8_

- [x] 5.1 Write unit tests for FilterSection component
  - Test that two dropdowns render on load
  - Test that project dropdown is disabled when no program selected
  - Test that selecting a program enables project dropdown
  - _Requirements: 2.1, 2.8_

- [x] 5.2 Write property test for project filtering
  - **Property 2: Project Filtering by Program**
  - **Validates: Requirements 2.5**
  - Test that for any selected program and projects, dropdown shows only matching projects
  - _Requirements: 2.5_

- [x] 6. Implement FinancialSummaryTable component
  - Create `frontend/src/components/portfolio/FinancialSummaryTable.tsx`
  - Implement 3x5 table structure using Material-UI Table components
  - Add column headers: Budget, Actuals, Forecast, Current Forecast, Variance
  - Add row labels: Total, Capital, Expense
  - Display '+' symbol between Actuals and Forecast columns
  - Display '=' symbol between Forecast and Current Forecast columns
  - Apply currency formatting to all numeric cells
  - Handle loading, error, and empty states
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6.1 Write unit tests for FinancialSummaryTable structure
  - Test that table displays 3x5 grid structure
  - Test that column headers are in correct order
  - Test that row labels are in correct order
  - Test that '+' and '=' symbols are displayed
  - Test that table is visible with empty values on initial load
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6.2 Write property test for financial data display
  - **Property 9: Financial Data Display**
  - **Validates: Requirements 3.7, 5.1, 5.2, 5.3**
  - Test that for any FinancialTableData, table renders Total, Capital, and Expense rows correctly
  - _Requirements: 3.7, 5.1, 5.2, 5.3_

- [x] 7. Implement ChartSection placeholder component
  - Create `frontend/src/components/portfolio/ChartSection.tsx`
  - Display placeholder message indicating future implementation
  - Use Material-UI Paper or Card component for consistent styling
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 7.1 Write unit tests for ChartSection component
  - Test that ChartSection renders without crashing
  - Test that placeholder message is displayed
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. Checkpoint - Ensure all component tests pass
  - Run all unit tests and property tests
  - Verify all components render correctly in isolation
  - Ask the user if questions arise

- [x] 9. Implement PortfolioDashboardPage state management and data fetching
  - Add state for selectedProgramId and selectedProjectId using useState
  - Implement React Query hooks for fetching programs list
  - Implement React Query hook for fetching projects filtered by program
  - Implement React Query hook for fetching forecast data (program or project level)
  - Add handlers for program and project selection changes
  - Pass data and handlers to FilterSection component
  - Pass forecast data to FinancialSummaryTable component
  - _Requirements: 2.4, 2.5, 2.6, 2.7, 4.6, 4.7, 4.8_

- [x] 9.1 Write property test for program dropdown population
  - **Property 1: Program Dropdown Population**
  - **Validates: Requirements 2.4**
  - Test that for any set of programs from API, dropdown contains all programs
  - _Requirements: 2.4_

- [x] 9.2 Write property test for program-level API call
  - **Property 3: Program-Level API Call**
  - **Validates: Requirements 2.6, 6.1**
  - Test that for any program selection without project, system calls program forecast endpoint
  - _Requirements: 2.6, 6.1_

- [x] 9.3 Write property test for project-level API call
  - **Property 4: Project-Level API Call**
  - **Validates: Requirements 2.7, 6.2**
  - Test that for any program and project selection, system calls project forecast endpoint
  - _Requirements: 2.7, 6.2_

- [x] 10. Implement error handling and loading states
  - Add error boundary or error handling for API failures
  - Display error messages using Material-UI Alert component
  - Add loading spinners using Material-UI CircularProgress
  - Handle empty data states gracefully
  - _Requirements: 6.5_

- [x] 10.1 Write property test for error handling
  - **Property 11: Error Handling**
  - **Validates: Requirements 6.5**
  - Test that for any API error, system displays error message and doesn't crash
  - _Requirements: 6.5_

- [x] 11. Wire all components together in PortfolioDashboardPage
  - Import and render FilterSection with appropriate props
  - Import and render FinancialSummaryTable with forecast data
  - Import and render ChartSection below the table
  - Add page layout using Material-UI Box and Grid components
  - Ensure responsive design for different screen sizes
  - _Requirements: All_

- [x] 11.1 Write integration tests for complete user flow
  - Test selecting program updates project dropdown
  - Test selecting program displays program-level data
  - Test selecting project displays project-level data
  - Test error states display correctly
  - Test loading states display correctly
  - _Requirements: All_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Run complete test suite (unit + property + integration tests)
  - Verify Portfolio Dashboard works end-to-end
  - Test navigation from other pages
  - Test that Portfolio is default landing page
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows existing patterns in the codebase (React Query, Material-UI, TypeScript)
