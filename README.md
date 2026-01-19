# Program and Project Management System

A comprehensive enterprise application for managing hierarchical programs and projects with sophisticated resource allocation, budget tracking, and cost forecasting capabilities.

## Features

- **Hierarchical Program/Project Management**: Organize projects under programs with complete lifecycle tracking
- **Resource Allocation**: Manage both labor and non-labor resources with conflict detection
- **Budget Tracking**: Capital/expense splits with real-time budget vs actual reporting
- **Actuals Import**: CSV-based import with allocation validation and variance analysis
- **Cost Forecasting**: Dynamic cost projections based on resource assignments and rates
- **Scoped Permissions**: Role-based access control with program-level and project-level scoping
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
├── .kiro/specs/planner/          # Project specifications
│   ├── requirements.md           # Business requirements
│   ├── design.md                # Technical design
│   └── tasks.md                 # Implementation plan
├── backend/                     # FastAPI application
│   ├── app/                     # Application code
│   │   ├── api/                 # API endpoints
│   │   ├── core/                # Core configuration
│   │   ├── db/                  # Database configuration
│   │   ├── models/              # SQLAlchemy models
│   │   ├── services/            # Business logic
│   │   ├── repositories/        # Data access layer
│   │   └── main.py             # FastAPI app entry point
│   ├── tests/                   # Test suite
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt         # Python dependencies
│   └── pytest.ini             # Test configuration
├── scripts/                     # Development scripts
├── frontend/                    # React application (to be created)
├── infrastructure/              # AWS deployment configs (to be created)
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

### Program Management
- Create and manage programs with essential attributes
- Associate multiple projects under program umbrellas
- Program-level budget aggregation and reporting

### Project Management
- Comprehensive project attributes and lifecycle management
- Planning and execution phases with separate budgets
- Project-specific resource assignments and cost tracking

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
- Role-based access control (Admin, Program Manager, Project Manager, etc.)
- Program-level scope (access to program + all its projects)
- Project-level scope (access to specific projects only)
- Multi-scope support for complex organizational structures

## Contributing

1. Review the specifications in `.kiro/specs/planner/`
2. Follow the implementation tasks in `tasks.md`
3. Ensure all tests pass before submitting changes
4. Follow the established coding standards and patterns

## License

[License information to be added]

## Support

[Support information to be added]