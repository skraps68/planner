"""
Program service for business logic operations.
"""
from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.program import Program
from app.repositories.program import program_repository


class ProgramService:
    """Service for program business logic."""
    
    def __init__(self):
        self.repository = program_repository
    
    def create_program(
        self,
        db: Session,
        name: str,
        business_sponsor: str,
        program_manager: str,
        technical_lead: str,
        start_date: date,
        end_date: date,
        description: Optional[str] = None
    ) -> Program:
        """
        Create a new program with validation.
        
        Args:
            db: Database session
            name: Program name
            business_sponsor: Business sponsor name
            program_manager: Program manager name
            technical_lead: Technical lead name
            start_date: Program start date
            end_date: Program end date
            description: Optional program description
            
        Returns:
            Created program
            
        Raises:
            ValueError: If validation fails
        """
        # Validate date constraints
        if not self.repository.validate_date_constraints(start_date, end_date):
            raise ValueError("Start date must be before end date")
        
        # Check for duplicate name
        existing = self.repository.get_by_name(db, name)
        if existing:
            raise ValueError(f"Program with name '{name}' already exists")
        
        # Create program
        program_data = {
            "name": name,
            "business_sponsor": business_sponsor,
            "program_manager": program_manager,
            "technical_lead": technical_lead,
            "start_date": start_date,
            "end_date": end_date,
            "description": description
        }
        
        return self.repository.create(db, obj_in=program_data)
    
    def get_program(self, db: Session, program_id: UUID) -> Optional[Program]:
        """Get program by ID."""
        return self.repository.get(db, program_id)
    
    def get_program_by_name(self, db: Session, name: str) -> Optional[Program]:
        """Get program by name."""
        return self.repository.get_by_name(db, name)
    
    def list_programs(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False,
        as_of_date: Optional[date] = None
    ) -> List[Program]:
        """
        List programs with optional filtering.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            active_only: If True, only return active programs
            as_of_date: Date to check for active programs (default: today)
            
        Returns:
            List of programs
        """
        if active_only:
            return self.repository.get_active_programs(db, as_of_date)
        else:
            return self.repository.get_multi(db, skip=skip, limit=limit)
    
    def update_program(
        self,
        db: Session,
        program_id: UUID,
        name: Optional[str] = None,
        business_sponsor: Optional[str] = None,
        program_manager: Optional[str] = None,
        technical_lead: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        description: Optional[str] = None
    ) -> Program:
        """
        Update program with validation.
        
        Args:
            db: Database session
            program_id: Program ID to update
            name: Optional new name
            business_sponsor: Optional new business sponsor
            program_manager: Optional new program manager
            technical_lead: Optional new technical lead
            start_date: Optional new start date
            end_date: Optional new end date
            description: Optional new description
            
        Returns:
            Updated program
            
        Raises:
            ValueError: If validation fails or program not found
        """
        # Get existing program
        program = self.repository.get(db, program_id)
        if not program:
            raise ValueError(f"Program with ID {program_id} not found")
        
        # Build update data
        update_data = {}
        
        if name is not None:
            # Check for duplicate name (excluding current program)
            existing = self.repository.get_by_name(db, name)
            if existing and existing.id != program_id:
                raise ValueError(f"Program with name '{name}' already exists")
            update_data["name"] = name
        
        if business_sponsor is not None:
            update_data["business_sponsor"] = business_sponsor
        
        if program_manager is not None:
            update_data["program_manager"] = program_manager
        
        if technical_lead is not None:
            update_data["technical_lead"] = technical_lead
        
        if description is not None:
            update_data["description"] = description
        
        # Handle date updates with validation
        new_start = start_date if start_date is not None else program.start_date
        new_end = end_date if end_date is not None else program.end_date
        
        if start_date is not None or end_date is not None:
            if not self.repository.validate_date_constraints(new_start, new_end):
                raise ValueError("Start date must be before end date")
            
            if start_date is not None:
                update_data["start_date"] = start_date
            if end_date is not None:
                update_data["end_date"] = end_date
        
        return self.repository.update(db, db_obj=program, obj_in=update_data)
    
    def delete_program(self, db: Session, program_id: UUID) -> bool:
        """
        Delete a program.
        
        Args:
            db: Database session
            program_id: Program ID to delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If program not found or has associated projects
        """
        program = self.repository.get(db, program_id)
        if not program:
            raise ValueError(f"Program with ID {program_id} not found")
        
        # Check if program has associated projects
        if program.projects:
            raise ValueError(
                f"Cannot delete program '{program.name}' because it has {len(program.projects)} associated project(s)"
            )
        
        self.repository.remove(db, id=program_id)
        return True
    
    def search_programs(self, db: Session, search_term: str) -> List[Program]:
        """Search programs by name."""
        return self.repository.search_by_name(db, search_term)
    
    def get_programs_by_manager(self, db: Session, manager: str) -> List[Program]:
        """Get programs by program manager."""
        return self.repository.get_by_manager(db, manager)
    
    def get_programs_by_sponsor(self, db: Session, sponsor: str) -> List[Program]:
        """Get programs by business sponsor."""
        return self.repository.get_by_sponsor(db, sponsor)
    
    def get_programs_by_date_range(
        self,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Program]:
        """Get programs that overlap with a date range."""
        return self.repository.get_by_date_range(db, start_date, end_date)


# Create service instance
program_service = ProgramService()
