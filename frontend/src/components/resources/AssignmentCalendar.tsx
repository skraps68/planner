import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import { useResourceAssignments } from '../../hooks/useAssignments'
import { ResourceAssignment } from '../../types'

interface AssignmentCalendarProps {
  resourceId: string
}

interface DayAssignment {
  date: string
  assignments: ResourceAssignment[]
  totalAllocation: number
}

const AssignmentCalendar = ({ resourceId }: AssignmentCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Use React Query hook for assignments data
  const { data: assignments = [], isLoading: loading, error: queryError } = useResourceAssignments(resourceId)
  
  const error = queryError ? (queryError as any).response?.data?.detail || 'Failed to load assignments' : null

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getAssignmentsForDate = (date: Date): DayAssignment => {
    const dateStr = date.toISOString().split('T')[0]
    const dayAssignments = assignments.filter((a) => a.assignment_date === dateStr)
    const totalAllocation = dayAssignments.reduce((sum, a) => sum + a.capital_percentage + a.expense_percentage, 0)

    return {
      date: dateStr,
      assignments: dayAssignments,
      totalAllocation,
    }
  }

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handlePreviousMonth}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6">{monthName}</Typography>
          <IconButton onClick={handleNextMonth}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Box
              key={day}
              sx={{
                p: 1,
                textAlign: 'center',
                fontWeight: 'bold',
                borderBottom: '2px solid',
                borderColor: 'divider',
              }}
            >
              {day}
            </Box>
          ))}

          {Array.from({ length: startingDayOfWeek }).map((_, index) => (
            <Box key={`empty-${index}`} sx={{ p: 1, minHeight: 80 }} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1
            const date = new Date(year, month, day)
            const dayAssignment = getAssignmentsForDate(date)
            const isOverAllocated = dayAssignment.totalAllocation > 100

            return (
              <Tooltip
                key={day}
                title={
                  dayAssignment.assignments.length > 0
                    ? `${dayAssignment.assignments.length} assignment(s) - ${dayAssignment.totalAllocation}%`
                    : 'No assignments'
                }
              >
                <Box
                  sx={{
                    p: 1,
                    minHeight: 80,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: isOverAllocated
                      ? 'error.light'
                      : dayAssignment.assignments.length > 0
                      ? 'primary.light'
                      : 'background.paper',
                    cursor: dayAssignment.assignments.length > 0 ? 'pointer' : 'default',
                    '&:hover': {
                      backgroundColor: isOverAllocated
                        ? 'error.main'
                        : dayAssignment.assignments.length > 0
                        ? 'primary.main'
                        : 'action.hover',
                    },
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {day}
                  </Typography>
                  {dayAssignment.assignments.length > 0 && (
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={`${dayAssignment.totalAllocation}%`}
                        size="small"
                        color={isOverAllocated ? 'error' : 'primary'}
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                  )}
                </Box>
              </Tooltip>
            )
          })}
        </Box>

        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                backgroundColor: 'primary.light',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Typography variant="caption">Assigned</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                backgroundColor: 'error.light',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Typography variant="caption">Over-allocated (&gt;100%)</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default AssignmentCalendar
