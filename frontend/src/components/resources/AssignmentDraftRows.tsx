import type { ReactNode } from 'react'
import { TableRow, Typography } from '@mui/material'
import {
  AssignmentsGridCell as TableCell,
  ASSIGNMENTS_GRID_PRIMARY_WIDTH,
  getAssignmentsGridPeriodSx,
} from './AssignmentsGrid'
import type { AssignmentPeriod } from './assignmentPeriods'

interface AssignmentDraftRowsProps {
  selector: ReactNode
  periods: AssignmentPeriod[]
}

/** Shared blank capital/expense row pair shown while a new entity is chosen. */
export const AssignmentDraftRows = ({
  selector,
  periods,
}: AssignmentDraftRowsProps) => (
  <>
    <TableRow role="row">
      <TableCell
        rowSpan={2}
        sx={{
          position: 'sticky',
          left: 0,
          zIndex: 3,
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          verticalAlign: 'middle',
          textAlign: 'left !important',
        }}
        role="rowheader"
      >
        {selector}
      </TableCell>
      <TableCell
        sx={{
          position: 'sticky',
          left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
          zIndex: 2,
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          textAlign: 'left !important',
        }}
      >
        <Typography variant="caption" color="primary">Cap %</Typography>
      </TableCell>
      {periods.map((period) => (
        <TableCell key={period.key} sx={getAssignmentsGridPeriodSx(period)} />
      ))}
    </TableRow>
    <TableRow role="row">
      <TableCell
        sx={{
          position: 'sticky',
          left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
          zIndex: 2,
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          textAlign: 'left !important',
        }}
      >
        <Typography variant="caption" color="secondary">Exp %</Typography>
      </TableCell>
      {periods.map((period) => (
        <TableCell key={period.key} sx={getAssignmentsGridPeriodSx(period)} />
      ))}
    </TableRow>
  </>
)

