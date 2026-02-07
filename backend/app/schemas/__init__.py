"""
Pydantic schemas for request/response validation.
"""
from .base import *
from .portfolio import *
from .program import *
from .project import *
from .phase import *
from .resource import *
from .user import *
from .assignment import *
from .actual import *
from .rate import *
from .audit import *
from .auth import *
from .report import *

__all__ = [
    # Base schemas
    "BaseSchema",
    "PaginationParams",
    "PaginatedResponse",
    "ErrorResponse",
    "SuccessResponse",
    
    # Portfolio schemas
    "PortfolioBase",
    "PortfolioCreate",
    "PortfolioUpdate",
    "PortfolioResponse",
    "PortfolioListResponse",
    "PortfolioSummary",
    
    # Program schemas
    "ProgramBase",
    "ProgramCreate",
    "ProgramUpdate",
    "ProgramResponse",
    "ProgramListResponse",
    
    # Project schemas
    "ProjectBase",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectListResponse",
    "ProjectPhaseBase",
    "ProjectPhaseCreate",
    "ProjectPhaseUpdate",
    "ProjectPhaseResponse",
    
    # Phase schemas
    "PhaseBase",
    "PhaseCreate",
    "PhaseUpdate",
    "PhaseResponse",
    "PhaseValidationRequest",
    "PhaseValidationError",
    "PhaseValidationResult",
    
    # Resource schemas
    "ResourceBase",
    "ResourceCreate",
    "ResourceUpdate",
    "ResourceResponse",
    "ResourceListResponse",
    "WorkerTypeBase",
    "WorkerTypeCreate",
    "WorkerTypeUpdate",
    "WorkerTypeResponse",
    "WorkerBase",
    "WorkerCreate",
    "WorkerUpdate",
    "WorkerResponse",
    "WorkerListResponse",
    
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserListResponse",
    "UserRoleBase",
    "UserRoleCreate",
    "UserRoleUpdate",
    "UserRoleResponse",
    "ScopeAssignmentBase",
    "ScopeAssignmentCreate",
    "ScopeAssignmentUpdate",
    "ScopeAssignmentResponse",
    
    # Assignment schemas
    "ResourceAssignmentBase",
    "ResourceAssignmentCreate",
    "ResourceAssignmentUpdate",
    "ResourceAssignmentResponse",
    "ResourceAssignmentListResponse",
    "AssignmentImportRow",
    "AssignmentImportRequest",
    "AssignmentImportResponse",
    
    # Actual schemas
    "ActualBase",
    "ActualCreate",
    "ActualUpdate",
    "ActualResponse",
    "ActualListResponse",
    "ActualImportRow",
    "ActualImportRequest",
    "ActualImportResponse",
    
    # Rate schemas
    "RateBase",
    "RateCreate",
    "RateUpdate",
    "RateResponse",
    "RateListResponse",
    
    # Audit schemas
    "AuditLogResponse",
    "AuditLogListResponse",
    
    # Auth schemas
    "LoginRequest",
    "LoginResponse",
    "TokenRefreshRequest",
    "TokenRefreshResponse",
    "PasswordChangeRequest",
    "RoleSwitchRequest",
    "RoleSwitchResponse",
    
    # Report schemas
    "BudgetVsActualReport",
    "ForecastReport",
    "VarianceAnalysisReport",
    "ResourceUtilizationReport",
    "ReportFilters",
]