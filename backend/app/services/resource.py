"""
Resource, Worker, WorkerType, and Rate services for business logic operations.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resource import Resource, Worker, WorkerType, ResourceType
from app.models.rate import Rate
from app.models.user import ScopeType
from app.repositories.resource import (
    resource_repository,
    worker_repository,
    worker_type_repository
)
from app.repositories.rate import rate_repository
from app.repositories.user import user_role_repository, scope_assignment_repository
from app.repositories.project import project_repository


class ResourceService:
    """Service for resource business logic with scope-aware filtering."""
    
    def __init__(self):
        self.repository = resource_repository
        self.project_repository = project_repository
        self.user_role_repository = user_role_repository
        self.scope_assignment_repository = scope_assignment_repository
    
    def create_resource(
        self,
        db: Session,
        name: str,
        resource_type: ResourceType,
        description: Optional[str] = None
    ) -> Resource:
        """
        Create a new resource.
        
        Args:
            db: Database session
            name: Resource name
            resource_type: Type of resource (LABOR or NON_LABOR)
            description: Optional resource description
            
        Returns:
            Created resource
            
        Raises:
            ValueError: If validation fails
        """
        # Validate resource type
        if not isinstance(resource_type, ResourceType):
            raise ValueError(f"Invalid resource type: {resource_type}")
        
        # Create resource
        resource_data = {
            "name": name,
            "resource_type": resource_type,
            "description": description
        }
        
        return self.repository.create(db, obj_in=resource_data)
    
    def get_resource(self, db: Session, resource_id: UUID) -> Optional[Resource]:
        """Get resource by ID."""
        return self.repository.get(db, resource_id)
    
    def list_resources(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        resource_type: Optional[ResourceType] = None,
        user_id: Optional[UUID] = None
    ) -> List[Resource]:
        """
        List resources with optional filtering and scope awareness.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            resource_type: Optional filter by resource type
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of resources
        """
        if resource_type:
            resources = self.repository.get_by_type(db, resource_type)
        else:
            resources = self.repository.get_multi(db, skip=0, limit=10000)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            resources = self._filter_by_user_scope(db, resources, user_id)
        
        return resources[skip:skip + limit]
    
    def list_labor_resources(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[UUID] = None
    ) -> List[Resource]:
        """List labor resources with scope awareness."""
        return self.list_resources(
            db,
            skip=skip,
            limit=limit,
            resource_type=ResourceType.LABOR,
            user_id=user_id
        )
    
    def list_non_labor_resources(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[UUID] = None
    ) -> List[Resource]:
        """List non-labor resources with scope awareness."""
        return self.list_resources(
            db,
            skip=skip,
            limit=limit,
            resource_type=ResourceType.NON_LABOR,
            user_id=user_id
        )
    
    def update_resource(
        self,
        db: Session,
        resource_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Resource:
        """
        Update resource with validation.
        
        Args:
            db: Database session
            resource_id: Resource ID to update
            name: Optional new name
            description: Optional new description
            
        Returns:
            Updated resource
            
        Raises:
            ValueError: If validation fails or resource not found
        """
        # Get existing resource
        resource = self.repository.get(db, resource_id)
        if not resource:
            raise ValueError(f"Resource with ID {resource_id} not found")
        
        # Build update data
        update_data = {}
        
        if name is not None:
            update_data["name"] = name
        
        if description is not None:
            update_data["description"] = description
        
        return self.repository.update(db, db_obj=resource, obj_in=update_data)
    
    def delete_resource(self, db: Session, resource_id: UUID) -> bool:
        """
        Delete a resource.
        
        Args:
            db: Database session
            resource_id: Resource ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If resource not found or has assignments
        """
        resource = self.repository.get(db, resource_id)
        if not resource:
            raise ValueError(f"Resource with ID {resource_id} not found")
        
        # Check if resource has assignments
        if resource.resource_assignments:
            raise ValueError(
                f"Cannot delete resource '{resource.name}' because it has "
                f"{len(resource.resource_assignments)} assignment(s)"
            )
        
        self.repository.remove(db, id=resource_id)
        return True
    
    def search_resources(
        self,
        db: Session,
        search_term: str,
        user_id: Optional[UUID] = None
    ) -> List[Resource]:
        """
        Search resources by name with scope awareness.
        
        Args:
            db: Database session
            search_term: Search term for name matching
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of matching resources
        """
        resources = self.repository.search_by_name(db, search_term)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            resources = self._filter_by_user_scope(db, resources, user_id)
        
        return resources
    
    def _filter_by_user_scope(
        self,
        db: Session,
        resources: List[Resource],
        user_id: UUID
    ) -> List[Resource]:
        """
        Filter resources based on user's scope assignments.
        
        Resources are accessible if they are assigned to projects within the user's scope.
        
        Args:
            db: Database session
            resources: List of resources to filter
            user_id: User ID for scope checking
            
        Returns:
            Filtered list of resources
        """
        # Get user's active roles
        user_roles = self.user_role_repository.get_active_roles_by_user(db, user_id)
        if not user_roles:
            return []
        
        # Check for global scope (admin)
        for user_role in user_roles:
            scope_assignments = self.scope_assignment_repository.get_active_by_user_role(
                db, user_role.id
            )
            for scope in scope_assignments:
                if scope.scope_type == ScopeType.GLOBAL:
                    return resources  # Full access
        
        # Collect accessible project IDs
        accessible_project_ids = set()
        
        for user_role in user_roles:
            scope_assignments = self.scope_assignment_repository.get_active_by_user_role(
                db, user_role.id
            )
            
            for scope in scope_assignments:
                if scope.scope_type == ScopeType.PROGRAM and scope.program_id:
                    # Get all projects in the program
                    projects = self.project_repository.get_by_program(db, scope.program_id)
                    accessible_project_ids.update(p.id for p in projects)
                
                elif scope.scope_type == ScopeType.PROJECT and scope.project_id:
                    accessible_project_ids.add(scope.project_id)
        
        # Filter resources that have assignments to accessible projects
        filtered_resources = []
        for resource in resources:
            # Check if resource has any assignments to accessible projects
            has_access = any(
                assignment.project_id in accessible_project_ids
                for assignment in resource.resource_assignments
            )
            if has_access:
                filtered_resources.append(resource)
        
        return filtered_resources


class WorkerTypeService:
    """Service for worker type business logic."""
    
    def __init__(self):
        self.repository = worker_type_repository
    
    def create_worker_type(
        self,
        db: Session,
        type: str,
        description: str
    ) -> WorkerType:
        """
        Create a new worker type.
        
        Args:
            db: Database session
            type: Worker type name (must be unique)
            description: Worker type description
            
        Returns:
            Created worker type
            
        Raises:
            ValueError: If validation fails
        """
        # Check for duplicate type
        existing = self.repository.get_by_type(db, type)
        if existing:
            raise ValueError(f"Worker type '{type}' already exists")
        
        # Create worker type
        worker_type_data = {
            "type": type,
            "description": description
        }
        
        return self.repository.create(db, obj_in=worker_type_data)
    
    def get_worker_type(self, db: Session, worker_type_id: UUID) -> Optional[WorkerType]:
        """Get worker type by ID."""
        return self.repository.get(db, worker_type_id)
    
    def get_worker_type_by_name(self, db: Session, type: str) -> Optional[WorkerType]:
        """Get worker type by type name."""
        return self.repository.get_by_type(db, type)
    
    def list_worker_types(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100
    ) -> List[WorkerType]:
        """
        List worker types.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of worker types
        """
        return self.repository.get_multi(db, skip=skip, limit=limit)
    
    def update_worker_type(
        self,
        db: Session,
        worker_type_id: UUID,
        type: Optional[str] = None,
        description: Optional[str] = None
    ) -> WorkerType:
        """
        Update worker type with validation.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID to update
            type: Optional new type name
            description: Optional new description
            
        Returns:
            Updated worker type
            
        Raises:
            ValueError: If validation fails or worker type not found
        """
        # Get existing worker type
        worker_type = self.repository.get(db, worker_type_id)
        if not worker_type:
            raise ValueError(f"Worker type with ID {worker_type_id} not found")
        
        # Build update data
        update_data = {}
        
        if type is not None:
            # Check for duplicate type (excluding current worker type)
            existing = self.repository.get_by_type(db, type)
            if existing and existing.id != worker_type_id:
                raise ValueError(f"Worker type '{type}' already exists")
            update_data["type"] = type
        
        if description is not None:
            update_data["description"] = description
        
        return self.repository.update(db, db_obj=worker_type, obj_in=update_data)
    
    def delete_worker_type(self, db: Session, worker_type_id: UUID) -> bool:
        """
        Delete a worker type.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If worker type not found or has associated workers
        """
        worker_type = self.repository.get(db, worker_type_id)
        if not worker_type:
            raise ValueError(f"Worker type with ID {worker_type_id} not found")
        
        # Check if worker type has associated workers
        if worker_type.workers:
            raise ValueError(
                f"Cannot delete worker type '{worker_type.type}' because it has "
                f"{len(worker_type.workers)} associated worker(s)"
            )
        
        # Cascade delete will handle rates
        self.repository.remove(db, id=worker_type_id)
        return True
    
    def search_worker_types(self, db: Session, search_term: str) -> List[WorkerType]:
        """Search worker types by type name."""
        return self.repository.search_by_type(db, search_term)


class WorkerService:
    """Service for worker business logic with scope-aware filtering."""
    
    def __init__(self):
        self.repository = worker_repository
        self.worker_type_repository = worker_type_repository
        self.project_repository = project_repository
        self.user_role_repository = user_role_repository
        self.scope_assignment_repository = scope_assignment_repository
    
    def create_worker(
        self,
        db: Session,
        external_id: str,
        name: str,
        worker_type_id: UUID
    ) -> Worker:
        """
        Create a new worker.
        
        Args:
            db: Database session
            external_id: External identifier (must be unique)
            name: Worker name
            worker_type_id: Worker type ID
            
        Returns:
            Created worker
            
        Raises:
            ValueError: If validation fails
        """
        # Validate worker type exists
        worker_type = self.worker_type_repository.get(db, worker_type_id)
        if not worker_type:
            raise ValueError(f"Worker type with ID {worker_type_id} not found")
        
        # Check for duplicate external_id
        if not self.repository.validate_external_id_unique(db, external_id):
            raise ValueError(f"Worker with external ID '{external_id}' already exists")
        
        # Create worker
        worker_data = {
            "external_id": external_id,
            "name": name,
            "worker_type_id": worker_type_id
        }
        
        return self.repository.create(db, obj_in=worker_data)
    
    def get_worker(self, db: Session, worker_id: UUID) -> Optional[Worker]:
        """Get worker by ID."""
        return self.repository.get(db, worker_id)
    
    def get_worker_by_external_id(self, db: Session, external_id: str) -> Optional[Worker]:
        """Get worker by external ID."""
        return self.repository.get_by_external_id(db, external_id)
    
    def list_workers(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        worker_type_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None
    ) -> List[Worker]:
        """
        List workers with optional filtering and scope awareness.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            worker_type_id: Optional filter by worker type
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of workers
        """
        if worker_type_id:
            workers = self.repository.get_by_worker_type(db, worker_type_id)
        else:
            workers = self.repository.get_multi(db, skip=0, limit=10000)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            workers = self._filter_by_user_scope(db, workers, user_id)
        
        return workers[skip:skip + limit]
    
    def update_worker(
        self,
        db: Session,
        worker_id: UUID,
        external_id: Optional[str] = None,
        name: Optional[str] = None,
        worker_type_id: Optional[UUID] = None
    ) -> Worker:
        """
        Update worker with validation.
        
        Args:
            db: Database session
            worker_id: Worker ID to update
            external_id: Optional new external ID
            name: Optional new name
            worker_type_id: Optional new worker type ID
            
        Returns:
            Updated worker
            
        Raises:
            ValueError: If validation fails or worker not found
        """
        # Get existing worker
        worker = self.repository.get(db, worker_id)
        if not worker:
            raise ValueError(f"Worker with ID {worker_id} not found")
        
        # Build update data
        update_data = {}
        
        if external_id is not None:
            # Check for duplicate external_id (excluding current worker)
            if not self.repository.validate_external_id_unique(db, external_id, exclude_id=worker_id):
                raise ValueError(f"Worker with external ID '{external_id}' already exists")
            update_data["external_id"] = external_id
        
        if name is not None:
            update_data["name"] = name
        
        if worker_type_id is not None:
            # Validate worker type exists
            worker_type = self.worker_type_repository.get(db, worker_type_id)
            if not worker_type:
                raise ValueError(f"Worker type with ID {worker_type_id} not found")
            update_data["worker_type_id"] = worker_type_id
        
        return self.repository.update(db, db_obj=worker, obj_in=update_data)
    
    def delete_worker(self, db: Session, worker_id: UUID) -> bool:
        """
        Delete a worker.
        
        Args:
            db: Database session
            worker_id: Worker ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If worker not found
        """
        worker = self.repository.get(db, worker_id)
        if not worker:
            raise ValueError(f"Worker with ID {worker_id} not found")
        
        self.repository.remove(db, id=worker_id)
        return True
    
    def search_workers(
        self,
        db: Session,
        search_term: str,
        user_id: Optional[UUID] = None
    ) -> List[Worker]:
        """
        Search workers by name with scope awareness.
        
        Args:
            db: Database session
            search_term: Search term for name matching
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of matching workers
        """
        workers = self.repository.search_by_name(db, search_term)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            workers = self._filter_by_user_scope(db, workers, user_id)
        
        return workers
    
    def get_workers_by_type(
        self,
        db: Session,
        worker_type_id: UUID,
        user_id: Optional[UUID] = None
    ) -> List[Worker]:
        """
        Get workers by worker type with scope awareness.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of workers
        """
        workers = self.repository.get_by_worker_type(db, worker_type_id)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            workers = self._filter_by_user_scope(db, workers, user_id)
        
        return workers
    
    def _filter_by_user_scope(
        self,
        db: Session,
        workers: List[Worker],
        user_id: UUID
    ) -> List[Worker]:
        """
        Filter workers based on user's scope assignments.
        
        Workers are accessible if they are assigned to projects within the user's scope.
        Note: Workers don't have direct assignments, but they are linked through
        Resource entities. For now, we return all workers if user has any scope.
        
        Args:
            db: Database session
            workers: List of workers to filter
            user_id: User ID for scope checking
            
        Returns:
            Filtered list of workers
        """
        # Get user's active roles
        user_roles = self.user_role_repository.get_active_roles_by_user(db, user_id)
        if not user_roles:
            return []
        
        # Check for global scope (admin)
        for user_role in user_roles:
            scope_assignments = self.scope_assignment_repository.get_active_by_user_role(
                db, user_role.id
            )
            for scope in scope_assignments:
                if scope.scope_type == ScopeType.GLOBAL:
                    return workers  # Full access
        
        # For workers, if user has any program or project scope, they can see all workers
        # This is because workers are organizational resources that can be assigned to any project
        for user_role in user_roles:
            scope_assignments = self.scope_assignment_repository.get_active_by_user_role(
                db, user_role.id
            )
            if scope_assignments:
                return workers
        
        return []


class RateService:
    """Service for rate management with temporal validity."""
    
    def __init__(self):
        self.repository = rate_repository
        self.worker_type_repository = worker_type_repository
    
    def create_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        rate_amount: Decimal,
        start_date: date,
        close_previous: bool = True
    ) -> Rate:
        """
        Create a new rate, optionally closing the previous rate.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            rate_amount: Rate amount (must be positive)
            start_date: Rate start date
            close_previous: If True, close the current rate before creating new one
            
        Returns:
            Created rate
            
        Raises:
            ValueError: If validation fails
        """
        # Validate worker type exists
        worker_type = self.worker_type_repository.get(db, worker_type_id)
        if not worker_type:
            raise ValueError(f"Worker type with ID {worker_type_id} not found")
        
        # Validate rate amount
        if rate_amount <= 0:
            raise ValueError("Rate amount must be positive")
        
        # Create new rate (repository handles closing previous rate)
        return self.repository.create_new_rate(
            db,
            worker_type_id=worker_type_id,
            rate_amount=rate_amount,
            start_date=start_date,
            close_previous=close_previous
        )
    
    def get_rate(self, db: Session, rate_id: UUID) -> Optional[Rate]:
        """Get rate by ID."""
        return self.repository.get(db, rate_id)
    
    def get_active_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        as_of_date: Optional[date] = None
    ) -> Optional[Rate]:
        """
        Get the active rate for a worker type on a given date.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            as_of_date: Date to check (default: today)
            
        Returns:
            Active rate or None if not found
        """
        return self.repository.get_active_rate(db, worker_type_id, as_of_date)
    
    def get_current_rate(self, db: Session, worker_type_id: UUID) -> Optional[Rate]:
        """
        Get the current active rate for a worker type (end_date is NULL).
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            
        Returns:
            Current rate or None if not found
        """
        return self.repository.get_current_rate(db, worker_type_id)
    
    def list_rates_by_worker_type(
        self,
        db: Session,
        worker_type_id: UUID
    ) -> List[Rate]:
        """
        List all rates for a worker type (ordered by start_date descending).
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            
        Returns:
            List of rates
        """
        return self.repository.get_by_worker_type(db, worker_type_id)
    
    def get_rates_in_date_range(
        self,
        db: Session,
        worker_type_id: UUID,
        start_date: date,
        end_date: date
    ) -> List[Rate]:
        """
        Get all rates that overlap with a date range.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            start_date: Range start date
            end_date: Range end date
            
        Returns:
            List of rates
        """
        return self.repository.get_rates_in_date_range(
            db, worker_type_id, start_date, end_date
        )
    
    def update_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        new_rate_amount: Decimal,
        effective_date: date
    ) -> Rate:
        """
        Update rate by closing the current rate and creating a new one.
        
        This implements the requirement that rate updates should close the previous
        rate record and create a new one starting on the same date.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            new_rate_amount: New rate amount
            effective_date: Date when new rate becomes effective
            
        Returns:
            New rate record
            
        Raises:
            ValueError: If validation fails
        """
        # Validate worker type exists
        worker_type = self.worker_type_repository.get(db, worker_type_id)
        if not worker_type:
            raise ValueError(f"Worker type with ID {worker_type_id} not found")
        
        # Validate rate amount
        if new_rate_amount <= 0:
            raise ValueError("Rate amount must be positive")
        
        # Create new rate (this will close the previous rate)
        return self.repository.create_new_rate(
            db,
            worker_type_id=worker_type_id,
            rate_amount=new_rate_amount,
            start_date=effective_date,
            close_previous=True
        )
    
    def close_rate(
        self,
        db: Session,
        worker_type_id: UUID,
        end_date: date
    ) -> Optional[Rate]:
        """
        Close the current rate by setting its end_date.
        
        Args:
            db: Database session
            worker_type_id: Worker type ID
            end_date: Date to close the rate
            
        Returns:
            Closed rate or None if no current rate exists
        """
        return self.repository.close_current_rate(db, worker_type_id, end_date)


# Create service instances
resource_service = ResourceService()
worker_type_service = WorkerTypeService()
worker_service = WorkerService()
rate_service = RateService()
