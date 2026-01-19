"""
Assignment service for resource assignment business logic with allocation validation and scope filtering.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID
import csv
import io

from sqlalchemy.orm import Session

from app.models.resource_assignment import ResourceAssignment
from app.models.resource import Resource, ResourceType
from app.models.user import ScopeType
from app.repositories.resource_assignment import resource_assignment_repository
from app.repositories.resource import resource_repository
from app.repositories.project import project_repository, project_phase_repository
from app.repositories.user import user_role_repository, scope_assignment_repository


class AssignmentService:
    """Service for resource assignment business logic with allocation validation and scope filtering."""
    
    def __init__(self):
        self.repository = resource_assignment_repository
        self.resource_repository = resource_repository
        self.project_repository = project_repository
        self.phase_repository = project_phase_repository
        self.user_role_repository = user_role_repository
        self.scope_assignment_repository = scope_assignment_repository
    
    def create_assignment(
        self,
        db: Session,
        resource_id: UUID,
        project_id: UUID,
        project_phase_id: UUID,
        assignment_date: date,
        allocation_percentage: Decimal,
        capital_percentage: Decimal,
        expense_percentage: Decimal,
        user_id: Optional[UUID] = None
    ) -> ResourceAssignment:
        """
        Create a new resource assignment with validation and conflict detection.
        
        Args:
            db: Database session
            resource_id: Resource ID to assign
            project_id: Project ID to assign to
            project_phase_id: Project phase ID
            assignment_date: Date of assignment
            allocation_percentage: Allocation percentage (0-100)
            capital_percentage: Capital accounting percentage (0-100)
            expense_percentage: Expense accounting percentage (0-100)
            user_id: Optional user ID for scope validation
            
        Returns:
            Created resource assignment
            
        Raises:
            ValueError: If validation fails
        """
        # Validate resource exists
        resource = self.resource_repository.get(db, resource_id)
        if not resource:
            raise ValueError(f"Resource with ID {resource_id} not found")
        
        # Validate project exists
        project = self.project_repository.get(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Validate project phase exists and belongs to project
        phase = self.phase_repository.get(db, project_phase_id)
        if not phase:
            raise ValueError(f"Project phase with ID {project_phase_id} not found")
        if phase.project_id != project_id:
            raise ValueError(f"Project phase {project_phase_id} does not belong to project {project_id}")
        
        # Validate scope access if user_id provided
        if user_id:
            if not self._can_access_project(db, user_id, project_id):
                raise ValueError(f"User does not have access to project {project_id}")
        
        # Validate allocation percentage range
        if allocation_percentage < Decimal('0') or allocation_percentage > Decimal('100'):
            raise ValueError("Allocation percentage must be between 0 and 100")
        
        # Validate accounting split
        if not self.repository.validate_accounting_split(capital_percentage, expense_percentage):
            raise ValueError("Capital and expense percentages must sum to 100")
        
        # Validate allocation limit (≤100% per day per resource)
        if not self.repository.validate_allocation_limit(
            db, resource_id, assignment_date, allocation_percentage
        ):
            current_total = self.repository.get_total_allocation_for_date(
                db, resource_id, assignment_date
            )
            raise ValueError(
                f"Assignment would exceed 100% allocation for resource on {assignment_date}. "
                f"Current total: {current_total}%, Attempting to add: {allocation_percentage}%"
            )
        
        # Create assignment
        assignment_data = {
            "resource_id": resource_id,
            "project_id": project_id,
            "project_phase_id": project_phase_id,
            "assignment_date": assignment_date,
            "allocation_percentage": allocation_percentage,
            "capital_percentage": capital_percentage,
            "expense_percentage": expense_percentage
        }
        
        return self.repository.create(db, obj_in=assignment_data)
    
    def get_assignment(self, db: Session, assignment_id: UUID) -> Optional[ResourceAssignment]:
        """Get assignment by ID."""
        return self.repository.get(db, assignment_id)
    
    def list_assignments(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        project_id: Optional[UUID] = None,
        resource_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None
    ) -> List[ResourceAssignment]:
        """
        List assignments with optional filtering and scope awareness.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            project_id: Optional filter by project
            resource_id: Optional filter by resource
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of assignments
        """
        if project_id:
            assignments = self.repository.get_by_project(db, project_id)
        elif resource_id:
            assignments = self.repository.get_by_resource(db, resource_id)
        else:
            assignments = self.repository.get_multi(db, skip=0, limit=10000)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            assignments = self._filter_by_user_scope(db, assignments, user_id)
        
        return assignments[skip:skip + limit]
    
    def get_assignments_by_project(
        self,
        db: Session,
        project_id: UUID,
        user_id: Optional[UUID] = None
    ) -> List[ResourceAssignment]:
        """
        Get all assignments for a project with scope validation.
        
        Args:
            db: Database session
            project_id: Project ID
            user_id: Optional user ID for scope validation
            
        Returns:
            List of assignments
            
        Raises:
            ValueError: If user doesn't have access to project
        """
        # Validate scope access if user_id provided
        if user_id:
            if not self._can_access_project(db, user_id, project_id):
                raise ValueError(f"User does not have access to project {project_id}")
        
        return self.repository.get_by_project(db, project_id)
    
    def get_assignments_by_resource(
        self,
        db: Session,
        resource_id: UUID,
        user_id: Optional[UUID] = None
    ) -> List[ResourceAssignment]:
        """
        Get all assignments for a resource with scope filtering.
        
        Args:
            db: Database session
            resource_id: Resource ID
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of assignments
        """
        assignments = self.repository.get_by_resource(db, resource_id)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            assignments = self._filter_by_user_scope(db, assignments, user_id)
        
        return assignments
    
    def get_assignments_by_date(
        self,
        db: Session,
        resource_id: UUID,
        assignment_date: date,
        user_id: Optional[UUID] = None
    ) -> List[ResourceAssignment]:
        """
        Get all assignments for a resource on a specific date with scope filtering.
        
        Args:
            db: Database session
            resource_id: Resource ID
            assignment_date: Assignment date
            user_id: Optional user ID for scope-based filtering
            
        Returns:
            List of assignments
        """
        assignments = self.repository.get_by_date(db, resource_id, assignment_date)
        
        # Apply scope-based filtering if user_id provided
        if user_id:
            assignments = self._filter_by_user_scope(db, assignments, user_id)
        
        return assignments
    
    def get_resource_allocation(
        self,
        db: Session,
        resource_id: UUID,
        assignment_date: date
    ) -> Decimal:
        """
        Get total allocation percentage for a resource on a specific date.
        
        Args:
            db: Database session
            resource_id: Resource ID
            assignment_date: Assignment date
            
        Returns:
            Total allocation percentage
        """
        return self.repository.get_total_allocation_for_date(db, resource_id, assignment_date)
    
    def update_assignment(
        self,
        db: Session,
        assignment_id: UUID,
        allocation_percentage: Optional[Decimal] = None,
        capital_percentage: Optional[Decimal] = None,
        expense_percentage: Optional[Decimal] = None,
        user_id: Optional[UUID] = None
    ) -> ResourceAssignment:
        """
        Update assignment with validation.
        
        Args:
            db: Database session
            assignment_id: Assignment ID to update
            allocation_percentage: Optional new allocation percentage
            capital_percentage: Optional new capital percentage
            expense_percentage: Optional new expense percentage
            user_id: Optional user ID for scope validation
            
        Returns:
            Updated assignment
            
        Raises:
            ValueError: If validation fails or assignment not found
        """
        # Get existing assignment
        assignment = self.repository.get(db, assignment_id)
        if not assignment:
            raise ValueError(f"Assignment with ID {assignment_id} not found")
        
        # Validate scope access if user_id provided
        if user_id:
            if not self._can_access_project(db, user_id, assignment.project_id):
                raise ValueError(f"User does not have access to project {assignment.project_id}")
        
        # Build update data
        update_data = {}
        
        # Handle allocation percentage update with validation
        if allocation_percentage is not None:
            if allocation_percentage < Decimal('0') or allocation_percentage > Decimal('100'):
                raise ValueError("Allocation percentage must be between 0 and 100")
            
            # Validate allocation limit (excluding current assignment)
            if not self.repository.validate_allocation_limit(
                db,
                assignment.resource_id,
                assignment.assignment_date,
                allocation_percentage,
                exclude_id=assignment_id
            ):
                current_total = self.repository.get_total_allocation_for_date(
                    db, assignment.resource_id, assignment.assignment_date
                )
                # Subtract current assignment's allocation
                current_total -= assignment.allocation_percentage
                raise ValueError(
                    f"Update would exceed 100% allocation for resource on {assignment.assignment_date}. "
                    f"Current total (excluding this assignment): {current_total}%, "
                    f"Attempting to set: {allocation_percentage}%"
                )
            
            update_data["allocation_percentage"] = allocation_percentage
        
        # Handle accounting split update
        new_capital = capital_percentage if capital_percentage is not None else assignment.capital_percentage
        new_expense = expense_percentage if expense_percentage is not None else assignment.expense_percentage
        
        if capital_percentage is not None or expense_percentage is not None:
            if not self.repository.validate_accounting_split(new_capital, new_expense):
                raise ValueError("Capital and expense percentages must sum to 100")
            
            if capital_percentage is not None:
                update_data["capital_percentage"] = capital_percentage
            if expense_percentage is not None:
                update_data["expense_percentage"] = expense_percentage
        
        return self.repository.update(db, db_obj=assignment, obj_in=update_data)
    
    def delete_assignment(
        self,
        db: Session,
        assignment_id: UUID,
        user_id: Optional[UUID] = None
    ) -> bool:
        """
        Delete an assignment.
        
        Args:
            db: Database session
            assignment_id: Assignment ID to delete
            user_id: Optional user ID for scope validation
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If assignment not found or user doesn't have access
        """
        assignment = self.repository.get(db, assignment_id)
        if not assignment:
            raise ValueError(f"Assignment with ID {assignment_id} not found")
        
        # Validate scope access if user_id provided
        if user_id:
            if not self._can_access_project(db, user_id, assignment.project_id):
                raise ValueError(f"User does not have access to project {assignment.project_id}")
        
        self.repository.remove(db, id=assignment_id)
        return True
    
    def import_assignments(
        self,
        db: Session,
        csv_content: str,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Import resource assignments from CSV with validation.
        
        CSV Format:
        resource_id,project_id,project_phase_id,assignment_date,allocation_percentage,capital_percentage,expense_percentage
        
        Args:
            db: Database session
            csv_content: CSV content as string
            user_id: Optional user ID for scope validation
            
        Returns:
            Dictionary with import results:
            {
                "total": int,
                "successful": int,
                "failed": int,
                "errors": List[Dict[str, Any]]
            }
        """
        results = {
            "total": 0,
            "successful": 0,
            "failed": 0,
            "errors": []
        }
        
        # Parse CSV
        csv_file = io.StringIO(csv_content)
        reader = csv.DictReader(csv_file)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 to account for header
            results["total"] += 1
            
            try:
                # Parse row data
                resource_id = UUID(row["resource_id"])
                project_id = UUID(row["project_id"])
                project_phase_id = UUID(row["project_phase_id"])
                assignment_date = date.fromisoformat(row["assignment_date"])
                allocation_percentage = Decimal(row["allocation_percentage"])
                capital_percentage = Decimal(row["capital_percentage"])
                expense_percentage = Decimal(row["expense_percentage"])
                
                # Create assignment with validation
                self.create_assignment(
                    db,
                    resource_id=resource_id,
                    project_id=project_id,
                    project_phase_id=project_phase_id,
                    assignment_date=assignment_date,
                    allocation_percentage=allocation_percentage,
                    capital_percentage=capital_percentage,
                    expense_percentage=expense_percentage,
                    user_id=user_id
                )
                
                results["successful"] += 1
                
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "row": row_num,
                    "data": row,
                    "error": str(e)
                })
        
        return results
    
    def check_allocation_conflicts(
        self,
        db: Session,
        resource_id: UUID,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Check for allocation conflicts for a resource within a date range.
        
        Args:
            db: Database session
            resource_id: Resource ID to check
            start_date: Start date of range
            end_date: End date of range
            
        Returns:
            List of conflicts with date and total allocation
        """
        conflicts = []
        
        # Get all assignments in date range
        assignments = self.repository.get_by_date_range(
            db, resource_id, start_date, end_date
        )
        
        # Group by date and check totals
        date_allocations = {}
        for assignment in assignments:
            assignment_date = assignment.assignment_date
            if assignment_date not in date_allocations:
                date_allocations[assignment_date] = Decimal('0')
            date_allocations[assignment_date] += assignment.allocation_percentage
        
        # Identify conflicts (>100%)
        for assignment_date, total_allocation in date_allocations.items():
            if total_allocation > Decimal('100'):
                conflicts.append({
                    "date": assignment_date,
                    "total_allocation": total_allocation,
                    "over_allocation": total_allocation - Decimal('100')
                })
        
        return conflicts
    
    def _can_access_project(self, db: Session, user_id: UUID, project_id: UUID) -> bool:
        """
        Check if user has access to a project based on scope assignments.
        
        Args:
            db: Database session
            user_id: User ID
            project_id: Project ID
            
        Returns:
            True if user has access, False otherwise
        """
        # Get user's active roles
        user_roles = self.user_role_repository.get_active_roles_by_user(db, user_id)
        if not user_roles:
            return False
        
        # Get project to check program
        project = self.project_repository.get(db, project_id)
        if not project:
            return False
        
        # Check scope assignments
        for user_role in user_roles:
            scope_assignments = self.scope_assignment_repository.get_active_by_user_role(
                db, user_role.id
            )
            
            for scope in scope_assignments:
                # Global scope grants access to everything
                if scope.scope_type == ScopeType.GLOBAL:
                    return True
                
                # Program scope grants access to all projects in the program
                if scope.scope_type == ScopeType.PROGRAM and scope.program_id == project.program_id:
                    return True
                
                # Project scope grants access to specific project
                if scope.scope_type == ScopeType.PROJECT and scope.project_id == project_id:
                    return True
        
        return False
    
    def _filter_by_user_scope(
        self,
        db: Session,
        assignments: List[ResourceAssignment],
        user_id: UUID
    ) -> List[ResourceAssignment]:
        """
        Filter assignments based on user's scope assignments.
        
        Args:
            db: Database session
            assignments: List of assignments to filter
            user_id: User ID for scope checking
            
        Returns:
            Filtered list of assignments
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
                    return assignments  # Full access
        
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
        
        # Filter assignments by accessible projects
        filtered_assignments = [
            assignment for assignment in assignments
            if assignment.project_id in accessible_project_ids
        ]
        
        return filtered_assignments


# Create service instance
assignment_service = AssignmentService()
