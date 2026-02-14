# Requirements Document: Optimistic Locking Concurrency Control

## Introduction

This specification defines the implementation of optimistic locking concurrency control for all user-editable data entities in the system. The current "last write wins" approach allows silent data loss when multiple users simultaneously edit the same entity. Optimistic locking will prevent this by detecting concurrent modifications and requiring explicit conflict resolution.

## Glossary

- **Optimistic_Locking**: A concurrency control mechanism that assumes conflicts are rare and checks for conflicts only at commit time using version numbers
- **Version_Column**: An integer column that automatically increments on each update, used to detect concurrent modifications
- **Stale_Data_Error**: An exception raised when an update attempts to modify a row whose version has changed since it was read
- **Conflict_Resolution**: The process by which a user resolves differences between their changes and another user's changes
- **User_Editable_Entity**: Any database entity that can be modified through the user interface by end users
- **Backend_API**: The FastAPI application layer that handles HTTP requests and business logic
- **ORM**: SQLAlchemy Object-Relational Mapper used for database operations
- **Database_Layer**: PostgreSQL database and SQLite test database

## Requirements

### Requirement 1: Version Tracking Infrastructure

**User Story:** As a system architect, I want version tracking on all user-editable entities, so that the system can detect concurrent modifications.

#### Acceptance Criteria

1. THE System SHALL add a version column to all user-editable entities (Portfolios, Programs, Projects, Project_Phases, Resources, Worker_Types, Workers, Resource_Assignments, Rates, Actuals, Users, User_Roles, Scope_Assignments)
2. WHEN a new entity is created, THE System SHALL initialize the version column to 1
3. WHEN an entity is updated, THE System SHALL automatically increment the version column
4. THE System SHALL use SQLAlchemy's version_id_col feature for automatic version management
5. THE System SHALL ensure version columns work identically in both PostgreSQL and SQLite

### Requirement 2: Version Validation on Updates

**User Story:** As a developer, I want the system to validate version numbers on every update, so that concurrent modifications are detected.

#### Acceptance Criteria

1. WHEN an update request is received, THE Backend_API SHALL require a version number in the request payload
2. WHEN the provided version matches the database version, THE System SHALL allow the update to proceed
3. WHEN the provided version does not match the database version, THE ORM SHALL raise a Stale_Data_Error
4. WHEN a Stale_Data_Error occurs, THE Backend_API SHALL catch the exception and return HTTP 409 Conflict
5. THE System SHALL perform version checking atomically within the database transaction

### Requirement 3: API Response Version Inclusion

**User Story:** As a frontend developer, I want version numbers included in all API responses, so that I can send them back with update requests.

#### Acceptance Criteria

1. WHEN any user-editable entity is returned via API, THE Backend_API SHALL include the version field in the response
2. THE System SHALL include version numbers in list responses for all entities
3. THE System SHALL include version numbers in detail/get responses for individual entities
4. THE System SHALL include version numbers in create responses for newly created entities
5. THE System SHALL ensure version fields are documented in API schemas

### Requirement 4: Conflict Error Responses

**User Story:** As a frontend developer, I want clear, structured error responses for version conflicts, so that I can display helpful messages to users.

#### Acceptance Criteria

1. WHEN a version conflict occurs, THE Backend_API SHALL return HTTP status code 409 Conflict
2. WHEN a version conflict occurs, THE Backend_API SHALL include the current entity state in the error response
3. WHEN a version conflict occurs, THE Backend_API SHALL include the attempted changes in the error response
4. WHEN a version conflict occurs, THE Backend_API SHALL include a user-friendly error message
5. THE Backend_API SHALL return conflict responses in a consistent JSON structure across all endpoints

### Requirement 5: Migration and Backwards Compatibility

**User Story:** As a database administrator, I want existing data to be migrated safely, so that the system continues functioning during the rollout.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL add version columns to all user-editable entity tables
2. WHEN the migration runs, THE System SHALL set version=1 for all existing rows
3. WHEN the migration runs, THE System SHALL set version columns as NOT NULL with default value 1
4. THE System SHALL ensure the migration is reversible for rollback scenarios
5. THE System SHALL complete the migration without requiring application downtime

### Requirement 6: Frontend Conflict Handling

**User Story:** As a user, I want to see clear messages when my changes conflict with another user's changes, so that I can understand what happened and decide how to proceed.

#### Acceptance Criteria

1. WHEN a 409 Conflict response is received, THE Frontend SHALL display a user-friendly error message
2. WHEN a conflict occurs, THE Frontend SHALL show what the user attempted to change
3. WHEN a conflict occurs, THE Frontend SHALL show the current state of the entity
4. WHEN a conflict occurs, THE Frontend SHALL provide options to refresh and retry or cancel
5. THE Frontend SHALL not silently retry failed updates without user acknowledgment

### Requirement 7: High-Concurrency Entity Protection

**User Story:** As a system administrator, I want Resource_Assignments to be protected from concurrent modifications, so that calendar operations don't result in data loss.

#### Acceptance Criteria

1. WHEN multiple users edit the same Resource_Assignment simultaneously, THE System SHALL detect the conflict
2. WHEN a Resource_Assignment conflict occurs, THE System SHALL prevent the second update from silently overwriting the first
3. WHEN Resource_Assignment bulk updates occur, THE System SHALL validate versions for each assignment individually
4. THE System SHALL ensure Resource_Assignment version checking does not significantly degrade calendar performance
5. WHEN a Resource_Assignment conflict occurs in a bulk operation, THE System SHALL report which specific assignments failed

### Requirement 8: Comprehensive Testing

**User Story:** As a quality assurance engineer, I want comprehensive tests for concurrent update scenarios, so that I can verify the system prevents data loss.

#### Acceptance Criteria

1. THE System SHALL include unit tests that verify version increments on updates
2. THE System SHALL include unit tests that verify Stale_Data_Error is raised on version mismatch
3. THE System SHALL include integration tests that simulate concurrent updates
4. THE System SHALL include tests for all 13 user-editable entity types
5. THE System SHALL include tests that verify 409 Conflict responses are returned correctly
6. THE System SHALL include tests that verify conflict response payloads contain required information
7. THE System SHALL run all tests against both PostgreSQL and SQLite

### Requirement 9: Performance Requirements

**User Story:** As a system administrator, I want optimistic locking to have minimal performance impact, so that user experience is not degraded.

#### Acceptance Criteria

1. WHEN version checking is enabled, THE System SHALL not increase average response time by more than 5%
2. THE System SHALL use database indexes on version columns where beneficial
3. THE System SHALL not require additional database round trips for version checking
4. WHEN bulk updates occur, THE System SHALL validate versions efficiently in batch operations
5. THE System SHALL ensure version column updates do not trigger unnecessary database locks

### Requirement 10: Error Recovery and Logging

**User Story:** As a system administrator, I want version conflicts to be logged, so that I can monitor concurrency patterns and troubleshoot issues.

#### Acceptance Criteria

1. WHEN a version conflict occurs, THE System SHALL log the conflict with entity type and ID
2. WHEN a version conflict occurs, THE System SHALL log the expected and actual version numbers
3. WHEN a version conflict occurs, THE System SHALL log the user who attempted the update
4. THE System SHALL not log sensitive data in conflict logs
5. THE System SHALL provide metrics on conflict frequency for monitoring
