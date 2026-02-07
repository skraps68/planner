# Implementation Plan: Portfolio Entity

## Overview

This implementation plan breaks down the Portfolio entity feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: database → backend models → backend services → backend API → frontend API client → frontend components → integration.

Each task builds on previous work, ensuring that code is integrated and tested incrementally. Tasks are organized to validate core functionality early through automated tests.

## Tasks

- [x] 1. Create database migration for Portfolio entity
  - Create Alembic migration file that creates portfolios table with all required fields
  - Add portfolio_id foreign key column to programs table (nullable initially)
  - Create default portfolio with name "Default Portfolio" and populate required fields
  - Update all existing programs to reference the default portfolio
  - Alter portfolio_id column to NOT NULL
  - Add foreign key constraint from programs.portfolio_id to portfolios.id
  - Create indexes on portfolio_id and portfolio name fields
  - Ensure migration is reversible (implement downgrade)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 1.1 Write migration tests
  - Test migration creates portfolios table with correct schema
  - Test migration adds portfolio_id to programs table
  - Test migration creates default portfolio
  - Test migration assigns all programs to default portfolio
  - Test migration rollback works correctly
  - _Requirements: 9.5, 9.6, 9.7_

- [x] 2. Implement Portfolio model and update Program model
  - [x] 2.1 Create Portfolio model in backend/app/models/portfolio.py
    - Define Portfolio class inheriting from BaseModel
    - Add all required fields (name, description, owner, reporting_start_date, reporting_end_date)
    - Add relationship to programs with cascade delete-orphan
    - Add check constraint for date validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 2.2 Update Program model to include portfolio relationship
    - Add portfolio_id foreign key field to Program model
    - Add portfolio relationship to Program model
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.3 Write unit tests for Portfolio model
    - Test portfolio creation with valid data
    - Test audit fields are populated automatically
    - Test date constraint validation
    - Test relationship loading
    - _Requirements: 1.1-1.6, 11.1_


- [x] 3. Implement Portfolio schemas
  - [x] 3.1 Create Portfolio Pydantic schemas in backend/app/schemas/portfolio.py
    - Implement PortfolioBase with all fields and validation
    - Implement PortfolioCreate schema
    - Implement PortfolioUpdate schema with optional fields
    - Implement PortfolioResponse schema with timestamp mixin
    - Implement PortfolioListResponse for pagination
    - Implement PortfolioSummary for brief info
    - Add field validators for date range and string lengths
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 1.11_
  
  - [x] 3.2 Write property test for required field validation
    - **Property 1: Required Field Validation**
    - **Validates: Requirements 1.7, 1.8, 1.9, 1.10, 1.11**
  
  - [x] 3.3 Write property test for API validation errors
    - **Property 7: API Validation Error Responses**
    - **Validates: Requirements 3.6, 3.8**
  
  - [x] 3.4 Write unit tests for Portfolio schemas
    - Test PortfolioCreate validation with valid data
    - Test PortfolioCreate validation with invalid data
    - Test date range validation
    - Test field length validation
    - _Requirements: 1.7-1.11, 11.1_

- [x] 4. Implement Portfolio service layer
  - [x] 4.1 Create PortfolioService in backend/app/services/portfolio.py
    - Implement create_portfolio method with validation
    - Implement get_portfolio method
    - Implement list_portfolios method with pagination
    - Implement update_portfolio method with validation
    - Implement delete_portfolio method with program check
    - Implement search and filter methods
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 4.2 Write property test for portfolio deletion protection
    - **Property 4: Portfolio Deletion Protection**
    - **Validates: Requirements 2.5**
  
  - [x] 4.3 Write property test for portfolio-program relationship
    - **Property 5: Portfolio-Program Relationship Query**
    - **Validates: Requirements 2.6**
  
  - [x] 4.4 Write unit tests for Portfolio service
    - Test create portfolio with valid data
    - Test create portfolio with invalid data raises ValueError
    - Test update portfolio with partial data
    - Test delete portfolio without programs succeeds
    - Test delete portfolio with programs raises ValueError
    - Test list portfolios with pagination
    - Test get portfolio by ID (exists and not exists)
    - _Requirements: 2.5, 11.2_


- [x] 5. Update Program service and schemas for portfolio relationship
  - [x] 5.1 Update Program schemas to include portfolio_id
    - Add portfolio_id field to ProgramCreate schema (required)
    - Add portfolio_id field to ProgramUpdate schema (optional)
    - Add portfolio_id field to ProgramResponse schema
    - Add portfolio field to ProgramResponse for nested data
    - _Requirements: 2.3, 3.10_
  
  - [x] 5.2 Update Program service to handle portfolio relationship
    - Update create_program to require and validate portfolio_id
    - Update create_program to check portfolio exists
    - Update get_program to include portfolio relationship
    - _Requirements: 2.3, 2.4, 2.7_
  
  - [x] 5.3 Write property test for program portfolio association
    - **Property 2: Program Portfolio Association Required**
    - **Validates: Requirements 2.3**
  
  - [x] 5.4 Write property test for portfolio reference integrity
    - **Property 3: Portfolio Reference Integrity**
    - **Validates: Requirements 2.4**
  
  - [x] 5.5 Write property test for program-portfolio relationship
    - **Property 6: Program-Portfolio Relationship Query**
    - **Validates: Requirements 2.7**
  
  - [x] 5.6 Write unit tests for updated Program service
    - Test create program with valid portfolio_id
    - Test create program without portfolio_id fails
    - Test create program with invalid portfolio_id fails
    - Test get program includes portfolio relationship
    - _Requirements: 2.3, 2.4, 2.7, 11.2_

- [x] 6. Checkpoint - Ensure all backend model and service tests pass
  - Run all backend unit tests and property tests
  - Verify database migration works correctly
  - Ensure all tests pass, ask the user if questions arise


- [x] 7. Implement Portfolio API endpoints
  - [x] 7.1 Create Portfolio router in backend/app/api/v1/endpoints/portfolios.py
    - Implement POST / endpoint for creating portfolios
    - Implement GET / endpoint for listing portfolios with pagination
    - Implement GET /{portfolio_id} endpoint for getting portfolio by ID
    - Implement PUT /{portfolio_id} endpoint for updating portfolios
    - Implement DELETE /{portfolio_id} endpoint for deleting portfolios
    - Implement GET /{portfolio_id}/programs endpoint for getting portfolio programs
    - Add proper error handling (400, 404, 409, 403, 500)
    - Add authentication and permission checks
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  
  - [x] 7.2 Register Portfolio router in API
    - Add portfolio router to backend/app/api/v1/api.py
    - Ensure proper URL prefix (/api/v1/portfolios)
    - _Requirements: 3.1-3.5_
  
  - [x] 7.3 Write integration tests for Portfolio API endpoints
    - Test POST /api/v1/portfolios creates portfolio
    - Test GET /api/v1/portfolios lists portfolios
    - Test GET /api/v1/portfolios/{id} gets portfolio
    - Test PUT /api/v1/portfolios/{id} updates portfolio
    - Test DELETE /api/v1/portfolios/{id} deletes portfolio
    - Test GET /api/v1/portfolios/{id}/programs gets programs
    - Test error cases: 404, 400, 409, 403
    - _Requirements: 3.1-3.9, 11.4_

- [x] 8. Update Program API endpoints for portfolio relationship
  - [x] 8.1 Update Program endpoints to include portfolio_id
    - Update POST /api/v1/programs to require portfolio_id
    - Update GET /api/v1/programs/{id} to return portfolio_id and portfolio data
    - Update PUT /api/v1/programs/{id} to allow portfolio_id updates
    - _Requirements: 3.10, 7.1, 7.5, 7.6_
  
  - [x] 8.2 Write integration tests for updated Program API
    - Test create program with valid portfolio_id
    - Test create program without portfolio_id returns 400
    - Test create program with invalid portfolio_id returns 400
    - Test get program includes portfolio data
    - Test update program portfolio_id
    - _Requirements: 7.1-7.6, 11.4_


- [-] 9. Implement permissions and security for Portfolio
  - [x] 9.1 Add Portfolio permissions to permission system
    - Define view_portfolios permission
    - Define create_portfolios permission
    - Define update_portfolios permission
    - Define delete_portfolios permission
    - Add permissions to role definitions
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x] 9.2 Integrate Portfolio with scope-based access control
    - Add portfolio scope checks to permission system
    - Ensure users can only access portfolios within their scope
    - _Requirements: 10.5_
  
  - [x] 9.3 Add audit logging for Portfolio operations
    - Log portfolio create operations
    - Log portfolio update operations
    - Log portfolio delete operations
    - Include user identity and timestamp in logs
    - _Requirements: 10.7, 10.8_
  
  - [x] 9.4 Write integration tests for Portfolio permissions
    - Test create portfolio with and without permission
    - Test read portfolio with and without permission
    - Test update portfolio with and without permission
    - Test delete portfolio with and without permission
    - Test scope-based access control
    - Test audit logging
    - _Requirements: 10.1-10.8, 11.4_

- [x] 10. Checkpoint - Ensure all backend API tests pass
  - Run all backend integration tests
  - Verify API endpoints work correctly
  - Test permission and security features
  - Ensure all tests pass, ask the user if questions arise


- [x] 11. Implement frontend Portfolio types and API client
  - [x] 11.1 Create Portfolio TypeScript types in frontend/src/types/portfolio.ts
    - Define Portfolio interface
    - Define PortfolioCreate interface
    - Define PortfolioUpdate interface
    - Export types
    - _Requirements: 4.1-4.10_
  
  - [x] 11.2 Create Portfolio API client in frontend/src/api/portfolios.ts
    - Implement list method with pagination
    - Implement get method
    - Implement create method
    - Implement update method
    - Implement delete method
    - Implement getPrograms method
    - Add proper error handling
    - _Requirements: 3.1-3.5_
  
  - [x] 11.3 Write unit tests for Portfolio API client
    - Test list portfolios
    - Test get portfolio
    - Test create portfolio
    - Test update portfolio
    - Test delete portfolio
    - Test get portfolio programs
    - Test error handling
    - _Requirements: 11.5_

- [x] 12. Implement Portfolios List Page
  - [x] 12.1 Create PortfoliosListPage component in frontend/src/pages/portfolios/PortfoliosListPage.tsx
    - Implement page layout with title and Create button
    - Implement search/filter bar
    - Implement DataGrid with columns: Portfolio Name, Owner, Reporting Start, Reporting End
    - Format dates using date-fns
    - Implement row hover styling (gray background, blue border)
    - Implement row click navigation to detail page
    - Implement pagination
    - Add scope-based filtering
    - Add permission checks for Create button
    - _Requirements: 4.1-4.10_
  
  - [x] 12.2 Write component tests for PortfoliosListPage
    - Test renders portfolio list
    - Test displays search bar
    - Test displays Create button with permission
    - Test hides Create button without permission
    - Test filters portfolios by search term
    - Test navigates to detail page on row click
    - Test displays formatted dates
    - _Requirements: 4.1-4.10, 11.5_


- [x] 13. Implement Portfolio Detail Page
  - [x] 13.1 Create PortfolioDetailPage component in frontend/src/pages/portfolios/PortfolioDetailPage.tsx
    - Implement breadcrumbs navigation
    - Implement Details tab with read-only fields initially
    - Implement Edit button at bottom right
    - Implement in-place editing mode
    - Implement Save and Cancel buttons in edit mode
    - Implement form validation
    - Implement Programs tab showing associated programs
    - Add permission checks for Edit button
    - Add error handling and success messages
    - _Requirements: 5.1-5.10_
  
  - [x] 13.2 Write component tests for PortfolioDetailPage
    - Test renders portfolio details in read-only mode
    - Test shows Edit button with permission
    - Test hides Edit button without permission
    - Test switches to edit mode on Edit click
    - Test shows Save/Cancel buttons in edit mode
    - Test validates form on save
    - Test reverts changes on cancel
    - Test displays programs tab
    - _Requirements: 5.1-5.10, 11.6_

- [x] 14. Implement Portfolio Form Page
  - [x] 14.1 Create PortfolioFormPage component in frontend/src/pages/portfolios/PortfolioFormPage.tsx
    - Implement form with all required fields
    - Implement date pickers for reporting dates
    - Implement field validation (required, lengths, date range)
    - Implement Submit and Cancel buttons
    - Add error handling and success messages
    - Navigate to detail page on successful creation
    - Navigate to list page on cancel
    - _Requirements: 6.1-6.8_
  
  - [x] 14.2 Write component tests for PortfolioFormPage
    - Test renders form with all fields
    - Test validates required fields
    - Test validates date range
    - Test submits valid form
    - Test displays validation errors
    - Test displays API errors
    - Test navigates on cancel
    - _Requirements: 6.1-6.8, 11.7_


- [x] 15. Update Program Form for Portfolio selection
  - [x] 15.1 Update ProgramFormPage to include Portfolio dropdown
    - Add Portfolio selection dropdown field
    - Fetch and populate dropdown with all portfolios
    - Make portfolio selection required
    - Add validation error display for missing portfolio
    - Update form submission to include portfolio_id
    - _Requirements: 7.1-7.6_
  
  - [x] 15.2 Write component tests for updated ProgramFormPage
    - Test renders portfolio dropdown
    - Test populates dropdown with portfolios
    - Test validates portfolio selection required
    - Test submits with portfolio_id
    - _Requirements: 7.1-7.6, 11.7_

- [x] 16. Update Sidebar navigation
  - [x] 16.1 Add Portfolios navigation item to Sidebar
    - Add "Portfolios" navigation item above "Programs"
    - Use appropriate icon (BusinessCenter or AccountBalance)
    - Add view_portfolios permission check
    - Implement navigation to /portfolios route
    - Highlight when on portfolio pages
    - _Requirements: 8.1-8.5_
  
  - [x] 16.2 Write component tests for updated Sidebar
    - Test renders Portfolios navigation item
    - Test shows Portfolios item with permission
    - Test hides Portfolios item without permission
    - Test navigates to portfolios page on click
    - Test highlights when on portfolio pages
    - _Requirements: 8.1-8.5, 11.5_

- [x] 17. Add routing for Portfolio pages
  - [x] 17.1 Add Portfolio routes to React Router configuration
    - Add route for /portfolios (list page)
    - Add route for /portfolios/new (create page)
    - Add route for /portfolios/:id (detail page)
    - Add route for /portfolios/:id/edit (edit page)
    - Add permission guards for routes
    - _Requirements: 4.1, 5.1, 6.1_


- [x] 18. Checkpoint - Ensure all frontend component tests pass
  - Run all frontend component tests
  - Verify all Portfolio pages render correctly
  - Test navigation between pages
  - Ensure all tests pass, ask the user if questions arise

- [x] 19. Write end-to-end tests for Portfolio CRUD
  - [x] 19.1 Write E2E test for Portfolio creation flow
    - Test complete flow: navigate to create page → fill form → submit → verify in list
    - _Requirements: 11.8_
  
  - [x] 19.2 Write E2E test for Portfolio view and edit flow
    - Test complete flow: select portfolio → view details → edit → save → verify changes
    - _Requirements: 11.8_
  
  - [x] 19.3 Write E2E test for Portfolio deletion
    - Test delete portfolio without programs succeeds
    - Test delete portfolio with programs fails with error message
    - _Requirements: 11.8_
  
  - [x] 19.4 Write E2E test for Program creation with Portfolio
    - Test complete flow: navigate to create program → select portfolio → submit → verify
    - _Requirements: 11.8_

- [x] 20. Final integration and documentation
  - [x] 20.1 Update API documentation
    - Document all Portfolio endpoints in API docs
    - Add request/response examples
    - Document error codes and messages
    - _Requirements: 3.1-3.9_
  
  - [x] 20.2 Update user documentation
    - Document Portfolio feature in user guide
    - Add screenshots of Portfolio pages
    - Document Portfolio-Program relationship
    - Document migration process for existing data
    - _Requirements: 1.1-11.10_
  
  - [x] 20.3 Verify database migration on test environment
    - Run migration on test database with existing data
    - Verify default portfolio is created
    - Verify all programs are assigned to default portfolio
    - Verify rollback works correctly
    - _Requirements: 9.1-9.7_

- [x] 21. Final checkpoint - Complete system verification
  - Run full test suite (backend + frontend)
  - Verify all features work end-to-end
  - Test with different user roles and permissions
  - Verify scope-based access control
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate API endpoints and component interactions
- E2E tests validate complete user workflows
