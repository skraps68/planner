"""
Main API router for v1 endpoints.
"""
from fastapi import APIRouter

# Import routers here as they are created
# from app.api.v1.endpoints import auth, programs, projects, resources, workers, assignments, actuals, forecasting, audit

api_router = APIRouter()

# Include routers here as they are created
# api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
# api_router.include_router(programs.router, prefix="/programs", tags=["programs"])
# api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
# api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
# api_router.include_router(workers.router, prefix="/workers", tags=["workers"])
# api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
# api_router.include_router(actuals.router, prefix="/actuals", tags=["actuals"])
# api_router.include_router(forecasting.router, prefix="/forecasting", tags=["forecasting"])
# api_router.include_router(audit.router, prefix="/audit", tags=["audit"])

@api_router.get("/")
async def api_info():
    """API information endpoint."""
    return {
        "message": "Program and Project Management System API v1",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "openapi": "/api/v1/openapi.json"
        }
    }