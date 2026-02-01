import React, { useState, useRef, useCallback } from 'react'
import { Box, Paper, Typography, Tooltip } from '@mui/material'
import { ProjectPhase, PhaseValidationError } from '../../types'
import { calculateDaysBetween, formatDate, getNextDay, getPreviousDay, reorderPhases, recalculatePhaseDates, validateReordering } from '../../utils/phaseValidation'

interface PhaseTimelineProps {
  phases: Partial<ProjectPhase>[]
  projectStartDate: string
  projectEndDate: string
  validationErrors: PhaseValidationError[]
  onPhaseResize?: (phaseId: string, newStartDate: string, newEndDate: string) => void
  enableResize?: boolean
  onPhaseReorder?: (reorderedPhases: Partial<ProjectPhase>[]) => void
  enableReorder?: boolean
}

interface DragDropState {
  draggedPhaseId: string | null
  dropTargetIndex: number | null
  previewPhases: Partial<ProjectPhase>[]
  isDragging: boolean
}

interface KeyboardReorderState {
  isActive: boolean
  focusedPhaseId: string | null
  targetIndex: number | null
  previewPhases: Partial<ProjectPhase>[]
}

interface DropZone {
  index: number  // Insertion index
  position: number  // Pixel position on timeline (percentage)
  isValid: boolean  // Whether drop is valid at this position
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
  onPhaseReorder,
  enableReorder = false,
}) => {
  // Existing resize drag state
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

  // Store color assignments for each phase ID to keep colors consistent
  const phaseColorMapRef = useRef<Map<string, string>>(new Map())

  // New drag-and-drop reordering state
  const [dragDropState, setDragDropState] = useState<DragDropState>({
    draggedPhaseId: null,
    dropTargetIndex: null,
    previewPhases: [],
    isDragging: false,
  })

  // Keyboard reordering state
  const [keyboardReorderState, setKeyboardReorderState] = useState<KeyboardReorderState>({
    isActive: false,
    focusedPhaseId: null,
    targetIndex: null,
    previewPhases: [],
  })

  // Screen reader announcement state
  const [announcement, setAnnouncement] = useState<string>('')

  // Calculate total days for the project timeline
  const totalDays = calculateDaysBetween(projectStartDate, projectEndDate) + 1

  /**
   * Calculate valid drop zones between phases
   * Returns an array of drop zones with their positions and validity
   */
  const calculateDropZones = useCallback((): DropZone[] => {
    if (!dragDropState.isDragging || !dragDropState.draggedPhaseId) {
      return []
    }

    const dropZones: DropZone[] = []
    const draggedIndex = phases.findIndex(p => p.id === dragDropState.draggedPhaseId)
    
    if (draggedIndex === -1) return []

    // Sort phases by start date to get visual order
    const sortedPhasesWithIndices = phases
      .map((phase, originalIndex) => ({ phase, originalIndex }))
      .sort((a, b) => {
        if (!a.phase.start_date || !b.phase.start_date) return 0
        return new Date(a.phase.start_date).getTime() - new Date(b.phase.start_date).getTime()
      })

    // Find the dragged phase in the sorted list
    const draggedSortedIndex = sortedPhasesWithIndices.findIndex(
      item => item.originalIndex === draggedIndex
    )

    // Create drop zones at each position in the sorted list (excluding current position)
    for (let i = 0; i <= sortedPhasesWithIndices.length; i++) {
      // Skip the current position and the position right after it (they're the same)
      if (i === draggedSortedIndex || i === draggedSortedIndex + 1) {
        continue
      }

      let position: number

      if (i === 0) {
        // Drop zone before first phase - at the very start of timeline
        position = 0
      } else if (i === sortedPhasesWithIndices.length) {
        // Drop zone after last phase - at the very end of timeline
        position = 100
      } else {
        // Drop zone between two phases
        const prevPhase = sortedPhasesWithIndices[i - 1].phase
        const nextPhase = sortedPhasesWithIndices[i].phase
        
        if (prevPhase.start_date && prevPhase.end_date && nextPhase.start_date) {
          // Calculate end of previous phase
          const prevEndOffset = calculateDaysBetween(projectStartDate, prevPhase.end_date) + 1
          const prevEndPercent = (prevEndOffset / totalDays) * 100
          
          // Calculate start of next phase
          const nextStartOffset = calculateDaysBetween(projectStartDate, nextPhase.start_date)
          const nextStartPercent = (nextStartOffset / totalDays) * 100
          
          // Position exactly between the two phases
          position = (prevEndPercent + nextStartPercent) / 2
        } else {
          continue
        }
      }

      dropZones.push({
        index: i,
        position,
        isValid: true,
      })
    }

    return dropZones
  }, [dragDropState.isDragging, dragDropState.draggedPhaseId, phases, projectStartDate, totalDays])

  // Use dragPhases during drag, otherwise use phases prop
  const activePhasesData = isDragging ? dragPhases : phases

  // Sort phases by start date
  const sortedPhases = [...activePhasesData].sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })

  const getPhaseColor = (phaseId: string): string => {
    // Check if we already have a color assigned for this phase
    if (phaseColorMapRef.current.has(phaseId)) {
      return phaseColorMapRef.current.get(phaseId)!
    }

    // Sort phases by start date to get consistent ordering
    const sortedPhases = [...phases].sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })

    // Find the index of this phase in the sorted list
    const sortedIndex = sortedPhases.findIndex(p => p.id === phaseId)
    
    // Assign color based on sorted position
    const color = PHASE_COLORS[sortedIndex % PHASE_COLORS.length]
    
    // Cache the color assignment
    phaseColorMapRef.current.set(phaseId, color)
    
    return color
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

  // Drag-and-drop reordering handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, phaseId: string) => {
      if (!enableReorder || phases.length <= 1) return

      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', phaseId)

      const phase = phases.find(p => p.id === phaseId)
      const phaseName = phase?.name || 'Unnamed Phase'

      setDragDropState({
        draggedPhaseId: phaseId,
        dropTargetIndex: null,
        previewPhases: [],
        isDragging: true,
      })

      // Announce to screen readers
      setAnnouncement(`Picked up ${phaseName}. Use arrow keys or drag to reorder.`)
    },
    [enableReorder, phases]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!dragDropState.isDragging || !dragDropState.draggedPhaseId) return

      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    [dragDropState.isDragging, dragDropState.draggedPhaseId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()

      // Drop handling is now done in the drop zones
      // This is just a fallback for drops outside drop zones
      setDragDropState({
        draggedPhaseId: null,
        dropTargetIndex: null,
        previewPhases: [],
        isDragging: false,
      })
    },
    []
  )

  const handleDragEnd = useCallback(() => {
    // Clean up drag state when drag ends (whether dropped or cancelled)
    setDragDropState({
      draggedPhaseId: null,
      dropTargetIndex: null,
      previewPhases: [],
      isDragging: false,
    })

    // Announce cancellation if no drop occurred
    setAnnouncement('Drag cancelled. Phase returned to original position.')
  }, [])

  // Keyboard reordering handlers
  const handlePhaseKeyDown = useCallback(
    (e: React.KeyboardEvent, phaseId: string) => {
      if (!enableReorder || phases.length <= 1) return

      const currentIndex = phases.findIndex(p => p.id === phaseId)
      if (currentIndex === -1) return

      // Enter keyboard reordering mode with Ctrl/Cmd + Shift + M (M for Move)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        const phase = phases.find(p => p.id === phaseId)
        const phaseName = phase?.name || 'Unnamed Phase'
        
        setKeyboardReorderState({
          isActive: true,
          focusedPhaseId: phaseId,
          targetIndex: currentIndex,
          previewPhases: [],
        })

        // Announce to screen readers
        setAnnouncement(`Keyboard reordering mode activated for ${phaseName}. Use arrow keys to move, Enter to confirm, Escape to cancel.`)
        return
      }

      // Only handle arrow keys if keyboard reordering is active
      if (!keyboardReorderState.isActive || keyboardReorderState.focusedPhaseId !== phaseId) {
        return
      }

      const targetIndex = keyboardReorderState.targetIndex ?? currentIndex

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        // Move phase to earlier position
        e.preventDefault()
        const newTargetIndex = Math.max(0, targetIndex - 1)
        
        if (newTargetIndex !== targetIndex) {
          // Calculate preview
          const reordered = reorderPhases(phases, currentIndex, newTargetIndex)
          const preview = recalculatePhaseDates(reordered, projectStartDate, projectEndDate)
          
          setKeyboardReorderState(prev => ({
            ...prev,
            targetIndex: newTargetIndex,
            previewPhases: preview,
          }))

          // Announce position change
          const phase = phases.find(p => p.id === phaseId)
          const phaseName = phase?.name || 'Unnamed Phase'
          setAnnouncement(`${phaseName} will move to position ${newTargetIndex + 1} of ${phases.length}.`)
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        // Move phase to later position
        e.preventDefault()
        const newTargetIndex = Math.min(phases.length - 1, targetIndex + 1)
        
        if (newTargetIndex !== targetIndex) {
          // Calculate preview
          const reordered = reorderPhases(phases, currentIndex, newTargetIndex)
          const preview = recalculatePhaseDates(reordered, projectStartDate, projectEndDate)
          
          setKeyboardReorderState(prev => ({
            ...prev,
            targetIndex: newTargetIndex,
            previewPhases: preview,
          }))

          // Announce position change
          const phase = phases.find(p => p.id === phaseId)
          const phaseName = phase?.name || 'Unnamed Phase'
          setAnnouncement(`${phaseName} will move to position ${newTargetIndex + 1} of ${phases.length}.`)
        }
      } else if (e.key === 'Enter') {
        // Apply reordering
        e.preventDefault()
        
        const phase = phases.find(p => p.id === phaseId)
        const phaseName = phase?.name || 'Unnamed Phase'
        
        if (targetIndex !== currentIndex) {
          const reordered = reorderPhases(phases, currentIndex, targetIndex)
          const recalculated = recalculatePhaseDates(reordered, projectStartDate, projectEndDate)
          
          // Validate the reordering
          const validation = validateReordering(recalculated, projectStartDate, projectEndDate)
          
          if (validation.isValid) {
            if (onPhaseReorder) {
              onPhaseReorder(recalculated)
            }
            // Announce success
            setAnnouncement(`${phaseName} moved to position ${targetIndex + 1}. Reordering complete.`)
          } else {
            console.error('Keyboard reordering validation failed:', validation.error)
            // Announce error
            setAnnouncement(`Reordering failed: ${validation.error}`)
          }
        } else {
          // No change
          setAnnouncement(`${phaseName} remains at position ${currentIndex + 1}.`)
        }
        
        // Exit keyboard reordering mode
        setKeyboardReorderState({
          isActive: false,
          focusedPhaseId: null,
          targetIndex: null,
          previewPhases: [],
        })
      } else if (e.key === 'Escape') {
        // Cancel reordering
        e.preventDefault()
        const phase = phases.find(p => p.id === phaseId)
        const phaseName = phase?.name || 'Unnamed Phase'
        
        setKeyboardReorderState({
          isActive: false,
          focusedPhaseId: null,
          targetIndex: null,
          previewPhases: [],
        })

        // Announce cancellation
        setAnnouncement(`Reordering cancelled. ${phaseName} remains at position ${currentIndex + 1}.`)
      }
    },
    [enableReorder, phases, keyboardReorderState, projectStartDate, projectEndDate, onPhaseReorder]
  )

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

    // Check if this phase is being dragged for reordering
    const isBeingDragged = dragDropState.isDragging && dragDropState.draggedPhaseId === phase.id

    // Check if this phase is in keyboard reordering mode
    const isKeyboardReordering = keyboardReorderState.isActive && keyboardReorderState.focusedPhaseId === phase.id

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
            {enableReorder && phases.length > 1 && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                Drag to reorder or press Ctrl+Shift+M to use keyboard
              </Typography>
            )}
          </Box>
        }
      >
        <Box
          draggable={enableReorder && phases.length > 1}
          onDragStart={(e) => handleDragStart(e, phase.id!)}
          onDragEnd={handleDragEnd}
          tabIndex={enableReorder && phases.length > 1 ? 0 : undefined}
          onKeyDown={(e) => handlePhaseKeyDown(e, phase.id!)}
          role={enableReorder && phases.length > 1 ? 'button' : undefined}
          aria-label={enableReorder && phases.length > 1 
            ? `${phase.name || 'Unnamed Phase'}, ${formatDate(phase.start_date)} to ${formatDate(phase.end_date)}. Press Ctrl+Shift+M to reorder with keyboard.`
            : undefined
          }
          sx={{
            position: 'absolute',
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            height: '100%',
            backgroundColor: getPhaseColor(phase.id!),
            border: hasError 
              ? '2px solid #d32f2f' 
              : isKeyboardReordering 
                ? '3px solid #1976d2' 
                : 'none',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isBeingDragged 
              ? 'grabbing' 
              : enableReorder && phases.length > 1 
                ? 'grab' 
                : enableResize 
                  ? 'move' 
                  : 'pointer',
            opacity: isBeingDragged ? 0.5 : 1,
            transition: isDragging || dragDropState.isDragging ? 'none' : 'all 0.2s',
            boxShadow: isBeingDragged 
              ? '0 4px 8px rgba(0,0,0,0.3)' 
              : isKeyboardReordering 
                ? '0 0 0 3px rgba(25, 118, 210, 0.3)' 
                : 'none',
            '&:hover': {
              opacity: isBeingDragged ? 0.5 : 0.85,
              transform: isDragging || dragDropState.isDragging ? 'none' : 'translateY(-2px)',
              boxShadow: isBeingDragged 
                ? '0 4px 8px rgba(0,0,0,0.3)' 
                : enableReorder && phases.length > 1 
                  ? '0 2px 4px rgba(0,0,0,0.2)' 
                  : 'none',
            },
            '&:active': {
              cursor: enableReorder && phases.length > 1 ? 'grabbing' : undefined,
            },
            '&:focus': {
              outline: enableReorder && phases.length > 1 ? '2px solid #1976d2' : 'none',
              outlineOffset: '2px',
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

  /**
   * Render drop zone indicators during drag operation
   */
  const renderDropZones = () => {
    if (!dragDropState.isDragging) return null

    const dropZones = calculateDropZones()

    return dropZones.map((zone) => {
      const isActive = zone.index === dragDropState.dropTargetIndex

      return (
        <Box
          key={`dropzone-${zone.index}`}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            
            // Update drop target when hovering over this zone
            const draggedIndex = phases.findIndex(p => p.id === dragDropState.draggedPhaseId)
            if (draggedIndex === -1) return

            // Sort phases to get visual order
            const sortedPhasesWithIndices = phases
              .map((phase, originalIndex) => ({ phase, originalIndex }))
              .sort((a, b) => {
                if (!a.phase.start_date || !b.phase.start_date) return 0
                return new Date(a.phase.start_date).getTime() - new Date(b.phase.start_date).getTime()
              })

            // Find dragged phase in sorted list
            const draggedSortedIndex = sortedPhasesWithIndices.findIndex(
              item => item.originalIndex === draggedIndex
            )

            // Calculate target sorted index (where to insert in sorted list)
            let targetSortedIndex = zone.index
            if (zone.index > draggedSortedIndex) {
              targetSortedIndex = zone.index - 1
            }

            // Calculate preview phases
            const reordered = reorderPhases(phases, draggedIndex, sortedPhasesWithIndices[targetSortedIndex]?.originalIndex ?? draggedIndex)
            const preview = recalculatePhaseDates(reordered, projectStartDate, projectEndDate)

            setDragDropState(prev => ({
              ...prev,
              dropTargetIndex: zone.index,
              previewPhases: preview,
            }))
          }}
          onDrop={(e) => {
            e.preventDefault()
            
            if (!dragDropState.draggedPhaseId) return

            const draggedIndex = phases.findIndex(p => p.id === dragDropState.draggedPhaseId)
            if (draggedIndex === -1) {
              setDragDropState({
                draggedPhaseId: null,
                dropTargetIndex: null,
                previewPhases: [],
                isDragging: false,
              })
              return
            }

            // Sort phases to get visual order
            const sortedPhasesWithIndices = phases
              .map((phase, originalIndex) => ({ phase, originalIndex }))
              .sort((a, b) => {
                if (!a.phase.start_date || !b.phase.start_date) return 0
                return new Date(a.phase.start_date).getTime() - new Date(b.phase.start_date).getTime()
              })

            // Find dragged phase in sorted list
            const draggedSortedIndex = sortedPhasesWithIndices.findIndex(
              item => item.originalIndex === draggedIndex
            )

            // Calculate target sorted index
            let targetSortedIndex = zone.index
            if (zone.index > draggedSortedIndex) {
              targetSortedIndex = zone.index - 1
            }

            // Check if this is a no-op
            if (targetSortedIndex === draggedSortedIndex) {
              setDragDropState({
                draggedPhaseId: null,
                dropTargetIndex: null,
                previewPhases: [],
                isDragging: false,
              })
              return
            }

            // Get the target original index
            const targetOriginalIndex = sortedPhasesWithIndices[targetSortedIndex]?.originalIndex ?? draggedIndex

            // Perform reordering
            const reordered = reorderPhases(phases, draggedIndex, targetOriginalIndex)
            const recalculated = recalculatePhaseDates(reordered, projectStartDate, projectEndDate)

            // Validate the reordering
            const validation = validateReordering(recalculated, projectStartDate, projectEndDate)

            const phase = phases.find(p => p.id === dragDropState.draggedPhaseId)
            const phaseName = phase?.name || 'Unnamed Phase'

            if (validation.isValid) {
              if (onPhaseReorder) {
                onPhaseReorder(recalculated)
              }
              // Announce success
              setAnnouncement(`${phaseName} moved to position ${targetSortedIndex + 1}. Reordering complete.`)
            } else {
              // Validation failed - return phases to original order
              console.error('Reordering validation failed:', validation.error)
              // Don't call onPhaseReorder, which keeps the original order
              // Announce error
              setAnnouncement(`Reordering failed: ${validation.error}`)
            }

            // Reset drag state
            setDragDropState({
              draggedPhaseId: null,
              dropTargetIndex: null,
              previewPhases: [],
              isDragging: false,
            })
          }}
          sx={{
            position: 'absolute',
            left: `${zone.position}%`,
            top: -10,
            bottom: -10,
            width: isActive ? '24px' : '16px',
            transform: 'translateX(-50%)',
            backgroundColor: isActive ? 'rgba(25, 118, 210, 0.8)' : 'rgba(25, 118, 210, 0.4)',
            border: isActive ? '3px solid #1976d2' : '2px dashed rgba(25, 118, 210, 0.6)',
            borderRadius: '8px',
            zIndex: 30,
            transition: 'all 0.2s ease-in-out',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'rgba(25, 118, 210, 0.9)',
              width: '32px',
              border: '3px solid #1976d2',
            },
            '&::before': isActive ? {
              content: '""',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '30px',
              height: '30px',
              backgroundColor: '#1976d2',
              borderRadius: '50%',
              opacity: 0.3,
              animation: 'pulse 1s infinite',
            } : undefined,
          }}
        />
      )
    })
  }

  /**
   * Render preview dates for phases during drag operation
   * Shows what the dates will be after the drop
   */
  const renderPreviewDates = () => {
    // Show preview for either drag-and-drop or keyboard reordering
    const previewPhases = dragDropState.isDragging && dragDropState.previewPhases.length > 0
      ? dragDropState.previewPhases
      : keyboardReorderState.isActive && keyboardReorderState.previewPhases.length > 0
        ? keyboardReorderState.previewPhases
        : []

    if (previewPhases.length === 0) {
      return null
    }

    const previewElements: JSX.Element[] = []

    previewPhases.forEach((phase) => {
      if (!phase.start_date || !phase.end_date || !phase.id) return

      // Find the original phase to check if dates changed
      const originalPhase = phases.find(p => p.id === phase.id)
      if (!originalPhase || !originalPhase.start_date || !originalPhase.end_date) return

      // Only show preview if dates changed
      const datesChanged = 
        originalPhase.start_date !== phase.start_date || 
        originalPhase.end_date !== phase.end_date

      if (!datesChanged) return

      const startOffset = calculateDaysBetween(projectStartDate, phase.start_date)
      const duration = calculateDaysBetween(phase.start_date, phase.end_date) + 1
      const leftPercent = (startOffset / totalDays) * 100
      const rightPercent = ((startOffset + duration) / totalDays) * 100

      // Preview start date - above the phase
      previewElements.push(
        <Box
          key={`preview-start-${phase.id}`}
          sx={{
            position: 'absolute',
            left: `${leftPercent}%`,
            top: '-40px',
            zIndex: 25,
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              whiteSpace: 'nowrap', 
              fontSize: '0.7rem',
              color: '#1976d2',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '3px 6px',
              borderRadius: '4px',
              border: '2px solid #1976d2',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            ▶ {formatDate(phase.start_date)}
          </Typography>
        </Box>
      )

      // Preview end date - below the phase
      previewElements.push(
        <Box
          key={`preview-end-${phase.id}`}
          sx={{
            position: 'absolute',
            left: `${rightPercent}%`,
            top: 'calc(100% + 20px)',
            transform: 'translateX(-100%)',
            zIndex: 25,
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              whiteSpace: 'nowrap', 
              fontSize: '0.7rem',
              color: '#1976d2',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '3px 6px',
              borderRadius: '4px',
              border: '2px solid #1976d2',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            ▶ {formatDate(phase.end_date)}
          </Typography>
        </Box>
      )
    })

    return previewElements
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {/* Screen reader announcements */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {announcement}
      </Box>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 0.3;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 0.1;
              transform: translate(-50%, -50%) scale(1.5);
            }
          }
        `}
      </style>
      <Typography variant="h6" gutterBottom>
        Phase Timeline {enableResize && '(Interactive)'}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Box
          ref={timelineRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
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
          {renderDropZones()}
          {renderPreviewDates()}
          {renderBoundaryDates()}
        </Box>
      </Box>
    </Paper>
  )
}

export default PhaseTimeline
