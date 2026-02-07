# Program and Project Management System

A comprehensive enterprise application for managing hierarchical programs and projects with sophisticated resource allocation, budget tracking, and cost forecasting capabilities.

## Features

- **Portfolio Management**: Top-level organizational entity for grouping programs under strategic initiatives
- **Hierarchical Program/Project Management**: Organize projects under programs with complete lifecycle tracking (Portfolio → Program → Project)
- **User-Definable Project Phases**: Flexible timeline management with continuous, non-overlapping phases (replaces fixed Planning/Execution)
- **Resource Allocation**: Manage both labor and non-labor resources with conflict detection
- **Budget Tracking**: Capital/expense splits with real-time budget vs actual reporting
- **Actuals Import**: CSV-based import with allocation validation and variance analysis
- **Cost Forecasting**: Dynamic cost projections based on resource assignments and rates
- **Scoped Permissions**: Role-based access control with portfolio, program-level and project-level scoping
- **Comprehensive Audit Trails**: Track all data modifications with user attribution
- **Variance Analysis**: Compare actual vs forecasted allocations with exception reporting

## Technology Stack

### Backend
- **FastAPI**: High-performance REST API framework
- **PostgreSQL**: ACID-compliant database with complex query support
- **SQLAlchemy**: Database ORM with migration support
- **Redis**: Caching and session management
- **JWT**: Token-based authentication
- **Celery**: Background task processing

### Frontend
- **React**: Modern UI framework with TypeScript
- **Material-UI**: Consistent design system
- **Redux Toolkit**: State management
- **React Query**: Server state management
- **Chart.js**: Financial reporting visualizations

### Infrastructure
- **Docker**: Containerized development and deployment
- **AWS ECS Fargate**: Serverless container orchestration
- **AWS RDS**: Managed PostgreSQL database
- **AWS ElastiCache**: Managed Redis caching
- **GitHub Actions**: CI/CD pipeline

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/skraps68/planner.git
   cd planner
   ```

2. **Start the development environment**
   ```bash
   make start
   # or
   ./scripts/start-dev.sh
   ```

3. **Run database migrations** (when models are created)
   ```bash
   make migrate
   ```

4. **Access the application**
   - API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - API Documentation (ReDoc): http://localhost:8000/redoc
   - Frontend: http://localhost:3000 (when implemented)

5. **Run tests**
   ```bash
   make test
   ```

6. **Stop the environment**
   ```bash
   make stop
   ```

### Production Deployment

The application is designed for deployment on AWS ECS Fargate with:
- Managed RDS PostgreSQL database
- ElastiCache Redis cluster
- Application Load Balancer
- CloudWatch monitoring
- Secrets Manager for configuration

See the deployment documentation for detailed setup instructions.

## Project Structure

```
planner/
├── .kiro/specs/                 # Project specifications
│   ├── planner/                 # Original planner spec
│   ├── portfolio-entity/        # Portfolio management spec
│   ├── user-definable-phases/   # Phase system redesign spec
│   └── portfolio-dashboard/     # Portfolio dashboard spec
├── backend/                     # FastAPI application
│   ├── app/                     # Application code
│   │   ├── api/                 # API endpoints
│   │   ├── core/                # Core configuration
│   │   ├── db/                  # Database configuration
│   │   ├── models/              # SQLAlchemy models
│   │   ├── services/            # Business logic
│   │   ├── repositories/        # Data access layer
│   │   └── main.py             # FastAPI app entry point
│   ├── docs/                    # API documentation
│   │   ├── README.md           # Documentation index
│   │   ├── PORTFOLIO_API.md    # Portfolio management API
│   │   ├── PHASE_API.md        # Phase management API
│   │   └── ...                 # Other documentation
│   ├── tests/                   # Test suite
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt         # Python dependencies
│   └── pytest.ini             # Test configuration
├── frontend/                    # React application
├── docs/                        # User documentation
│   ├── PORTFOLIO_USER_GUIDE.md # Portfolio feature guide
│   └── deployment/             # Deployment documentation
├── scripts/                     # Development scripts
├── infrastructure/              # AWS deployment configs
├── docker-compose.yml           # Local development setup
├── Dockerfile                   # Container configuration
├── Makefile                     # Development commands
└── README.md                   # This file
```

## Development Workflow

This project follows a spec-driven development approach:

1. **Requirements**: Business requirements with EARS-compliant acceptance criteria
2. **Design**: Technical architecture and data models
3. **Tasks**: Detailed implementation plan with incremental progress
4. **Implementation**: Code development following the task list
5. **Testing**: Comprehensive unit and integration testing
6. **Deployment**: Containerized deployment to AWS

## Key Business Capabilities

### Portfolio Management (NEW)
- **Strategic Organization**: Group programs under portfolio umbrellas
- **Executive Visibility**: High-level views of major initiatives
- **Portfolio-Program Relationship**: One-to-many relationship with referential integrity
- **Deletion Protection**: Prevent accidental deletion of portfolios with programs
- **Scope-Based Access**: Control access at portfolio, program, and project levels
- **Audit Logging**: Track all portfolio operations with user attribution

### Program Management
- Create and manage programs with essential attributes
- Associate programs with portfolios for strategic alignment
- Associate multiple projects under program umbrellas
- Program-level budget aggregation and reporting

### Project Management
- Comprehensive project attributes and lifecycle management
- **User-definable phases** with flexible timeline management
- Date-based phase relationships with resource assignments
- Project-specific resource assignments and cost tracking

### Phase Management (NEW)
- **Flexible Phase Definition**: Create custom phases with any names and date ranges
- **Timeline Continuity**: Automatic validation ensures phases cover entire project timeline
- **No Gaps or Overlaps**: System enforces continuous, non-overlapping phase timelines
- **Date-Based Relationships**: Assignments implicitly associated with phases by date
- **Batch Operations**: Atomic updates for all phases in a project
- **Default Phase**: Automatically created for new projects, syncs with project dates

### Resource Management
- Worker management with types and historical rates
- Resource assignment with allocation percentage validation
- Conflict detection preventing over-allocation

### Financial Management
- Capital/expense treatment for resource assignments
- Dynamic cost forecasting based on assignments and rates
- Budget vs actual vs forecast reporting
- Variance analysis with configurable thresholds

### Actuals Import System
- CSV-based import with comprehensive validation
- Allocation limit enforcement (≤100% per worker per day)
- Automatic cost calculation with capital/expense ratios
- Variance reporting comparing actual vs planned work

### Scoped Permissions
- Role-based access control (Admin, Portfolio Manager, Program Manager, Project Manager, etc.)
- Portfolio-level scope (access to portfolio + all its programs and projects)
- Program-level scope (access to program + all its projects)
- Project-level scope (access to specific projects only)
- Multi-scope support for complex organizational structures

## Contributing

1. Review the specifications in `.kiro/specs/`
2. Check the API documentation in `backend/docs/`
3. Follow the implementation tasks in the relevant `tasks.md`
4. Ensure all tests pass before submitting changes
5. Follow the established coding standards and patterns

## Documentation

### User Guides
- **Portfolio Management**: [docs/PORTFOLIO_USER_GUIDE.md](docs/PORTFOLIO_USER_GUIDE.md)

### API Documentation
- **Interactive Swagger UI**: http://localhost:8000/docs
- **ReDoc Format**: http://localhost:8000/redoc
- **Documentation Index**: [backend/docs/API_DOCUMENTATION_INDEX.md](backend/docs/API_DOCUMENTATION_INDEX.md)
- **Portfolio Management API**: [backend/docs/PORTFOLIO_API.md](backend/docs/PORTFOLIO_API.md)
- **Phase Management API**: [backend/docs/PHASE_API.md](backend/docs/PHASE_API.md)
- **Quick Reference**: [backend/docs/PHASE_API_QUICK_REFERENCE.md](backend/docs/PHASE_API_QUICK_REFERENCE.md)

### Migration Guides
- **Phase Migration**: [backend/docs/PHASE_MIGRATION_RUNBOOK.md](backend/docs/PHASE_MIGRATION_RUNBOOK.md)
- **Database Migrations**: [docs/deployment/DATABASE_MIGRATIONS.md](docs/deployment/DATABASE_MIGRATIONS.md)

### Development Guides
- **Local Development**: [LOCAL_DEVELOPMENT_GUIDE.md](LOCAL_DEVELOPMENT_GUIDE.md)
- **Deployment**: [docs/deployment/](docs/deployment/)
- **Error Handling**: [backend/docs/ERROR_HANDLING_GUIDE.md](backend/docs/ERROR_HANDLING_GUIDE.md)

## License

[License information to be added]

## Support

[Support information to be added]