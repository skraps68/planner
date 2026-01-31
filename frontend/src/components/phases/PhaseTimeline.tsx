import React, { useState, useRef, useCallback } from 'react'
import { Box, Paper, Typography, Tooltip } from '@mui/material'
import { ProjectPhase, PhaseValidationError } from '../../types'
import { calculateDaysBetween, formatDate, getNextDay, getPreviousDay } from '../../utils/phaseValidation'

interface PhaseTimelineProps {
  phases: Partial<ProjectPhase>[]
  projectStartDate: string
  projectEndDate: string
  validationErrors: PhaseValidationError[]
  onPhaseResize?: (phaseId: string, newStartDate: string, newEndDate: string) => void
  enableResize?: boolean
}

const PHASE_COLORS = [
  '#1976d2', // blue
  '#388e3c', // green
  '#f57c00', // orange
  '#7b1fa2', // purple
  '#c62828', // red
  '#0097a7', // cyan
  '#5d4037', // brown
  '#455a64', // blue grey
  '#e91e63', // pink
  '#00796b', // teal
]

const PhaseTimeline: React.FC<PhaseTimelineProps> = ({
  phases,
  projectStartDate,
  projectEndDate,
  validationErrors,
  onPhaseResize,
  enableResize = false,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragInfo, setDragInfo] = useState<{
    phaseId: string
    boundary: 'start' | 'end'
    initialX: number
    initialDate: string
  } | null>(null)
  const [dragPhases, setDragPhases] = useState<Partial<ProjectPhase>[]>([])
  const dragPhasesRef = useRef<Partial<ProjectPhase>[]>([])
  const timelineRef = useRef<HTMLDivElement>(null)

  const totalDays = calculateDaysBetween(projectStartDate, projectEndDate) + 1

  // Use dragPhases during drag, otherwise use phases prop
  const activePhasesData = isDragging ? dragPhases : phases

  // Sort phases by start date
  const sortedPhases = [...activePhasesData].sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })

  const getPhaseColor = (index: number): string => {
    return PHASE_COLORS[index % PHASE_COLORS.length]
  }

  // Convert pixel position to date
  const pixelToDate = useCallback(
    (pixelX: number): string => {
      if (!timelineRef.current) return projectStartDate

      const rect = timelineRef.current.getBoundingClientRect()
      const relativeX = Math.max(0, Math.min(pixelX - rect.left, rect.width))
      const dayOffset = Math.round((relativeX / rect.width) * totalDays)

      const startDate = new Date(projectStartDate)
      const targetDate = new Date(startDate)
      targetDate.setDate(targetDate.getDate() + dayOffset)

      return targetDate.toISOString().split('T')[0]
    },
    [projectStartDate, totalDays]
  )

  // Handle mouse down on resize handle
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, phaseId: string, boundary: 'start' | 'end', currentDate: string) => {
      if (!enableResize) return

      e.stopPropagation()
      setIsDragging(true)
      // Initialize dragPhases with current phases
      const initialPhases = [...phases]
      setDragPhases(initialPhases)
      dragPhasesRef.current = initialPhases
      setDragInfo({
        phaseId,
        boundary,
        initialX: e.clientX,
        initialDate: currentDate,
      })
    },
    [enableResize, phases]
  )

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragInfo) return

      const newDate = pixelToDate(e.clientX)
      
      // Work with dragPhasesRef (always has latest value)
      const currentDragPhases = dragPhasesRef.current
      const currentPhase = currentDragPhases.find((p) => p.id === dragInfo.phaseId)
      if (!currentPhase || !currentPhase.start_date || !currentPhase.end_date) return

      // Find adjacent phases using current drag phases
      const sortedPhases = [...currentDragPhases].sort((a, b) => {
        if (!a.start_date || !b.start_date) return 0
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      })

      const phaseIndex = sortedPhases.findIndex((p) => p.id === dragInfo.phaseId)
      const previousPhase = phaseIndex > 0 ? sortedPhases[phaseIndex - 1] : null
      const nextPhase = phaseIndex < sortedPhases.length - 1 ? sortedPhases[phaseIndex + 1] : null

      // Create updated phases array
      let updatedPhases = [...currentDragPhases]

      if (dragInfo.boundary === 'start') {
        // Dragging start boundary of current phase
        // This also affects the end boundary of the previous phase
        
        // Constraints:
        // - Can't go before project start (if first phase) or before previous-previous phase end
        // - Can't go after current phase end
        
        const prevPrevPhase = phaseIndex > 1 ? sortedPhases[phaseIndex - 2] : null
        const minDate = prevPrevPhase ? getNextDay(prevPrevPhase.end_date!) : projectStartDate
        const maxDate = getPreviousDay(currentPhase.end_date)

        // Constrain the date to valid range
        let constrainedDate = new Date(newDate)
        const minDateObj = new Date(minDate)
        const maxDateObj = new Date(maxDate)

        if (constrainedDate < minDateObj) {
          constrainedDate = minDateObj
        }
        if (constrainedDate > maxDateObj) {
          constrainedDate = maxDateObj
        }

        const finalDate = constrainedDate.toISOString().split('T')[0]

        // Update current phase start date
        updatedPhases = updatedPhases.map((p) =>
          p.id === dragInfo.phaseId ? { ...p, start_date: finalDate } : p
        )

        // Adjust previous phase end date to maintain continuity
        if (previousPhase && previousPhase.id) {
          const newPreviousEnd = getPreviousDay(finalDate)
          updatedPhases = updatedPhases.map((p) =>
            p.id === previousPhase.id ? { ...p, end_date: newPreviousEnd } : p
          )
        }
      } else {
        // Dragging end boundary of current phase
        // This also affects the start boundary of the next phase
        
        // Constraints:
        // - Can't go before current phase start
        // - Can't go after project end (if last phase) or after next-next phase start
        
        const nextNextPhase = phaseIndex < sortedPhases.length - 2 ? sortedPhases[phaseIndex + 2] : null
        const minDate = getNextDay(currentPhase.start_date)
        const maxDate = nextNextPhase ? getPreviousDay(nextNextPhase.start_date!) : projectEndDate

        // Constrain the date to valid range
        let constrainedDate = new Date(newDate)
        const minDateObj = new Date(minDate)
        const maxDateObj = new Date(maxDate)

        if (constrainedDate < minDateObj) {
          constrainedDate = minDateObj
        }
        if (constrainedDate > maxDateObj) {
          constrainedDate = maxDateObj
        }

        const finalDate = constrainedDate.toISOString().split('T')[0]

        // Update current phase end date
        updatedPhases = updatedPhases.map((p) =>
          p.id === dragInfo.phaseId ? { ...p, end_date: finalDate } : p
        )

        // Adjust next phase start date to maintain continuity
        if (nextPhase && nextPhase.id) {
          const newNextStart = getNextDay(finalDate)
          updatedPhases = updatedPhases.map((p) =>
            p.id === nextPhase.id ? { ...p, start_date: newNextStart } : p
          )
        }
      }

      // Update both state and ref
      dragPhasesRef.current = updatedPhases
      setDragPhases(updatedPhases)
    },
    [isDragging, dragInfo, pixelToDate, projectStartDate, projectEndDate]
  )

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (isDragging && onPhaseResize) {
      // Use ref to get latest drag phases
      const finalDragPhases = dragPhasesRef.current
      if (finalDragPhases.length > 0) {
        // Commit all changes by comparing dragPhases with original phases
        finalDragPhases.forEach((dragPhase) => {
          const originalPhase = phases.find((p) => p.id === dragPhase.id)
          if (
            originalPhase &&
            (originalPhase.start_date !== dragPhase.start_date ||
              originalPhase.end_date !== dragPhase.end_date)
          ) {
            // Phase has changed, commit the update
            onPhaseResize(dragPhase.id!, dragPhase.start_date!, dragPhase.end_date!)
          }
        })
      }
    }

    setIsDragging(false)
    setDragInfo(null)
    setDragPhases([])
    dragPhasesRef.current = []
  }, [isDragging, onPhaseResize, phases])

  // Add/remove event listeners for drag
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const renderPhase = (phase: Partial<ProjectPhase>, index: number) => {
    if (!phase.start_date || !phase.end_date) return null

    const startOffset = calculateDaysBetween(projectStartDate, phase.start_date)
    const duration = calculateDaysBetween(phase.start_date, phase.end_date) + 1
    const widthPercent = (duration / totalDays) * 100
    const leftPercent = (startOffset / totalDays) * 100

    const hasError = validationErrors.some((error) => error.phase_id === phase.id)

    // Check if this is the first or last phase using activePhasesData
    const sortedActivePhasesData = [...activePhasesData].sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })
    const isFirstPhase = sortedActivePhasesData[0]?.id === phase.id
    const isLastPhase = sortedActivePhasesData[sortedActivePhasesData.length - 1]?.id === phase.id

    return (
      <Tooltip
        key={phase.id || index}
        title={
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {phase.name || 'Unnamed Phase'}
            </Typography>
            <Typography variant="caption">
              {formatDate(phase.start_date)} - {formatDate(phase.end_date)}
            </Typography>
            <Typography variant="caption" display="block">
              Duration: {duration} days
            </Typography>
            {phase.description && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {phase.description}
              </Typography>
            )}
            {enableResize && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                Drag edges to resize
              </Typography>
            )}
          </Box>
        }
      >
        <Box
          sx={{
            position: 'absolute',
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            height: '100%',
            backgroundColor: getPhaseColor(index),
            border: hasError ? '2px solid #d32f2f' : 'none',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: enableResize ? 'move' : 'pointer',
            transition: isDragging ? 'none' : 'all 0.2s',
            '&:hover': {
              opacity: 0.8,
              transform: isDragging ? 'none' : 'translateY(-2px)',
            },
          }}
        >
          {/* Left resize handle */}
          {enableResize && !isFirstPhase && phase.start_date && (
            <Box
              onMouseDown={(e) => handleResizeStart(e, phase.id!, 'start', phase.start_date!)}
              sx={{
                position: 'absolute',
                left: -4,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: 'ew-resize',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '4px 0 0 4px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  width: 12,
                  left: -6,
                },
                zIndex: 2,
              }}
            />
          )}

          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              textAlign: 'center',
              px: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {phase.name || 'Unnamed'}
          </Typography>

          {/* Right resize handle */}
          {enableResize && !isLastPhase && phase.end_date && (
            <Box
              onMouseDown={(e) => handleResizeStart(e, phase.id!, 'end', phase.end_date!)}
              sx={{
                position: 'absolute',
                right: -4,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: 'ew-resize',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '0 4px 4px 0',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  width: 12,
                  right: -6,
                },
                zIndex: 2,
              }}
            />
          )}
        </Box>
      </Tooltip>
    )
  }

  const renderGaps = () => {
    const gaps: JSX.Element[] = []

    for (let i = 0; i < sortedPhases.length - 1; i++) {
      const current = sortedPhases[i]
      const next = sortedPhases[i + 1]

      if (!current.end_date || !next.start_date) continue

      const currentEnd = new Date(current.end_date)
      const nextStart = new Date(next.start_date)

      // Check if there's a gap
      const expectedNextStart = new Date(currentEnd)
      expectedNextStart.setDate(expectedNextStart.getDate() + 1)

      if (nextStart.getTime() > expectedNextStart.getTime()) {
        const gapStart = expectedNextStart
        const gapEnd = new Date(nextStart)
        gapEnd.setDate(gapEnd.getDate() - 1)

        const gapStartOffset = calculateDaysBetween(projectStartDate, gapStart.toISOString().split('T')[0])
        const gapDuration = calculateDaysBetween(gapStart.toISOString().split('T')[0], gapEnd.toISOString().split('T')[0]) + 1
        const gapWidthPercent = (gapDuration / totalDays) * 100
        const gapLeftPercent = (gapStartOffset / totalDays) * 100

        gaps.push(
          <Tooltip
            key={`gap-${i}`}
            title={
              <Box>
                <Typography variant="body2" fontWeight="bold" color="error">
                  Timeline Gap
                </Typography>
                <Typography variant="caption">
                  {formatDate(gapStart.toISOString().split('T')[0])} -{' '}
                  {formatDate(gapEnd.toISOString().split('T')[0])}
                </Typography>
                <Typography variant="caption" display="block">
                  {gapDuration} days uncovered
                </Typography>
              </Box>
            }
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${gapLeftPercent}%`,
                width: `${gapWidthPercent}%`,
                height: '100%',
                backgroundColor: 'rgba(211, 47, 47, 0.2)',
                border: '2px dashed #d32f2f',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
              }}
            >
              <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
                GAP
              </Typography>
            </Box>
          </Tooltip>
        )
      }
    }

    return gaps
  }

  const renderOverlaps = () => {
    const overlaps: JSX.Element[] = []

    for (let i = 0; i < sortedPhases.length - 1; i++) {
      const current = sortedPhases[i]
      const next = sortedPhases[i + 1]

      if (!current.end_date || !next.start_date) continue

      const currentEnd = new Date(current.end_date)
      const nextStart = new Date(next.start_date)

      // Check if there's an overlap
      if (nextStart.getTime() <= currentEnd.getTime()) {
        const overlapStart = nextStart
        const overlapEnd = currentEnd

        const overlapStartOffset = calculateDaysBetween(projectStartDate, overlapStart.toISOString().split('T')[0])
        const overlapDuration = calculateDaysBetween(overlapStart.toISOString().split('T')[0], overlapEnd.toISOString().split('T')[0]) + 1
        const overlapWidthPercent = (overlapDuration / totalDays) * 100
        const overlapLeftPercent = (overlapStartOffset / totalDays) * 100

        overlaps.push(
          <Tooltip
            key={`overlap-${i}`}
            title={
              <Box>
                <Typography variant="body2" fontWeight="bold" color="error">
                  Phase Overlap
                </Typography>
                <Typography variant="caption">
                  {current.name} and {next.name} overlap
                </Typography>
                <Typography variant="caption" display="block">
                  {formatDate(overlapStart.toISOString().split('T')[0])} -{' '}
                  {formatDate(overlapEnd.toISOString().split('T')[0])}
                </Typography>
              </Box>
            }
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${overlapLeftPercent}%`,
                width: `${overlapWidthPercent}%`,
                height: '100%',
                backgroundColor: 'rgba(211, 47, 47, 0.3)',
                border: '2px solid #d32f2f',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'help',
                zIndex: 10,
              }}
            >
              <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
                OVERLAP
              </Typography>
            </Box>
          </Tooltip>
        )
      }
    }

    return overlaps
  }

  const renderBoundaryDates = () => {
    const dates: JSX.Element[] = []

    // Render start and end dates for each phase
    sortedPhases.forEach((phase, index) => {
      if (!phase.start_date || !phase.end_date) return

      const startOffset = calculateDaysBetween(projectStartDate, phase.start_date)
      const duration = calculateDaysBetween(phase.start_date, phase.end_date) + 1
      const leftPercent = (startOffset / totalDays) * 100
      const rightPercent = ((startOffset + duration) / totalDays) * 100

      // Start date - top left of phase (include for ALL phases now)
      dates.push(
        <Box
          key={`start-${phase.id || index}`}
          sx={{
            position: 'absolute',
            left: `${leftPercent}%`,
            top: '-20px',
            zIndex: 20,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
            {formatDate(phase.start_date)}
          </Typography>
        </Box>
      )

      // End date - bottom right of phase (include for ALL phases now)
      dates.push(
        <Box
          key={`end-${phase.id || index}`}
          sx={{
            position: 'absolute',
            left: `${rightPercent}%`,
            top: '100%',
            transform: 'translateX(-100%)',
            mt: 0.5,
            zIndex: 20,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
            {formatDate(phase.end_date)}
          </Typography>
        </Box>
      )
    })

    return dates
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Phase Timeline {enableResize && '(Interactive)'}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Box
          ref={timelineRef}
          sx={{
            position: 'relative',
            height: 60,
            backgroundColor: '#f5f5f5',
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            cursor: isDragging ? 'ew-resize' : 'default',
            userSelect: 'none',
            mb: 3,
            mt: 3,
          }}
        >
          {sortedPhases.map((phase, index) => renderPhase(phase, index))}
          {renderGaps()}
          {renderOverlaps()}
          {renderBoundaryDates()}
        </Box>
      </Box>
    </Paper>
  )
}

export default PhaseTimeline
