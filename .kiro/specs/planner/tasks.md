# Implementation Plan

- [x] 1. Set up project structure and core infrastructure
  - Create FastAPI project structure with proper directory organization
  - Set up SQLAlchemy with PostgreSQL connection and configuration
  - Configure Alembic for database migrations
  - Set up pytest testing framework with fixtures
  - Create Docker configuration for development environment
  - Create Docker Compose setup for local development with PostgreSQL and Redis
  - Add environment configuration for local vs production deployment
  - _Requirements: All requirements need foundational infrastructure_

- [x] 2. Implement core data models and database schema
  - [x] 2.1 Create base model classes and database utilities
    - Implement BaseModel with UUID primary keys and timestamps
    - Create database session management and connection utilities
    - Set up Alembic migration configuration
    - _Requirements: 1.1, 2.1, 5.1, 5.3, 6.1_

  - [x] 2.2 Implement Program model and repository
    - Create Program SQLAlchemy model with all required fields
    - Implement ProgramRepository with CRUD operations
    - Add validation for date constraints (start_date < end_date)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.3 Implement Project and ProjectPhase models
    - Create Project SQLAlchemy model with program relationship
    - Create ProjectPhase model for planning/execution phases
    - Implement budget validation (capital + expense = total)
    - Add ProjectRepository with phase management
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.4 Implement Resource, Worker, and WorkerType models
    - Create Resource model for both labor and non-labor resources
    - Create Worker model with external_id and worker_type relationship
    - Create WorkerType model with flexible configuration
    - Implement ResourceRepository and WorkerRepository
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.5 Implement Rate model with temporal validity
    - Create Rate model with start_date/end_date for historical rates
    - Implement rate update logic that closes previous rates
    - Create RateRepository with temporal query methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.6 Implement ResourceAssignment and Actual models
    - Create ResourceAssignment model with allocation and accounting percentages
    - Create updated Actual model with project_id and worker information
    - Add validation constraints for percentage ranges (0-100%)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 8.3_

  - [x] 2.7 Implement User, UserRole, ScopeAssignment and AuditLog models
    - Create User model with authentication fields (removed JSON roles)
    - Create UserRole model for role assignments with activation status
    - Create ScopeAssignment model for program/project-level scoping
    - Create AuditLog model for tracking all data modifications
    - Set up audit triggers for automatic change tracking
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 3. Implement core business services with scope-aware filtering
  - [x] 3.1 Create ProgramService with scope-aware business logic
    - Implement program CRUD operations with validation
    - Add program-project relationship management
    - Create program listing and filtering capabilities with scope filtering
    - Integrate with ScopeValidatorService for access control
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.5_

  - [x] 3.2 Create ProjectService and PhaseService with scope filtering
    - Implement project CRUD with program association validation
    - Create phase management (planning/execution) with budget tracking
    - Add project lifecycle management and validation
    - Add scope-based project filtering and access control
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2, 9.3, 9.4, 9.5, 11.5_

  - [x] 3.3 Create ResourceService and WorkerService with scope awareness
    - Implement resource management for labor and non-labor types
    - Create worker management with type associations
    - Add worker type configuration and rate management
    - Add scope-based filtering for resource access
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 11.5_

  - [x] 3.4 Create AssignmentService with allocation validation and scope filtering
    - Implement resource assignment creation with conflict detection
    - Add allocation percentage validation (≤100% per day per resource)
    - Create assignment import functionality with validation
    - Add scope-based assignment filtering and access control
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 11.5_

- [x] 4. Implement actuals import and validation system
  - [x] 4.1 Create ActualsImportService
    - Implement CSV parsing for actuals data format
    - Add data validation (project existence, worker validation, date format)
    - Create batch processing with transaction management
    - _Requirements: 8.3_

  - [x] 4.2 Create AllocationValidatorService
    - Implement daily allocation limit validation (≤100% per worker per day)
    - Add cross-project allocation checking
    - Create conflict detection for existing vs new actuals
    - _Requirements: 3.2, 3.3_

  - [x] 4.3 Create ActualsService with cost calculation
    - Implement actual record creation with rate lookup
    - Add capital/expense ratio application from assignments
    - Create cost calculation based on worker rates and percentages
    - _Requirements: 8.1, 8.3, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.4 Create VarianceAnalysisService
    - Implement actual vs forecast comparison logic
    - Add variance calculation and exception identification
    - Create variance reporting with configurable thresholds
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 5. Implement forecasting and reporting services with scope filtering
  - [x] 5.1 Create ForecastingService with scope-aware calculations
    - Implement cost projection based on resource assignments
    - Add capital/expense breakdown calculations
    - Create budget vs actual vs forecast reporting
    - Add scope-based filtering for forecasting data
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 11.5_

  - [x] 5.2 Create ReportingService with scope-aware data
    - Implement real-time budget vs actual vs forecast reports
    - Add program and project level aggregation
    - Create variance analysis reports with drill-down capabilities
    - Add scope-based report filtering and access control
    - _Requirements: 8.1, 8.2, 8.5, 11.5_

- [x] 6. Implement authentication and authorization with scoped permissions
  - [x] 6.1 Create AuthenticationService
    - Implement JWT token-based authentication
    - Add user login, logout, and token refresh functionality
    - Create password hashing and validation
    - _Requirements: 7.5, 10.1, 10.4_

  - [x] 6.2 Create ScopeValidatorService
    - Implement user scope resolution (program/project access)
    - Add scope inheritance logic (program scope includes all projects)
    - Create multi-scope combination handling
    - Add scope-based data filtering utilities
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 6.3 Create AuthorizationService with RBAC and scoping
    - Implement role-based access control system
    - Add program-level and project-level scope restrictions
    - Create permission checking middleware for API endpoints
    - Integrate with ScopeValidatorService for access control
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 6.4 Create RoleManagementService
    - Implement user role assignment and management
    - Add scope assignment creation and modification
    - Create role switching functionality for multi-role users
    - Add scope validation and conflict detection
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 6.5 Create PermissionCacheService
    - Implement Redis-based permission caching
    - Add scope resolution caching for performance
    - Create cache invalidation on role/scope changes
    - Add bulk cache refresh for organizational changes
    - _Requirements: 11.4, 11.5_

  - [x] 6.6 Create AuditService
    - Implement automatic audit trail creation for all data changes
    - Add before/after value capture with user attribution
    - Create audit log querying and reporting capabilities
    - Add permission change auditing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.6_

- [ ] 7. Implement REST API controllers and schemas
  - [x] 7.0 Create Pydantic schemas for request/response validation
    - Create base schemas with common patterns
    - Implement Program schemas (create, update, response)
    - Implement Project schemas with phase information
    - Implement Resource and Worker schemas
    - Implement Assignment schemas with validation
    - Implement Actuals schemas for import and response
    - Implement User and authentication schemas
    - Implement Report and forecast response schemas
    - _Requirements: All requirements need API validation_

  - [x] 7.1 Create Program API endpoints
    - Implement GET, POST, PUT, DELETE for programs
    - Add program listing with filtering and pagination
    - Create program-project relationship endpoints
    - Add scope-based filtering middleware
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.5_

  - [x] 7.2 Create Project API endpoints
    - Implement full CRUD operations for projects
    - Add project phase management endpoints
    - Create project-specific reporting endpoints
    - Add scope-based access control
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2, 9.3, 9.4, 9.5, 11.5_

  - [x] 7.3 Create Resource and Worker API endpoints
    - Implement resource management endpoints
    - Add worker and worker type CRUD operations
    - Create rate management endpoints with temporal queries
    - Add scope-based filtering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 11.5_

  - [x] 7.4 Create Assignment API endpoints
    - Implement resource assignment CRUD operations
    - Add assignment import endpoint with validation
    - Create assignment conflict checking endpoints
    - Add scope-based access control
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 11.5_

  - [x] 7.5 Create Actuals API endpoints
    - Implement actuals CRUD operations
    - Add actuals import endpoint with CSV processing
    - Create variance analysis endpoints
    - Add scope-based filtering
    - _Requirements: 8.3, 11.5_

  - [x] 7.6 Create Forecasting and Reporting API endpoints
    - Implement forecasting calculation endpoints
    - Add budget vs actual vs forecast reporting endpoints
    - Create variance analysis and exception reporting endpoints
    - Add scope-based report filtering
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 11.5_

  - [ ] 7.7 Create Authentication, User Management and Audit API endpoints
    - Implement login, logout, and token refresh endpoints
    - Add user management endpoints with role assignment
    - Create role and scope management endpoints
    - Add role switching and scope selection endpoints
    - Add audit trail querying endpoints
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 7.8 Add API authentication and authorization middleware
    - Implement JWT token validation middleware
    - Add role-based permission checking decorators
    - Create scope validation middleware for endpoints
    - Add rate limiting and security headers
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.5, 11.6_

- [ ] 8. Implement frontend application with scoped permissions
  - [ ] 8.1 Set up React frontend project structure
    - Create React + TypeScript project with Vite or Create React App
    - Set up Material-UI design system
    - Configure Redux Toolkit for state management
    - Set up React Query for API data fetching
    - Configure routing with React Router
    - Add authentication context and protected routes
    - _Requirements: All requirements need frontend interface_

  - [ ] 8.2 Create authentication and user profile components
    - Implement login and logout pages
    - Create user profile header with role/scope display
    - Add role switching dropdown with scope context
    - Implement JWT token management and refresh
    - Add protected route wrapper component
    - _Requirements: 7.5, 10.1, 10.4, 11.1, 11.2, 11.3, 11.4_

  - [ ] 8.3 Create program and project management UI
    - Implement program list and detail views
    - Create project list and detail views with phases
    - Add program/project creation and edit forms
    - Implement scope-based filtering for lists
    - Add budget visualization components
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2, 9.3, 9.4, 9.5, 11.5_

  - [ ] 8.4 Create resource and worker management UI
    - Implement resource list and detail views
    - Create worker management interface
    - Add worker type and rate management UI
    - Implement resource assignment calendar view
    - Add allocation conflict visualization
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 8.5 Create actuals import and variance analysis UI
    - Implement CSV upload interface with drag-and-drop
    - Create actuals import wizard with validation feedback
    - Add variance analysis dashboard
    - Implement allocation conflict resolution UI
    - Create variance reports with drill-down capabilities
    - _Requirements: 8.3, 8.1, 8.2, 8.5_

  - [ ] 8.6 Create reporting and forecasting dashboards
    - Implement budget vs actual vs forecast dashboard
    - Create resource utilization reports and heatmaps
    - Add time-series charts for cost tracking
    - Implement drill-down reporting capabilities
    - Create export functionality for reports (PDF, Excel)
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ] 8.7 Create admin interfaces for user and role management
    - Implement user management interface with role assignment
    - Add scope assignment interface for programs and projects
    - Create role switching and permission management UI
    - Add audit trail viewing for permission changes
    - Implement permission-based UI element visibility
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7_

  - [ ] 8.8 Implement scope-aware navigation and filtering
    - Add scope-based menu filtering and navigation
    - Implement automatic data filtering by user scope
    - Create scope context breadcrumbs and indicators
    - Add permission-based button and action states
    - Implement visual feedback for insufficient permissions
    - _Requirements: 11.5, 11.6_

- [ ] 9. Add comprehensive error handling and validation
  - [ ] 9.1 Implement API error handling middleware with scope validation
    - Create standardized error response format
    - Add validation error handling with detailed messages
    - Implement business rule violation error responses
    - Add scope-based authorization error handling
    - Create custom exception classes for different error types
    - _Requirements: All requirements need proper error handling, 11.6_

  - [ ] 9.2 Add input validation and sanitization with permission checks
    - Ensure Pydantic models validate all request inputs
    - Add business rule validation at service layer
    - Create comprehensive validation error messages
    - Add scope-based validation for data access
    - Implement SQL injection prevention
    - _Requirements: All requirements need input validation, 11.5, 11.6_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create database migrations and seed data with scoped permissions
  - [ ] 11.1 Create initial database migration with scoped permissions schema
    - Generate Alembic migration for all models including UserRole and ScopeAssignment
    - Add database constraints and indexes for permission tables
    - Create migration scripts for production deployment
    - Add indexes for scope-based queries and performance optimization
    - Test migration rollback functionality
    - _Requirements: All requirements need database schema, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 11.2 Create seed data and test fixtures with role/scope assignments
    - Implement sample programs, projects, and workers
    - Add test data for resource assignments and rates
    - Create development environment seed data
    - Add sample users with various role and scope assignments
    - Create test scenarios for multi-scope users
    - Add seed data script for easy database reset
    - _Requirements: All requirements benefit from test data, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 12. Final integration and testing with scoped permissions
  - [ ] 12.1 Create end-to-end integration tests
    - Test complete program and project creation workflows with scope restrictions
    - Validate resource assignment and actuals import workflows with permissions
    - Test forecasting and reporting functionality with scope filtering
    - Test role switching and scope assignment workflows
    - Create integration tests for API endpoints with authentication
    - Test error handling and edge cases across the system
    - _Requirements: All requirements need integration testing, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 12.2 Performance optimization and caching with permission caching
    - Verify Redis caching for frequently accessed data
    - Optimize database queries with proper indexing
    - Implement query optimization for reporting endpoints
    - Verify permission and scope resolution caching
    - Optimize scope-based query performance
    - Add database query profiling and optimization
    - _Requirements: 8.1, 8.2, 8.5 (reporting performance), 11.4, 11.5_

  - [ ] 12.3 Security audit and penetration testing
    - Test authentication and authorization security
    - Verify scope isolation between users
    - Test for SQL injection vulnerabilities
    - Verify CSRF protection on state-changing endpoints
    - Test rate limiting and DDoS protection
    - Audit sensitive data exposure in logs and errors
    - _Requirements: 7.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.6_

- [ ] 13. Create containerization and deployment configuration
  - [ ] 13.1 Enhance Docker configuration for production
    - Review and optimize existing Dockerfile for production use
    - Verify Docker Compose configuration includes all services
    - Add production environment variable configuration
    - Enhance health checks and service dependencies
    - Verify local development scripts work correctly
    - _Requirements: All requirements need local development environment_

  - [ ] 13.2 Create production deployment documentation
    - Document production environment setup
    - Create deployment runbook with step-by-step instructions
    - Document database migration procedures
    - Add monitoring and logging configuration guide
    - Create troubleshooting guide for common issues
    - _Requirements: All requirements need production deployment_

  - [ ] 13.3 Create AWS ECS Fargate deployment configuration
    - Create ECS task definitions for FastAPI application
    - Add ECS service configuration with load balancer integration
    - Configure AWS RDS PostgreSQL for production database
    - Set up AWS ElastiCache Redis for production caching
    - Create CloudFormation or Terraform templates for infrastructure
    - Add AWS secrets management for environment variables
    - Configure VPC, security groups, and networking
    - Set up CloudWatch logging and monitoring
    - _Requirements: All requirements need production AWS deployment_

  - [ ] 13.4 Create CI/CD pipeline configuration
    - Add GitHub Actions workflow for automated testing
    - Create Docker image build and push to ECR
    - Add automated deployment to ECS Fargate
    - Configure environment-specific deployments (staging/production)
    - Add database migration automation in deployment pipeline
    - Implement automated rollback on deployment failure
    - _Requirements: All requirements need automated deployment_

- [ ] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.