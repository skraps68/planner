"""
Unit tests for phase validation edge cases.

These tests verify specific edge cases and boundary conditions for the
phase validation service.
"""
from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.services.phase_validator import PhaseValidatorService


class TestPhaseValidationEdgeCases:
    """Unit tests for phase validation edge cases."""
    
    def test_empty_phase_list(self):
        """Test validation with empty phase list."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            []
        )
        
        assert not result.is_valid
        assert len(result.errors) == 1
        assert "at least one phase" in result.errors[0].message.lower()
    
    def test_multiple_gaps(self):
        """Test gap detection with multiple gaps."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase 1",
                "start_date": date(2024, 1, 1),
                "end_date": date(2024, 2, 28)
            },
            # Gap: Feb 29 - March 14 (2024 is a leap year)
            {
                "id": uuid4(),
                "name": "Phase 2",
                "start_date": date(2024, 3, 15),
                "end_date": date(2024, 5, 31)
            },
            # Gap: June 1-14
            {
                "id": uuid4(),
                "name": "Phase 3",
                "start_date": date(2024, 6, 15),
                "end_date": date(2024, 12, 31)
            }
        ]
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        assert not result.is_valid
        # Should detect 2 gaps
        gap_errors = [e for e in result.errors if "gap" in e.message.lower()]
        assert len(gap_errors) == 2
        
        # Verify find_timeline_gaps detects both gaps
        gaps = validator.find_timeline_gaps(project_start, project_end, phases)
        assert len(gaps) == 2
        assert gaps[0] == (date(2024, 2, 29), date(2024, 3, 14))  # 2024 is a leap year
        assert gaps[1] == (date(2024, 6, 1), date(2024, 6, 14))
    
    def test_multiple_overlaps(self):
        """Test overlap detection with multiple overlaps."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase 1",
                "start_date": date(2024, 1, 1),
                "end_date": date(2024, 4, 30)
            },
            {
                "id": uuid4(),
                "name": "Phase 2",
                "start_date": date(2024, 3, 1),  # Overlaps with Phase 1
                "end_date": date(2024, 8, 31)
            },
            {
                "id": uuid4(),
                "name": "Phase 3",
                "start_date": date(2024, 7, 1),  # Overlaps with Phase 2
                "end_date": date(2024, 12, 31)
            }
        ]
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        assert not result.is_valid
        # Should detect overlaps
        overlap_errors = [e for e in result.errors if "overlap" in e.message.lower()]
        assert len(overlap_errors) >= 1
        
        # Verify find_timeline_overlaps detects overlaps
        overlaps = validator.find_timeline_overlaps(phases)
        assert len(overlaps) >= 2  # At least 2 overlapping pairs
    
    def test_boundary_violations_multiple(self):
        """Test multiple boundary violations."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase Before",
                "start_date": date(2023, 12, 1),  # Before project start
                "end_date": date(2024, 3, 31)
            },
            {
                "id": uuid4(),
                "name": "Phase After",
                "start_date": date(2024, 10, 1),
                "end_date": date(2025, 1, 31)  # After project end
            }
        ]
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        assert not result.is_valid
        # Should have errors for both boundary violations
        boundary_errors = [e for e in result.errors 
                          if "project start" in e.message.lower() or "project end" in e.message.lower()]
        assert len(boundary_errors) >= 2
    
    def test_single_phase_covering_entire_project(self):
        """Test single phase that covers entire project duration."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Full Project Phase",
                "start_date": project_start,
                "end_date": project_end
            }
        ]
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_adjacent_phases_no_gap(self):
        """Test adjacent phases with no gap (end + 1 day = next start)."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase 1",
                "start_date": date(2024, 1, 1),
                "end_date": date(2024, 6, 30)
            },
            {
                "id": uuid4(),
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),  # Next day after Phase 1 ends
                "end_date": date(2024, 12, 31)
            }
        ]
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_single_day_phase(self):
        """Test phase that lasts only one day."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 1, 1)  # Single day project
        
        phases = [
            {
                "id": uuid4(),
                "name": "Single Day Phase",
                "start_date": date(2024, 1, 1),
                "end_date": date(2024, 1, 1)
            }
        ]
        
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases
        )
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    def test_validate_single_phase_method(self):
        """Test validate_single_phase method."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        # Valid phase
        result = validator.validate_single_phase(
            "Test Phase",
            date(2024, 3, 1),
            date(2024, 6, 30),
            project_start,
            project_end
        )
        assert result.is_valid
        
        # Invalid: start > end
        result = validator.validate_single_phase(
            "Invalid Phase",
            date(2024, 6, 30),
            date(2024, 3, 1),
            project_start,
            project_end
        )
        assert not result.is_valid
        
        # Invalid: before project start
        result = validator.validate_single_phase(
            "Before Project",
            date(2023, 12, 1),
            date(2024, 3, 1),
            project_start,
            project_end
        )
        assert not result.is_valid
        
        # Invalid: after project end
        result = validator.validate_single_phase(
            "After Project",
            date(2024, 10, 1),
            date(2025, 1, 31),
            project_start,
            project_end
        )
        assert not result.is_valid
        
        # Invalid: empty name
        result = validator.validate_single_phase(
            "",
            date(2024, 3, 1),
            date(2024, 6, 30),
            project_start,
            project_end
        )
        assert not result.is_valid
    
    def test_find_timeline_gaps_no_phases(self):
        """Test find_timeline_gaps with no phases."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        gaps = validator.find_timeline_gaps(project_start, project_end, [])
        
        assert len(gaps) == 1
        assert gaps[0] == (project_start, project_end)
    
    def test_find_timeline_overlaps_no_overlaps(self):
        """Test find_timeline_overlaps with no overlaps."""
        validator = PhaseValidatorService()
        
        phases = [
            {
                "id": uuid4(),
                "name": "Phase 1",
                "start_date": date(2024, 1, 1),
                "end_date": date(2024, 6, 30)
            },
            {
                "id": uuid4(),
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 12, 31)
            }
        ]
        
        overlaps = validator.find_timeline_overlaps(phases)
        
        assert len(overlaps) == 0
    
    def test_exclude_phase_id_parameter(self):
        """Test exclude_phase_id parameter in validate_phase_timeline."""
        validator = PhaseValidatorService()
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phase1_id = uuid4()
        phase2_id = uuid4()
        
        phases = [
            {
                "id": phase1_id,
                "name": "Phase 1",
                "start_date": date(2024, 1, 1),
                "end_date": date(2024, 6, 30)
            },
            {
                "id": phase2_id,
                "name": "Phase 2",
                "start_date": date(2024, 7, 1),
                "end_date": date(2024, 12, 31)
            }
        ]
        
        # Exclude phase2, should fail validation (only phase1 doesn't cover full timeline)
        result = validator.validate_phase_timeline(
            project_start,
            project_end,
            phases,
            exclude_phase_id=phase2_id
        )
        
        assert not result.is_valid
        # Should have error about last phase not ending at project end
        assert any("project end" in e.message.lower() for e in result.errors)
