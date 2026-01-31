"""
Property-based tests for phase validation service.

These tests use Hypothesis to verify universal properties across all possible
phase configurations.
"""
from datetime import date, timedelta
from uuid import uuid4

import pytest
from hypothesis import given, strategies as st, settings, assume

from app.services.phase_validator import PhaseValidatorService


# Property Tests

@pytest.mark.property_test
class TestPhaseValidationProperties:
    """Property-based tests for phase validation."""
    
    @given(
        project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        project_duration=st.integers(min_value=30, max_value=730),
        num_phases=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_3_timeline_continuity(self, project_start, project_duration, num_phases):
        """
        Property 3: Timeline Continuity
        
        For any project with a valid set of phases, the phases collectively
        should cover every date from the project's start_date to end_date
        with no gaps.
        
        Validates: Requirements 3.1, 3.2, 9.7
        """
        # Ensure we have enough days for the number of phases
        assume(project_duration >= num_phases)
        
        project_end = project_start + timedelta(days=project_duration)
        
        # Generate continuous phases manually
        phases = []
        current_date = project_start
        remaining_days = project_duration
        
        for i in range(num_phases):
            if i == num_phases - 1:
                # Last phase must end at project end
                phase_end = project_end
            else:
                # Distribute days evenly among remaining phases
                days_for_this_phase = remaining_days // (num_phases - i)
                phase_end = current_date + timedelta(days=days_for_this_phase - 1)
                remaining_days -= days_for_this_phase
            
            phases.append({
                "id": uuid4(),
                "name": f"Phase {i+1}",
                "start_date": current_date,
                "end_date": phase_end
            })
            
            current_date = phase_end + timedelta(days=1)
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Continuous phases should always validate successfully
        assert result.is_valid, f"Continuous phases failed validation: {result.errors}"
        
        # Property: No gaps should be found
        gaps = validator.find_timeline_gaps(project_start, project_end, phases)
        assert len(gaps) == 0, f"Found gaps in continuous timeline: {gaps}"
    
    @given(
        project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        project_duration=st.integers(min_value=30, max_value=730),
        gap_size=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_3_timeline_continuity_detects_gaps(self, project_start, project_duration, gap_size):
        """
        Property 3: Timeline Continuity (Gap Detection)
        
        For any project with phases that have gaps, the validation should
        detect and report those gaps.
        
        Validates: Requirements 3.1, 3.2, 9.7
        """
        # Ensure we have enough days to create a gap
        assume(project_duration > gap_size + 2)
        
        project_end = project_start + timedelta(days=project_duration)
        
        # Create first phase
        first_duration = (project_duration - gap_size) // 2
        first_end = project_start + timedelta(days=first_duration)
        
        # Create gap
        second_start = first_end + timedelta(days=gap_size + 1)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase 1",
                "start_date": project_start,
                "end_date": first_end
            },
            {
                "id": uuid4(),
                "name": "Phase 2",
                "start_date": second_start,
                "end_date": project_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phases with gaps should fail validation
        assert not result.is_valid, "Phases with gaps should fail validation"
        
        # Property: At least one error should mention gap
        assert any("gap" in error.message.lower() for error in result.errors), \
            "Validation errors should mention gap"
        
        # Property: find_timeline_gaps should detect the gap
        gaps = validator.find_timeline_gaps(project_start, project_end, phases)
        assert len(gaps) > 0, "find_timeline_gaps should detect gaps"

    @given(
        project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        project_duration=st.integers(min_value=30, max_value=730),
        overlap_days=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_4_no_phase_overlaps(self, project_start, project_duration, overlap_days):
        """
        Property 4: No Phase Overlaps
        
        For any two distinct phases within the same project, their date ranges
        should not overlap.
        
        Validates: Requirements 3.3, 9.6
        """
        # Ensure we have enough days to create an overlap
        assume(project_duration > overlap_days + 2)
        
        project_end = project_start + timedelta(days=project_duration)
        
        # Create first phase
        first_duration = project_duration // 2 + overlap_days
        first_end = project_start + timedelta(days=first_duration)
        
        # Create overlapping second phase (starts before first ends)
        second_start = first_end - timedelta(days=overlap_days)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase 1",
                "start_date": project_start,
                "end_date": first_end
            },
            {
                "id": uuid4(),
                "name": "Phase 2",
                "start_date": second_start,
                "end_date": project_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phases with overlaps should fail validation
        assert not result.is_valid, "Phases with overlaps should fail validation"
        
        # Property: At least one error should mention overlap
        assert any("overlap" in error.message.lower() for error in result.errors), \
            "Validation errors should mention overlap"
        
        # Property: find_timeline_overlaps should detect the overlap
        overlaps = validator.find_timeline_overlaps(phases)
        assert len(overlaps) > 0, "find_timeline_overlaps should detect overlaps"

    @given(
        phase_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        date_offset=st.integers(min_value=-365, max_value=-1)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_5_phase_date_ordering(self, phase_start, date_offset):
        """
        Property 5: Phase Date Ordering
        
        For any phase, the start_date should be less than or equal to the end_date.
        
        Validates: Requirements 3.4, 9.4
        """
        # Create a phase with end_date before start_date (invalid)
        phase_end = phase_start + timedelta(days=date_offset)  # negative offset
        
        # Use a project that encompasses both dates
        project_start = min(phase_start, phase_end) - timedelta(days=10)
        project_end = max(phase_start, phase_end) + timedelta(days=10)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Invalid Phase",
                "start_date": phase_start,
                "end_date": phase_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phase with start_date > end_date should fail validation
        assert not result.is_valid, "Phase with start_date > end_date should fail validation"
        
        # Property: Error should mention date ordering
        assert any("start date" in error.message.lower() and "end date" in error.message.lower() 
                   for error in result.errors), \
            "Validation errors should mention date ordering issue"
    
    @given(
        phase_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        duration=st.integers(min_value=0, max_value=365)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_5_phase_date_ordering_valid(self, phase_start, duration):
        """
        Property 5: Phase Date Ordering (Valid Case)
        
        For any phase where start_date <= end_date, validation should pass
        (assuming other constraints are met).
        
        Validates: Requirements 3.4, 9.4
        """
        # Create a phase with valid date ordering
        phase_end = phase_start + timedelta(days=duration)
        
        # Use a project that encompasses the phase
        project_start = phase_start
        project_end = phase_end
        
        phases = [
            {
                "id": uuid4(),
                "name": "Valid Phase",
                "start_date": phase_start,
                "end_date": phase_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phase with start_date <= end_date should pass validation
        assert result.is_valid, f"Phase with valid date ordering should pass validation: {result.errors}"

    @given(
        project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        project_duration=st.integers(min_value=30, max_value=365),
        days_before=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_6_phase_boundary_constraints_before_project(self, project_start, project_duration, days_before):
        """
        Property 6: Phase Boundary Constraints (Before Project)
        
        For any phase within a project, the phase's start_date should be
        greater than or equal to the project's start_date.
        
        Validates: Requirements 3.5, 3.6, 9.5
        """
        project_end = project_start + timedelta(days=project_duration)
        
        # Create a phase that starts before the project
        phase_start = project_start - timedelta(days=days_before)
        phase_end = project_start + timedelta(days=10)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase Before Project",
                "start_date": phase_start,
                "end_date": phase_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phase starting before project should fail validation
        assert not result.is_valid, "Phase starting before project should fail validation"
        
        # Property: Error should mention project start boundary
        assert any("project start" in error.message.lower() for error in result.errors), \
            "Validation errors should mention project start boundary"
    
    @given(
        project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        project_duration=st.integers(min_value=30, max_value=365),
        days_after=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_6_phase_boundary_constraints_after_project(self, project_start, project_duration, days_after):
        """
        Property 6: Phase Boundary Constraints (After Project)
        
        For any phase within a project, the phase's end_date should be
        less than or equal to the project's end_date.
        
        Validates: Requirements 3.5, 3.6, 9.5
        """
        project_end = project_start + timedelta(days=project_duration)
        
        # Create a phase that ends after the project
        phase_start = project_end - timedelta(days=10)
        phase_end = project_end + timedelta(days=days_after)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase After Project",
                "start_date": phase_start,
                "end_date": phase_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phase ending after project should fail validation
        assert not result.is_valid, "Phase ending after project should fail validation"
        
        # Property: Error should mention project end boundary
        assert any("project end" in error.message.lower() for error in result.errors), \
            "Validation errors should mention project end boundary"
    
    @given(
        project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 12, 31)),
        project_duration=st.integers(min_value=30, max_value=365),
        phase_offset=st.integers(min_value=0, max_value=20),
        phase_duration=st.integers(min_value=1, max_value=20)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_6_phase_boundary_constraints_within_project(self, project_start, project_duration, 
                                                                   phase_offset, phase_duration):
        """
        Property 6: Phase Boundary Constraints (Within Project)
        
        For any phase that falls completely within project boundaries,
        validation should pass boundary constraints (though it may fail
        other constraints like timeline continuity).
        
        Validates: Requirements 3.5, 3.6, 9.5
        """
        # Ensure phase fits within project
        assume(phase_offset + phase_duration <= project_duration)
        
        project_end = project_start + timedelta(days=project_duration)
        
        # Create a phase within project boundaries
        phase_start = project_start + timedelta(days=phase_offset)
        phase_end = phase_start + timedelta(days=phase_duration)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase Within Project",
                "start_date": phase_start,
                "end_date": phase_end
            }
        ]
        
        # Validate
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        # Property: Phase within project boundaries should not have boundary constraint errors
        # (errors about phase being before/after project boundaries)
        boundary_errors = [e for e in result.errors 
                          if ("must be on or after project start" in e.message.lower() or 
                              "must be on or before project end" in e.message.lower())]
        assert len(boundary_errors) == 0, \
            f"Phase within project boundaries should not have boundary constraint errors: {boundary_errors}"
