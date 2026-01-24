"""
Database compatibility tests.

These tests verify that our database abstraction layer works correctly
with both SQLite and PostgreSQL, ensuring data types are handled properly.
"""
import pytest
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.program import Program
from app.models.project import Project, ProjectPhase, PhaseType
from app.models.resource import Resource, Worker, WorkerType
from app.models.rate import Rate
from app.models.resource_assignment import ResourceAssignment
from app.models.actual import Actual
from app.models.user import User, UserRole, ScopeAssignment
from app.models.audit import AuditLog

from tests.db_config import (
    get_test_engine,
    get_test_session,
    create_test_db,
    drop_test_db,
    TEST_DB_TYPE
)


@pytest.fixture(scope="function")
def db():
    """Create test database for each test."""
    create_test_db()
    db = get_test_session()
    yield db
    db.close()
    drop_test_db()


class TestDatabaseCompatibility:
    """Test database compatibility across SQLite and PostgreSQL."""
    
    def test_uuid_type_compatibility(self, db):
        """Test that UUID/GUID types work correctly."""
        # Create a program with explicit UUID
        program_id = uuid4()
        program = Program(
            id=program_id,
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Retrieve and verify UUID is preserved
        retrieved = db.query(Program).filter(Program.id == program_id).first()
        assert retrieved is not None
        assert retrieved.id == program_id
        assert isinstance(retrieved.id, type(program_id))
    
    def test_date_type_compatibility(self, db):
        """Test that Date types work correctly."""
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Retrieve and verify dates are preserved
        retrieved = db.query(Program).filter(Program.name == "Test Program").first()
        assert retrieved.start_date == date(2024, 1, 1)
        assert retrieved.end_date == date(2024, 12, 31)
        assert isinstance(retrieved.start_date, date)
        assert isinstance(retrieved.end_date, date)
    
    def test_datetime_type_compatibility(self, db):
        """Test that DateTime types work correctly."""
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Verify created_at and updated_at are datetime objects
        retrieved = db.query(Program).filter(Program.name == "Test Program").first()
        assert isinstance(retrieved.created_at, datetime)
        assert isinstance(retrieved.updated_at, datetime)
    
    def test_decimal_type_compatibility(self, db):
        """Test that Numeric/Decimal types work correctly."""
        # Create program first
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Create project
        project = Project(
            name="Test Project",
            program_id=program.id,
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
            cost_center_code="CC001"
        )
        db.add(project)
        db.commit()
        
        # Create project phase with decimal budget values
        phase = ProjectPhase(
            project_id=project.id,
            phase_type=PhaseType.PLANNING,
            total_budget=Decimal("1000000.50"),
            capital_budget=Decimal("600000.25"),
            expense_budget=Decimal("400000.25")
        )
        db.add(phase)
        db.commit()
        
        # Retrieve and verify decimals are preserved
        retrieved = db.query(ProjectPhase).filter(ProjectPhase.project_id == project.id).first()
        assert retrieved.total_budget == Decimal("1000000.50")
        assert retrieved.capital_budget == Decimal("600000.25")
        assert retrieved.expense_budget == Decimal("400000.25")
        assert isinstance(retrieved.total_budget, Decimal)
    
    def test_string_type_compatibility(self, db):
        """Test that String types work correctly."""
        program = Program(
            name="Test Program with Special Chars: @#$%",
            business_sponsor="Sponsor's Name",
            program_manager="Manager \"Quoted\"",
            technical_lead="Lead & Co.",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            description="Description with\nnewlines and\ttabs"
        )
        db.add(program)
        db.commit()
        
        # Retrieve and verify strings are preserved
        retrieved = db.query(Program).first()
        assert retrieved.name == "Test Program with Special Chars: @#$%"
        assert retrieved.business_sponsor == "Sponsor's Name"
        assert retrieved.program_manager == "Manager \"Quoted\""
        assert retrieved.technical_lead == "Lead & Co."
        assert retrieved.description == "Description with\nnewlines and\ttabs"
    
    def test_boolean_type_compatibility(self, db):
        """Test that Boolean types work correctly."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed",
            is_active=True
        )
        db.add(user)
        db.commit()
        
        # Retrieve and verify boolean is preserved
        retrieved = db.query(User).filter(User.username == "testuser").first()
        assert retrieved.is_active is True
        assert isinstance(retrieved.is_active, bool)
        
        # Update to False
        retrieved.is_active = False
        db.commit()
        
        # Verify update
        retrieved = db.query(User).filter(User.username == "testuser").first()
        assert retrieved.is_active is False
    
    def test_json_type_compatibility(self, db):
        """Test that JSON types work correctly with AuditLog model."""
        # Create a user first (required for audit log)
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed",
            is_active=True
        )
        db.add(user)
        db.commit()
        
        # Create an audit log with JSON data
        before_data = {
            "name": "Old Name",
            "value": 100,
            "nested": {"key": "value"},
            "list": [1, 2, 3]
        }
        after_data = {
            "name": "New Name",
            "value": 200,
            "nested": {"key": "updated"},
            "list": [4, 5, 6]
        }
        
        audit_log = AuditLog(
            user_id=user.id,
            entity_type="Program",
            entity_id=uuid4(),
            operation="UPDATE",
            before_values=before_data,
            after_values=after_data
        )
        db.add(audit_log)
        db.commit()
        
        # Retrieve and verify JSON data is preserved
        retrieved = db.query(AuditLog).filter(AuditLog.user_id == user.id).first()
        assert retrieved is not None
        assert retrieved.before_values == before_data
        assert retrieved.after_values == after_data
        assert isinstance(retrieved.before_values, dict)
        assert isinstance(retrieved.after_values, dict)
        
        # Verify nested structures are preserved
        assert retrieved.before_values["nested"]["key"] == "value"
        assert retrieved.after_values["nested"]["key"] == "updated"
        assert retrieved.before_values["list"] == [1, 2, 3]
        assert retrieved.after_values["list"] == [4, 5, 6]
        
        # Test with None values
        audit_log2 = AuditLog(
            user_id=user.id,
            entity_type="Project",
            entity_id=uuid4(),
            operation="CREATE",
            before_values=None,
            after_values={"name": "New Project"}
        )
        db.add(audit_log2)
        db.commit()
        
        retrieved2 = db.query(AuditLog).filter(
            AuditLog.operation == "CREATE"
        ).first()
        assert retrieved2.before_values is None
        assert retrieved2.after_values == {"name": "New Project"}
    
    def test_foreign_key_compatibility(self, db):
        """Test that foreign key relationships work correctly."""
        # Create program
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Create project with foreign key to program
        project = Project(
            name="Test Project",
            program_id=program.id,
            business_sponsor="Sponsor",
            project_manager="PM",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
            cost_center_code="CC001"
        )
        db.add(project)
        db.commit()
        
        # Verify relationship works
        retrieved_project = db.query(Project).filter(Project.name == "Test Project").first()
        assert retrieved_project.program_id == program.id
        assert retrieved_project.program.name == "Test Program"
        
        # Verify reverse relationship
        retrieved_program = db.query(Program).filter(Program.id == program.id).first()
        assert len(retrieved_program.projects) == 1
        assert retrieved_program.projects[0].name == "Test Project"
    
    def test_check_constraint_compatibility(self, db):
        """Test that check constraints work correctly."""
        # Try to create program with invalid dates (end before start)
        program = Program(
            name="Invalid Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 12, 31),
            end_date=date(2024, 1, 1)  # Invalid: end before start
        )
        db.add(program)
        
        # Should raise an error due to check constraint
        with pytest.raises(Exception):  # IntegrityError or similar
            db.commit()
        
        db.rollback()
    
    def test_transaction_compatibility(self, db):
        """Test that transactions work correctly."""
        # Create program
        program = Program(
            name="Test Program",
            business_sponsor="Sponsor",
            program_manager="Manager",
            technical_lead="Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        db.add(program)
        db.commit()
        
        # Start a transaction and rollback
        program.name = "Updated Name"
        db.add(program)
        db.rollback()
        
        # Verify rollback worked
        retrieved = db.query(Program).first()
        assert retrieved.name == "Test Program"
        
        # Commit a change
        program.name = "Updated Name"
        db.add(program)
        db.commit()
        
        # Verify commit worked
        retrieved = db.query(Program).first()
        assert retrieved.name == "Updated Name"
    
    def test_query_compatibility(self, db):
        """Test that common query patterns work correctly."""
        # Create test data
        for i in range(5):
            program = Program(
                name=f"Program {i}",
                business_sponsor="Sponsor",
                program_manager="Manager",
                technical_lead="Lead",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31)
            )
            db.add(program)
        db.commit()
        
        # Test count
        count = db.query(Program).count()
        assert count == 5
        
        # Test filter
        filtered = db.query(Program).filter(Program.name == "Program 2").first()
        assert filtered.name == "Program 2"
        
        # Test like (case-insensitive search)
        like_results = db.query(Program).filter(Program.name.like("%Program%")).all()
        assert len(like_results) == 5
        
        # Test order by
        ordered = db.query(Program).order_by(Program.name).all()
        assert ordered[0].name == "Program 0"
        assert ordered[4].name == "Program 4"
        
        # Test limit and offset
        limited = db.query(Program).limit(2).all()
        assert len(limited) == 2
        
        offset = db.query(Program).offset(2).limit(2).all()
        assert len(offset) == 2


def test_database_type_detection():
    """Test that we can detect which database type is being used."""
    assert TEST_DB_TYPE in ["sqlite", "postgresql"]
    print(f"\nRunning tests with {TEST_DB_TYPE.upper()} database")
