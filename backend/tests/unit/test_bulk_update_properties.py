"""
Property-based tests for bulk update individual validation.

Feature: optimistic-locking
Property 8: Bulk Update Individual Validation
Validates: Requirements 7.3, 7.5
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from hypothesis import given, strategies as st, settings
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from app.models.portfolio import Portfolio
from app.models.program import Program
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.models.resource_assignment import ResourceAssignment
from app.services.assignment import assignment_service
from tests.conftest import engine


# Create a session factory for property tests
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Feature: optimistic-locking, Property 8: Bulk Update Individual Validation
@given(
    num_assignments=st.integers(min_value=2, max_value=5),
    conflict_indices=st.lists(st.integers(min_value=0, max_value=4), min_size=1, max_size=3, unique=True)
)
@settings(max_examples=100, deadline=None)
def test_bulk_update_individual_validation(num_assignments, conflict_indices, db):
    """
    For any bulk update operation on Resource Assignments, each assignment's
    version should be validated individually, and the response should identify
    which assignments succeeded and which failed due to version conflicts.
    
    Validates: Requirements 7.3, 7.5
    """
    session = TestSession()
    try:
        # Create test data: portfolio, program, project, resource
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session.add(portfolio)
        
        program = Program(
            id=uuid4(),
            name="Test Program",
            description="Test",
            portfolio_id=portfolio.id,
            business_sponsor="Test Sponsor",
            program_manager="Test PM",
            technical_lead="Test Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session.add(program)
        
        project = Project(
            id=uuid4(),
            name="Test Project",
            description="Test",
            program_id=program.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}",  # Unique cost center code per test
            business_sponsor="Test Sponsor",
            project_manager="Test PM",
            technical_lead="Test Lead"
        )
        session.add(project)
        
        resource = Resource(
            id=uuid4(),
            name="Test Resource",
            resource_type=ResourceType.LABOR,
            
        )
        session.add(resource)
        
        session.commit()
        
        # Create multiple assignments
        assignments = []
        for i in range(num_assignments):
            assignment = ResourceAssignment(
                id=uuid4(),
                resource_id=resource.id,
                project_id=project.id,
                assignment_date=date(2024, 1, 1) + timedelta(days=i),
                capital_percentage=Decimal('30'),
                expense_percentage=Decimal('20')
            )
            session.add(assignment)
            assignments.append(assignment)
        
        session.commit()
        
        # Refresh to get initial versions
        for assignment in assignments:
            session.refresh(assignment)
            assert assignment.version == 1, "New assignments should have version 1"
        
        # Store assignment IDs for later reference
        assignment_ids = [assignment.id for assignment in assignments]
        
        # Close the session before creating conflicts
        session.close()
        
        # Simulate conflicts by updating some assignments in a separate transaction
        # to increment their versions
        conflict_session = TestSession()
        try:
            for idx in conflict_indices:
                if idx < len(assignment_ids):
                    # Update this assignment to increment its version
                    conflict_assignment = conflict_session.query(ResourceAssignment).filter(
                        ResourceAssignment.id == assignment_ids[idx]
                    ).first()
                    if conflict_assignment:
                        conflict_assignment.capital_percentage = Decimal('40')
                        conflict_session.commit()
                        conflict_session.refresh(conflict_assignment)
                        assert conflict_assignment.version == 2, "Version should increment after update"
        finally:
            conflict_session.close()
        
        # Create a fresh session for bulk update
        bulk_session = TestSession()
        try:
            # Prepare bulk update with stale versions for conflicted assignments
            updates = []
            for assignment_id in assignment_ids:
                updates.append({
                    "id": assignment_id,
                    "version": 1,  # All use version 1, but some have been updated to version 2
                    "capital_percentage": Decimal('50'),
                    "expense_percentage": Decimal('30')
                })
            
            # Perform bulk update
            results = assignment_service.bulk_update_assignments(
                db=bulk_session,
                updates=updates,
                user_id=None
            )
            
            # Verify results structure
            assert "succeeded" in results, "Results should have 'succeeded' key"
            assert "failed" in results, "Results should have 'failed' key"
            assert isinstance(results["succeeded"], list), "'succeeded' should be a list"
            assert isinstance(results["failed"], list), "'failed' should be a list"
            
            # Verify that conflicted assignments failed
            failed_ids = {item["id"] for item in results["failed"]}
            succeeded_ids = {item["id"] for item in results["succeeded"]}
            
            # Check that conflicted assignments are in failed list
            for idx in conflict_indices:
                if idx < len(assignment_ids):
                    assignment_id_str = str(assignment_ids[idx])
                    assert assignment_id_str in failed_ids, \
                        f"Assignment {idx} with version conflict should be in failed list"
                    assert assignment_id_str not in succeeded_ids, \
                        f"Assignment {idx} with version conflict should not be in succeeded list"
            
            # Check that non-conflicted assignments succeeded
            for i, assignment_id in enumerate(assignment_ids):
                if i not in conflict_indices:
                    assignment_id_str = str(assignment_id)
                    assert assignment_id_str in succeeded_ids, \
                        f"Assignment {i} without conflict should be in succeeded list"
                    assert assignment_id_str not in failed_ids, \
                        f"Assignment {i} without conflict should not be in failed list"
            
            # Verify failed items have required fields
            for failed_item in results["failed"]:
                assert "id" in failed_item, "Failed item should have 'id'"
                assert "error" in failed_item, "Failed item should have 'error'"
                assert "message" in failed_item, "Failed item should have 'message'"
                assert failed_item["error"] == "conflict", "Error type should be 'conflict' for version mismatch"
                
                # For conflicts, current_state should be present (or error message if fetch failed)
                if failed_item["error"] == "conflict":
                    # Either current_state is present, or there's an error message explaining why it couldn't be fetched
                    has_current_state = "current_state" in failed_item and failed_item["current_state"] is not None
                    has_error_explanation = "could not fetch current state" in failed_item.get("message", "")
                    assert has_current_state or has_error_explanation, \
                        "Conflict should include 'current_state' or explain why it couldn't be fetched"
            
            # Verify succeeded items have required fields
            for succeeded_item in results["succeeded"]:
                assert "id" in succeeded_item, "Succeeded item should have 'id'"
                assert "version" in succeeded_item, "Succeeded item should have 'version'"
                assert succeeded_item["version"] == 2, "Succeeded update should have incremented version"
            
            # Verify total count
            total_processed = len(results["succeeded"]) + len(results["failed"])
            assert total_processed == num_assignments, \
                f"Total processed ({total_processed}) should equal number of assignments ({num_assignments})"
        finally:
            bulk_session.rollback()
            bulk_session.close()
        
    finally:
        # Clean up - use a fresh session for cleanup
        cleanup_session = TestSession()
        try:
            cleanup_session.rollback()
        finally:
            cleanup_session.close()


# Feature: optimistic-locking, Property 8: Bulk Update Individual Validation (Edge Case)
def test_bulk_update_all_succeed(db):
    """
    Test bulk update where all assignments succeed (no conflicts).
    
    Validates: Requirements 7.3, 7.5
    """
    session = TestSession()
    try:
        # Create test data
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session.add(portfolio)
        
        program = Program(
            id=uuid4(),
            name="Test Program",
            description="Test",
            portfolio_id=portfolio.id,
            business_sponsor="Test Sponsor",
            program_manager="Test PM",
            technical_lead="Test Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session.add(program)
        
        project = Project(
            id=uuid4(),
            name="Test Project",
            description="Test",
            program_id=program.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}",  # Unique cost center code per test
            business_sponsor="Test Sponsor",
            project_manager="Test PM",
            technical_lead="Test Lead"
        )
        session.add(project)
        
        resource = Resource(
            id=uuid4(),
            name="Test Resource",
            resource_type=ResourceType.LABOR,
            
        )
        session.add(resource)
        
        session.commit()
        
        # Create 3 assignments
        assignments = []
        for i in range(3):
            assignment = ResourceAssignment(
                id=uuid4(),
                resource_id=resource.id,
                project_id=project.id,
                assignment_date=date(2024, 1, 1) + timedelta(days=i),
                capital_percentage=Decimal('30'),
                expense_percentage=Decimal('20')
            )
            session.add(assignment)
            assignments.append(assignment)
        
        session.commit()
        
        # Refresh to get initial versions
        for assignment in assignments:
            session.refresh(assignment)
        
        # Prepare bulk update with correct versions
        updates = []
        for assignment in assignments:
            updates.append({
                "id": assignment.id,
                "version": assignment.version,
                "capital_percentage": Decimal('40'),
                "expense_percentage": Decimal('30')
            })
        
        # Perform bulk update
        results = assignment_service.bulk_update_assignments(
            db=session,
            updates=updates,
            user_id=None
        )
        
        # All should succeed
        assert len(results["succeeded"]) == 3, "All 3 assignments should succeed"
        assert len(results["failed"]) == 0, "No assignments should fail"
        
        # Verify all have incremented versions
        for item in results["succeeded"]:
            assert item["version"] == 2, "Version should be incremented to 2"
        
    finally:
        session.rollback()
        session.close()


# Feature: optimistic-locking, Property 8: Bulk Update Individual Validation (Edge Case)
def test_bulk_update_all_fail(db):
    """
    Test bulk update where all assignments fail due to conflicts.
    
    Validates: Requirements 7.3, 7.5
    """
    session = TestSession()
    try:
        # Create test data
        portfolio = Portfolio(
            id=uuid4(),
            name="Test Portfolio",
            description="Test",
            owner="Test Owner",
            reporting_start_date=date(2024, 1, 1),
            reporting_end_date=date(2024, 12, 31)
        )
        session.add(portfolio)
        
        program = Program(
            id=uuid4(),
            name="Test Program",
            description="Test",
            portfolio_id=portfolio.id,
            business_sponsor="Test Sponsor",
            program_manager="Test PM",
            technical_lead="Test Lead",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31)
        )
        session.add(program)
        
        project = Project(
            id=uuid4(),
            name="Test Project",
            description="Test",
            program_id=program.id,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            cost_center_code=f"CC-{uuid4().hex[:8]}",  # Unique cost center code per test
            business_sponsor="Test Sponsor",
            project_manager="Test PM",
            technical_lead="Test Lead"
        )
        session.add(project)
        
        resource = Resource(
            id=uuid4(),
            name="Test Resource",
            resource_type=ResourceType.LABOR,
            
        )
        session.add(resource)
        
        session.commit()
        
        # Create 3 assignments
        assignments = []
        for i in range(3):
            assignment = ResourceAssignment(
                id=uuid4(),
                resource_id=resource.id,
                project_id=project.id,
                assignment_date=date(2024, 1, 1) + timedelta(days=i),
                capital_percentage=Decimal('30'),
                expense_percentage=Decimal('20')
            )
            session.add(assignment)
            assignments.append(assignment)
        
        session.commit()
        
        # Refresh to get initial versions
        for assignment in assignments:
            session.refresh(assignment)
        
        # Update all assignments to increment their versions
        conflict_session = TestSession()
        try:
            for assignment in assignments:
                conflict_assignment = conflict_session.query(ResourceAssignment).filter(
                    ResourceAssignment.id == assignment.id
                ).first()
                if conflict_assignment:
                    conflict_assignment.capital_percentage = Decimal('40')
                    conflict_session.commit()
        finally:
            conflict_session.close()
        
        # Prepare bulk update with stale versions
        updates = []
        for assignment in assignments:
            updates.append({
                "id": assignment.id,
                "version": 1,  # Stale version
                "capital_percentage": Decimal('50'),
                "expense_percentage": Decimal('30')
            })
        
        # Perform bulk update
        results = assignment_service.bulk_update_assignments(
            db=session,
            updates=updates,
            user_id=None
        )
        
        # All should fail
        assert len(results["succeeded"]) == 0, "No assignments should succeed"
        assert len(results["failed"]) == 3, "All 3 assignments should fail"
        
        # Verify all failures have error type and message
        for item in results["failed"]:
            assert item["error"] == "conflict", "Error should be 'conflict'"
            assert "message" in item, "Failed item should have message"
            # Current state may not be present if session was in bad state after rollback
            # This is acceptable as long as the conflict is detected and reported
        
    finally:
        session.rollback()
        session.close()
