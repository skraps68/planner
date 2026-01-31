# Backend Documentation

Welcome to the backend documentation for the Program and Project Management System.

## Quick Links

### API Documentation
- **[API Documentation Index](./API_DOCUMENTATION_INDEX.md)** - Complete index of all API documentation
- **[Phase Management API](./PHASE_API.md)** - User-definable project phases (NEW)
- **[Resource & Worker API](./RESOURCE_WORKER_API.md)** - Resource and worker management
- **Interactive Docs**: `http://localhost:8000/docs` (Swagger UI)

### Migration & Operations
- **[Phase Migration Runbook](./PHASE_MIGRATION_RUNBOOK.md)** - Migrate to user-definable phases
- **[Migration Task 14 Summary](./MIGRATION_TASK_14_SUMMARY.md)** - Phase migration completion status
- **[Staging Migration Status](./STAGING_MIGRATION_STATUS.md)** - Staging environment migration tracking
- **[Staging Migration Checklist](./STAGING_MIGRATION_CHECKLIST.md)** - Pre-deployment checklist

### Architecture & Design
- **[Error Handling Guide](./ERROR_HANDLING_GUIDE.md)** - Error handling patterns and best practices
- **[Middleware Documentation](./MIDDLEWARE_DOCUMENTATION.md)** - Security, rate limiting, and audit logging
- **[Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)** - Database and query optimization
- **[Security Audit](./SECURITY_AUDIT.md)** - Security best practices and audit results

### Database
- **[Database Compatibility](./DATABASE_COMPATIBILITY.md)** - PostgreSQL and SQLite compatibility
- **[Database Compatibility Summary](./DATABASE_COMPATIBILITY_SUMMARY.md)** - Quick reference

## Getting Started

### For API Consumers

1. **Start the API**: See [LOCAL_DEVELOPMENT_GUIDE.md](../../LOCAL_DEVELOPMENT_GUIDE.md)
2. **Access Interactive Docs**: Navigate to `http://localhost:8000/docs`
3. **Authenticate**: Use the `/api/v1/auth/login` endpoint to get a JWT token
4. **Explore Endpoints**: Use the Swagger UI to test endpoints interactively

### For Developers

1. **Read the Architecture Docs**: Start with [Error Handling Guide](./ERROR_HANDLING_GUIDE.md) and [Middleware Documentation](./MIDDLEWARE_DOCUMENTATION.md)
2. **Understand Phase Management**: Review [PHASE_API.md](./PHASE_API.md) for the latest phase system
3. **Review Migration Guides**: Check [PHASE_MIGRATION_RUNBOOK.md](./PHASE_MIGRATION_RUNBOOK.md) for database changes
4. **Follow Best Practices**: See [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md) and [Security Audit](./SECURITY_AUDIT.md)

## Documentation Structure

```
backend/docs/
├── README.md (this file)
├── API_DOCUMENTATION_INDEX.md          # Complete API documentation index
│
├── API Documentation
│   ├── PHASE_API.md                    # Phase management endpoints (NEW)
│   └── RESOURCE_WORKER_API.md          # Resource/worker endpoints
│
├── Migration Guides
│   ├── PHASE_MIGRATION_RUNBOOK.md      # Phase migration instructions
│   ├── MIGRATION_TASK_14_SUMMARY.md    # Migration completion status
│   ├── STAGING_MIGRATION_STATUS.md     # Staging migration tracking
│   └── STAGING_MIGRATION_CHECKLIST.md  # Pre-deployment checklist
│
├── Architecture & Design
│   ├── ERROR_HANDLING_GUIDE.md         # Error handling patterns
│   ├── MIDDLEWARE_DOCUMENTATION.md     # Middleware architecture
│   ├── PERFORMANCE_OPTIMIZATION.md     # Performance best practices
│   └── SECURITY_AUDIT.md               # Security guidelines
│
└── Database
    ├── DATABASE_COMPATIBILITY.md       # Database compatibility guide
    └── DATABASE_COMPATIBILITY_SUMMARY.md # Quick reference
```

## Recent Updates

### Phase Management System Redesign (Latest)

The phase management system has been completely redesigned:

- **User-Definable Phases**: Replace fixed Planning/Execution with flexible, user-defined phases
- **Timeline Continuity**: Phases must form continuous, non-overlapping timelines
- **Date-Based Relationships**: Implicit phase-assignment relationships based on dates
- **Batch Operations**: Atomic updates for all phases in a project
- **Migration Required**: See [Phase Migration Runbook](./PHASE_MIGRATION_RUNBOOK.md)

**Documentation:**
- [Phase API Documentation](./PHASE_API.md) - Complete API reference
- [Phase Migration Runbook](./PHASE_MIGRATION_RUNBOOK.md) - Migration instructions
- [Migration Task 14 Summary](./MIGRATION_TASK_14_SUMMARY.md) - Implementation status

## Contributing

When adding new features or making changes:

1. **Update API Documentation**: Add examples and descriptions to endpoint decorators
2. **Update Migration Guides**: Document any database schema changes
3. **Update This Index**: Add links to new documentation files
4. **Test Interactive Docs**: Verify Swagger UI displays correctly at `/docs`

## Support

For questions or issues:
- Check the [API Documentation Index](./API_DOCUMENTATION_INDEX.md)
- Review the [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)
- Contact the development team

## External Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
