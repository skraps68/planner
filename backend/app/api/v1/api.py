"""
Main API router for v1 endpoints.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    programs, projects, resources, workers, rates, 
    assignments, actuals, reports, auth, users, audit, phases
)

api_router = APIRouter()

# Include routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(programs.router, prefix="/programs", tags=["programs"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(phases.router, prefix="", tags=["phases"])  # No prefix, uses paths from router
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
api_router.include_router(workers.router, prefix="/workers", tags=["workers"])
api_router.include_router(rates.router, prefix="/rates", tags=["rates"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(actuals.router, prefix="/actuals", tags=["actuals"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])

@api_router.get("/")
async def api_info():
    """API information endpoint."""
    return {
        "message": "Program and Project Management System API v1",
        "version": "1.0.0",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "openapi": "/api/v1/openapi.json"
        },
        "available_routes": {
            "auth": "/api/v1/auth",
            "users": "/api/v1/users",
            "audit": "/api/v1/audit",
            "programs": "/api/v1/programs",
            "projects": "/api/v1/projects",
            "phases": "/api/v1/phases",
            "resources": "/api/v1/resources",
            "workers": "/api/v1/workers",
            "rates": "/api/v1/rates",
            "assignments": "/api/v1/assignments",
            "actuals": "/api/v1/actuals",
            "reports": "/api/v1/reports"
        }
    }