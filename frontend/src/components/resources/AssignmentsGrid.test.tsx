import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableRow } from '@mui/material'
import { render } from '../../test/test-utils'
import { COLOR_HEADER_BG, COLOR_HEADER_FG } from '../../theme'
import {
  AssignmentPercentageCell,
  AssignmentsGrid,
  AssignmentsGridCell,
  ASSIGNMENTS_GRID_HEADER_HEIGHT,
  ASSIGNMENTS_GRID_MAX_HEIGHT,
  ASSIGNMENTS_GRID_ROW_HEIGHT,
} from './AssignmentsGrid'
import { buildAssignmentPeriods } from './assignmentPeriods'

describe('AssignmentsGrid', () => {
  it('provides shared headers, sticky sizing, colors, and scrolling', () => {
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 6, 24)),
      new Date(Date.UTC(2026, 6, 25)), // Saturday
    ], 'daily')

    render(
      <AssignmentsGrid
        ariaLabel="Test assignments"
        periods={periods}
        viewMode="daily"
        onViewModeChange={vi.fn()}
        primaryHeader="Resource"
        primaryHeaderAriaLabel="Resource name"
        isEditMode
      >
        <TableRow>
          <AssignmentsGridCell>Totals</AssignmentsGridCell>
          <AssignmentsGridCell>%</AssignmentsGridCell>
          <AssignmentsGridCell>25</AssignmentsGridCell>
          <AssignmentsGridCell>50</AssignmentsGridCell>
        </TableRow>
      </AssignmentsGrid>
    )

    const grid = screen.getByRole('grid', { name: 'Test assignments' })
    const scroller = grid.parentElement
    const resourceHeader = screen.getByRole('columnheader', { name: 'Resource name' })
    const dateHeader = screen.getByRole('columnheader', { name: 'Date: July 24, 2026' })

    expect(scroller).toHaveStyle({
      maxHeight: ASSIGNMENTS_GRID_MAX_HEIGHT,
      overflow: 'auto',
    })
    expect(resourceHeader).toHaveStyle({
      backgroundColor: COLOR_HEADER_BG,
      color: COLOR_HEADER_FG,
      position: 'sticky',
    })
    expect(getComputedStyle(dateHeader).backgroundColor).toBe('rgb(47, 58, 73)')
    expect(getComputedStyle(dateHeader).color).toBe('rgb(238, 242, 247)')
    expect(getComputedStyle(dateHeader).height).toBe(`${ASSIGNMENTS_GRID_HEADER_HEIGHT}px`)
    expect(screen.getByRole('status')).toHaveTextContent('EDITING ASSIGNMENTS')
    expect(screen.getByRole('button', { name: 'Daily view' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Weekly view' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Monthly view' })).toBeDisabled()
    expect(screen.getByText('Totals').closest('td')).toHaveStyle({
      height: `${ASSIGNMENTS_GRID_ROW_HEIGHT}px`,
      padding: '1px 4px',
    })
  })

  it('uses the consolidated period toggle to request view changes', async () => {
    const user = userEvent.setup()
    const onViewModeChange = vi.fn()
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 5, 28)),
      new Date(Date.UTC(2026, 6, 4)),
    ], 'weekly')

    render(
      <AssignmentsGrid
        ariaLabel="Weekly assignments"
        periods={periods}
        viewMode="weekly"
        onViewModeChange={onViewModeChange}
        primaryHeader="Resource"
        primaryHeaderAriaLabel="Resource name"
      >
        <TableRow>
          <AssignmentsGridCell>Totals</AssignmentsGridCell>
          <AssignmentsGridCell>%</AssignmentsGridCell>
          <AssignmentsGridCell>50</AssignmentsGridCell>
        </TableRow>
      </AssignmentsGrid>
    )

    expect(screen.getByRole('columnheader', {
      name: 'Week: June 28, 2026 through July 4, 2026',
    })).toHaveTextContent('6/28-7/4')

    await user.click(screen.getByRole('button', { name: 'Monthly view' }))
    expect(onViewModeChange).toHaveBeenCalledWith('monthly')
  })

  it('aligns a shared usage chart with the grid and toggles it from the outer toolbar', async () => {
    const user = userEvent.setup()
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 0, 4)),
      new Date(Date.UTC(2026, 0, 10)),
    ], 'daily')

    render(
      <AssignmentsGrid
        ariaLabel="Chart assignments"
        periods={periods}
        viewMode="daily"
        onViewModeChange={vi.fn()}
        primaryHeader="Project"
        primaryHeaderAriaLabel="Project name"
        chartConfig={{
          title: 'Allocation over time',
          subtitle: 'Total Allocation %',
          seriesLabel: 'Total allocation',
          values: [70, 80, 90, 110, 105, 85, 60],
          capacityLimit: 100,
          availableCapacityLabel: 'Available capacity',
        }}
        toolbarActions={<button type="button">Edit</button>}
      >
        <TableRow>
          <AssignmentsGridCell>Totals</AssignmentsGridCell>
          <AssignmentsGridCell>%</AssignmentsGridCell>
          {periods.map((period) => (
            <AssignmentsGridCell key={period.key}>50</AssignmentsGridCell>
          ))}
        </TableRow>
      </AssignmentsGrid>
    )

    const toolbar = screen.getByRole('toolbar', { name: 'Assignment calendar controls' })
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('img', {
      name: 'Allocation over time: Total Allocation %',
    })).toBeInTheDocument()
    expect(screen.getByText('Available capacity')).toBeInTheDocument()
    expect(screen.getByText('Capacity limit')).toBeInTheDocument()
    expect(screen.getByText('Total allocation').parentElement).toHaveStyle({
      left: '10px',
      top: '61px',
    })
    expect(screen.getByText('Available capacity').parentElement).toHaveStyle({
      left: '10px',
      top: '82px',
    })
    expect(screen.getByText('Capacity limit').parentElement).toHaveStyle({
      left: '10px',
      top: '103px',
    })

    await user.click(screen.getByRole('button', { name: 'Hide allocation chart' }))

    expect(screen.queryByTestId('assignment-usage-chart')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show allocation chart' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('provides shared tabbing, type-to-edit, and dirty highlighting mechanics', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onBlur = vi.fn()

    render(
      <AssignmentPercentageCell
        value={25}
        isEditMode
        isEdited
        hasError={false}
        onChange={onChange}
        onBlur={onBlur}
      />
    )

    const display = screen.getByRole('button', { name: 'Allocation percentage' })
    expect(getComputedStyle(display).backgroundColor).toBe('rgba(255, 193, 7, 0.18)')
    expect(getComputedStyle(display).borderRadius).toBe('0')
    expect(getComputedStyle(display).padding).toBe('0px')

    display.focus()
    await user.keyboard('4')

    const input = screen.getByRole('textbox', { name: 'Allocation percentage' })
    expect(input).toHaveValue('4')
    expect(getComputedStyle(input).borderRadius).toBe('0')
    expect(getComputedStyle(input).padding).toBe('0px')

    await user.tab()
    expect(onChange).toHaveBeenCalledWith(4)
    expect(onBlur).toHaveBeenCalledOnce()
  })
})
