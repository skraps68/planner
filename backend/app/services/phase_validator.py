"""
Phase validation service for ensuring timeline continuity and constraints.
"""
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from ..schemas.phase import PhaseValidationError, PhaseValidationResult


class PhaseValidatorService:
    """Service for validating phase timeline continuity and constraints."""
    
    def validate_phase_timeline(
        self,
        project_start: date,
        project_end: date,
        phases: List[Dict],
        exclude_phase_id: Optional[UUID] = None
    ) -> PhaseValidationResult:
        """
        Validate that phases form a continuous, non-overlapping timeline.
        
        Args:
            project_start: Project start date
            project_end: Project end date
            phases: List of phase dictionaries with id, name, start_date, end_date
            exclude_phase_id: Phase ID to exclude from validation (for updates)
            
        Returns:
            PhaseValidationResult with validation status and errors
        """
        errors = []
        
        # Filter out excluded phase (for update scenarios)
        # If exclude_phase_id is None, keep all phases (including new ones with id=None)
        # If exclude_phase_id is set, exclude only that specific phase
        if exclude_phase_id is None:
            active_phases = phases
        else:
            active_phases = [p for p in phases if p.get('id') != exclude_phase_id]
        
        if not active_phases:
            errors.append(PhaseValidationError(
                field="phases",
                message="Project must have at least one phase"
            ))
            return PhaseValidationResult(is_valid=False, errors=errors)
        
        # Sort phases by start_date
        sorted_phases = sorted(active_phases, key=lambda p: p['start_date'])
        
        # Check first phase starts at project start
        if sorted_phases[0]['start_date'] != project_start:
            errors.append(PhaseValidationError(
                field="start_date",
                message=f"First phase must start at project start date ({project_start})",
                phase_id=sorted_phases[0].get('id')
            ))
        
        # Check last phase ends at project end
        if sorted_phases[-1]['end_date'] != project_end:
            errors.append(PhaseValidationError(
                field="end_date",
                message=f"Last phase must end at project end date ({project_end})",
                phase_id=sorted_phases[-1].get('id')
            ))
        
        # Check for gaps and overlaps between adjacent phases
        for i in range(len(sorted_phases) - 1):
            current = sorted_phases[i]
            next_phase = sorted_phases[i + 1]
            
            # Check for gap (next phase should start the day after current ends)
            expected_next_start = current['end_date'] + timedelta(days=1)
            if next_phase['start_date'] > expected_next_start:
                errors.append(PhaseValidationError(
                    field="timeline",
                    message=f"Gap detected between '{current['name']}' (ends {current['end_date']}) and '{next_phase['name']}' (starts {next_phase['start_date']})",
                    phase_id=current.get('id')
                ))
            
            # Check for overlap
            if next_phase['start_date'] <= current['end_date']:
                errors.append(PhaseValidationError(
                    field="timeline",
                    message=f"Overlap detected between '{current['name']}' and '{next_phase['name']}'",
                    phase_id=current.get('id')
                ))
        
        # Validate each phase's basic constraints
        for phase in sorted_phases:
            phase_errors = self._validate_single_phase_constraints(
                phase['name'],
                phase['start_date'],
                phase['end_date'],
                project_start,
                project_end,
                phase.get('id')
            )
            errors.extend(phase_errors)
        
        return PhaseValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
    
    def validate_single_phase(
        self,
        phase_name: str,
        phase_start: date,
        phase_end: date,
        project_start: date,
        project_end: date
    ) -> PhaseValidationResult:
        """
        Validate a single phase's basic constraints.
        
        Args:
            phase_name: Phase name
            phase_start: Phase start date
            phase_end: Phase end date
            project_start: Project start date
            project_end: Project end date
            
        Returns:
            PhaseValidationResult with validation status and errors
        """
        errors = self._validate_single_phase_constraints(
            phase_name,
            phase_start,
            phase_end,
            project_start,
            project_end
        )
        
        return PhaseValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
    
    def _validate_single_phase_constraints(
        self,
        phase_name: str,
        phase_start: date,
        phase_end: date,
        project_start: date,
        project_end: date,
        phase_id: Optional[UUID] = None
    ) -> List[PhaseValidationError]:
        """
        Validate basic constraints for a single phase.
        
        Returns:
            List of validation errors
        """
        errors = []
        
        # Validate name
        if not phase_name or not phase_name.strip():
            errors.append(PhaseValidationError(
                field="name",
                message="Phase name cannot be empty",
                phase_id=phase_id
            ))
        elif len(phase_name) > 100:
            errors.append(PhaseValidationError(
                field="name",
                message="Phase name exceeds maximum length of 100 characters",
                phase_id=phase_id
            ))
        
        # Validate date ordering
        if phase_start > phase_end:
            errors.append(PhaseValidationError(
                field="dates",
                message=f"Phase '{phase_name}': start date must be on or before end date",
                phase_id=phase_id
            ))
        
        # Validate project boundaries
        if phase_start < project_start:
            errors.append(PhaseValidationError(
                field="start_date",
                message=f"Phase '{phase_name}': start date must be on or after project start date ({project_start})",
                phase_id=phase_id
            ))
        
        if phase_end > project_end:
            errors.append(PhaseValidationError(
                field="end_date",
                message=f"Phase '{phase_name}': end date must be on or before project end date ({project_end})",
                phase_id=phase_id
            ))
        
        return errors
    
    def find_timeline_gaps(
        self,
        project_start: date,
        project_end: date,
        phases: List[Dict]
    ) -> List[Tuple[date, date]]:
        """
        Find gaps in phase coverage.
        
        Args:
            project_start: Project start date
            project_end: Project end date
            phases: List of phase dictionaries with start_date, end_date
            
        Returns:
            List of tuples (gap_start, gap_end) representing gaps
        """
        if not phases:
            return [(project_start, project_end)]
        
        gaps = []
        sorted_phases = sorted(phases, key=lambda p: p['start_date'])
        
        # Check gap before first phase
        if sorted_phases[0]['start_date'] > project_start:
            gaps.append((project_start, sorted_phases[0]['start_date'] - timedelta(days=1)))
        
        # Check gaps between phases
        for i in range(len(sorted_phases) - 1):
            current_end = sorted_phases[i]['end_date']
            next_start = sorted_phases[i + 1]['start_date']
            expected_next_start = current_end + timedelta(days=1)
            
            if next_start > expected_next_start:
                gaps.append((expected_next_start, next_start - timedelta(days=1)))
        
        # Check gap after last phase
        if sorted_phases[-1]['end_date'] < project_end:
            gaps.append((sorted_phases[-1]['end_date'] + timedelta(days=1), project_end))
        
        return gaps
    
    def find_timeline_overlaps(
        self,
        phases: List[Dict]
    ) -> List[Tuple[UUID, UUID]]:
        """
        Find overlapping phases.
        
        Args:
            phases: List of phase dictionaries with id, start_date, end_date
            
        Returns:
            List of tuples (phase_id_1, phase_id_2) representing overlapping phases
        """
        overlaps = []
        sorted_phases = sorted(phases, key=lambda p: p['start_date'])
        
        for i in range(len(sorted_phases)):
            for j in range(i + 1, len(sorted_phases)):
                phase1 = sorted_phases[i]
                phase2 = sorted_phases[j]
                
                # Check if phases overlap
                if phase1['start_date'] <= phase2['end_date'] and phase2['start_date'] <= phase1['end_date']:
                    overlaps.append((phase1.get('id'), phase2.get('id')))
        
        return overlaps
