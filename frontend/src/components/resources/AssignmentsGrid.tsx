import {
  memo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import {
  COLOR_ACCENT,
  COLOR_HEADER_BG,
  COLOR_HEADER_FG,
  COLOR_LINE,
} from '../../theme'
import { validatePercentage } from '../../utils/cellValidation'

export const ASSIGNMENTS_GRID_PRIMARY_WIDTH = 180
export const ASSIGNMENTS_GRID_TYPE_WIDTH = 52
export const ASSIGNMENTS_GRID_DATE_WIDTH = 42
export const ASSIGNMENTS_GRID_ROW_HEIGHT = 24
export const ASSIGNMENTS_GRID_HEADER_HEIGHT = 26
export const ASSIGNMENTS_GRID_CELL_PADDING = '1px 4px'
export const ASSIGNMENTS_GRID_MAX_HEIGHT = 'calc(100vh - 300px)'

export const AssignmentsGridCell = styled(TableCell)({
  height: ASSIGNMENTS_GRID_ROW_HEIGHT,
  padding: `${ASSIGNMENTS_GRID_CELL_PADDING} !important`,
  borderRight: `1px solid ${COLOR_LINE}`,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  '&:last-of-type': {
    borderRight: 0,
  },
})

interface AssignmentsGridProps {
  ariaLabel: string
  dates: Date[]
  primaryHeader: string
  primaryHeaderAriaLabel: string
  formatDate: (date: Date) => string
  children: ReactNode
  scrollContainerRef?: Ref<HTMLDivElement>
  maxHeight?: string | number
  isEditMode?: boolean
}

/**
 * Domain-neutral assignment grid structure. Each perspective supplies its
 * own rows, totals, validation, and save behavior.
 */
export const AssignmentsGrid = ({
  ariaLabel,
  dates,
  primaryHeader,
  primaryHeaderAriaLabel,
  formatDate,
  children,
  scrollContainerRef,
  maxHeight = ASSIGNMENTS_GRID_MAX_HEIGHT,
  isEditMode = false,
}: AssignmentsGridProps) => (
  <TableContainer
    ref={scrollContainerRef}
    sx={{
      width: '100%',
      maxHeight,
      overflow: 'auto',
      border: `1px solid ${isEditMode ? COLOR_ACCENT : COLOR_LINE}`,
      borderRadius: 0,
    }}
  >
    {isEditMode && (
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'sticky',
          left: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          minHeight: 22,
          px: 0.75,
          borderBottom: `1px solid ${COLOR_ACCENT}`,
          backgroundColor: 'rgba(40, 94, 130, 0.08)',
          color: 'primary.dark',
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        EDITING ASSIGNMENTS · TYPE TO REPLACE A VALUE · TAB MOVES BETWEEN CELLS
      </Box>
    )}
    <Table
      aria-label={ariaLabel}
      role="grid"
      size="small"
      padding="none"
      stickyHeader
      sx={{
        width: '100%',
        tableLayout: 'auto',
        '& .MuiTableCell-root': {
          height: `${ASSIGNMENTS_GRID_ROW_HEIGHT}px !important`,
          padding: `${ASSIGNMENTS_GRID_CELL_PADDING} !important`,
          borderRight: `1px solid ${COLOR_LINE}`,
          lineHeight: 1.15,
          whiteSpace: 'nowrap',
        },
        '& .MuiTableCell-root:last-of-type': {
          borderRight: 0,
        },
        '& .MuiTableCell-head': {
          height: `${ASSIGNMENTS_GRID_HEADER_HEIGHT}px !important`,
          padding: `${ASSIGNMENTS_GRID_CELL_PADDING} !important`,
        },
      }}
    >
      <TableHead>
        <TableRow role="row">
          <AssignmentsGridCell
            aria-label={primaryHeaderAriaLabel}
            role="columnheader"
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 4,
              height: ASSIGNMENTS_GRID_HEADER_HEIGHT,
              minWidth: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
              backgroundColor: COLOR_HEADER_BG,
              color: COLOR_HEADER_FG,
            }}
          >
            {primaryHeader}
          </AssignmentsGridCell>
          <AssignmentsGridCell
            aria-label="Cost treatment type"
            role="columnheader"
            sx={{
              position: 'sticky',
              left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
              zIndex: 4,
              height: ASSIGNMENTS_GRID_HEADER_HEIGHT,
              minWidth: ASSIGNMENTS_GRID_TYPE_WIDTH,
              backgroundColor: COLOR_HEADER_BG,
              color: COLOR_HEADER_FG,
            }}
          >
            Type
          </AssignmentsGridCell>
          {dates.map((date) => {
            const label = formatDate(date)
            return (
              <AssignmentsGridCell
                key={date.toISOString()}
                align="center"
                aria-label={`Date: ${label}`}
                role="columnheader"
                sx={{
                  height: ASSIGNMENTS_GRID_HEADER_HEIGHT,
                  minWidth: ASSIGNMENTS_GRID_DATE_WIDTH,
                  backgroundColor: COLOR_HEADER_BG,
                  color: COLOR_HEADER_FG,
                  ...(date.getUTCDay() === 6 && {
                    borderRight: '2px solid #bdbdbd',
                  }),
                }}
              >
                {label}
              </AssignmentsGridCell>
            )
          })}
        </TableRow>
      </TableHead>
      <TableBody>{children}</TableBody>
    </Table>
  </TableContainer>
)

interface AssignmentPercentageCellProps {
  value: number
  isEditMode: boolean
  isEdited: boolean
  hasError: boolean
  errorMessage?: string
  ariaLabel?: string
  onChange: (value: number) => void
  onBlur?: () => void
}

/**
 * Shared percentage-cell mechanics: tabbing, type-to-edit, focus treatment,
 * dirty highlighting, basic numeric input handling, and error presentation.
 * Aggregate allocation rules remain in the perspective-specific controller.
 */
export const AssignmentPercentageCell = memo(({
  value,
  isEditMode,
  isEdited,
  hasError,
  errorMessage,
  ariaLabel = 'Allocation percentage',
  onChange,
  onBlur,
}: AssignmentPercentageCellProps) => {
  const [inputValue, setInputValue] = useState(value.toString())
  const [localError, setLocalError] = useState<string>()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const capturedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isFocused) setInputValue(value.toString())
  }, [isFocused, value])

  useEffect(() => {
    if (!isFocused || !inputRef.current) return

    if (capturedKeyRef.current) {
      const length = inputRef.current.value.length
      inputRef.current.setSelectionRange(length, length)
      capturedKeyRef.current = null
    } else {
      inputRef.current.select()
    }
  }, [isFocused])

  const commitValue = () => {
    if (inputValue === value.toString()) {
      setLocalError(undefined)
      return
    }

    if (inputValue.trim() === '') {
      if (value !== 0) onChange(0)
      setLocalError(undefined)
      return
    }

    const numericValue = Number(inputValue)
    if (!Number.isFinite(numericValue)) {
      setLocalError('Value must be a number')
      return
    }

    const validation = validatePercentage(numericValue)
    if (!validation.isValid) {
      setLocalError(validation.errorMessage)
      return
    }

    if (numericValue !== value) onChange(numericValue)
    setLocalError(undefined)
  }

  const finishEditing = () => {
    commitValue()
    setIsFocused(false)
    onBlur?.()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      finishEditing()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setInputValue(value.toString())
      setLocalError(undefined)
      setIsFocused(false)
      onBlur?.()
    }
  }

  const handleDisplayKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Tab') return

    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      const typedValue = event.key.length === 1 ? event.key : ''
      capturedKeyRef.current = event.key.length === 1 ? event.key : null
      setInputValue(typedValue)
      setIsFocused(true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      capturedKeyRef.current = null
      setIsFocused(true)
    }
  }

  const displayError = hasError || Boolean(localError)
  const displayErrorMessage = errorMessage || localError
  const formattedValue = value === 0 ? '' : String(Math.round(value))
  const backgroundColor = isEdited ? 'rgba(255, 182, 193, 0.3)' : 'transparent'
  const commonSx = {
    display: 'inline-block',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 30,
    maxWidth: ASSIGNMENTS_GRID_DATE_WIDTH - 6,
    minHeight: 18,
    padding: 0,
    textAlign: 'center',
    fontSize: '0.75rem',
    lineHeight: '18px',
    borderRadius: 0,
  } as const

  if (!isEditMode) {
    return (
      <Box
        component="span"
        sx={{
          ...commonSx,
          border: '1px solid transparent',
          backgroundColor: 'transparent',
        }}
      >
        {formattedValue}
      </Box>
    )
  }

  if (isFocused) {
    const input = (
      <Box
        component="input"
        ref={inputRef}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value)
          setLocalError(undefined)
        }}
        onBlur={finishEditing}
        onKeyDown={handleInputKeyDown}
        autoFocus
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        aria-invalid={displayError}
        sx={{
          ...commonSx,
          display: 'block',
          margin: '0 auto',
          border: `2px solid ${displayError ? '#d32f2f' : COLOR_ACCENT}`,
          outline: 'none',
          backgroundColor: isEdited ? 'rgba(255, 193, 7, 0.18)' : '#ffffff',
        }}
      />
    )

    return displayError && displayErrorMessage
      ? <Tooltip title={displayErrorMessage} arrow>{input}</Tooltip>
      : input
  }

  const display = (
    <Box
      component="span"
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-invalid={displayError}
      onClick={() => {
        setInputValue(value === 0 ? '' : String(Math.round(value)))
        capturedKeyRef.current = null
        setIsFocused(true)
      }}
      onKeyDown={handleDisplayKeyDown}
      sx={{
        ...commonSx,
        border: '1px solid transparent',
        borderBottomColor: displayError ? '#d32f2f' : 'rgba(40, 94, 130, 0.32)',
        backgroundColor: isEdited ? 'rgba(255, 193, 7, 0.18)' : backgroundColor,
        cursor: 'text',
        '&:hover': {
          backgroundColor: isEdited
            ? 'rgba(255, 193, 7, 0.24)'
            : 'rgba(40, 94, 130, 0.08)',
        },
        '&:focus': {
          outline: `2px solid ${COLOR_ACCENT}`,
          outlineOffset: '-2px',
          backgroundColor: isEdited
            ? 'rgba(255, 193, 7, 0.24)'
            : 'rgba(40, 94, 130, 0.08)',
          color: 'text.primary',
        },
      }}
    >
      {formattedValue}
    </Box>
  )

  return displayError && displayErrorMessage
    ? <Tooltip title={displayErrorMessage} arrow>{display}</Tooltip>
    : display
})

AssignmentPercentageCell.displayName = 'AssignmentPercentageCell'
