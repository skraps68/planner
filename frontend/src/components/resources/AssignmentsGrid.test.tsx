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
import { AssignmentComparisonValue } from './AssignmentComparisonValue'
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

  it('provides the shared plan/actual mode selector and status key', async () => {
    const user = userEvent.setup()
    const onDisplayModeChange = vi.fn()
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 6, 28)),
    ], 'daily')

    render(
      <AssignmentsGrid
        ariaLabel="Actual comparison assignments"
        periods={periods}
        viewMode="daily"
        onViewModeChange={vi.fn()}
        primaryHeader="Resource"
        primaryHeaderAriaLabel="Resource name"
        displayMode="combined"
        onDisplayModeChange={onDisplayModeChange}
        actualsStatus={<span>Actuals through 7/27</span>}
      >
        <TableRow>
          <AssignmentsGridCell>Total</AssignmentsGridCell>
          <AssignmentsGridCell>%</AssignmentsGridCell>
          <AssignmentsGridCell>75</AssignmentsGridCell>
        </TableRow>
      </AssignmentsGrid>,
    )

    expect(screen.getByRole('button', { name: 'Combined values' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Actuals through 7/27')).toBeInTheDocument()
    expect(screen.getByLabelText(/Status key:/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Variance values' }))
    expect(onDisplayModeChange).toHaveBeenCalledWith('variance')
  })

  it('uses the value itself rather than an A marker for loaded actuals', () => {
    const comparison = {
      plan: 75,
      actual: 70,
      combined: 70,
      variance: -5,
      state: 'actualized' as const,
      actualDays: 1,
      missingDays: 0,
      pendingDays: 0,
      totalDays: 1,
    }
    const { rerender } = render(
      <AssignmentComparisonValue
        comparison={comparison}
        mode="plan"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )

    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.queryByText('A')).not.toBeInTheDocument()

    rerender(
      <AssignmentComparisonValue
        comparison={comparison}
        mode="actual"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.queryByText('A')).not.toBeInTheDocument()

    rerender(
      <AssignmentComparisonValue
        comparison={comparison}
        mode="combined"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.queryByText(/Δ/)).not.toBeInTheDocument()
  })

  it('uses the reporting boundary instead of an F marker for future values', () => {
    render(
      <AssignmentComparisonValue
        comparison={{
          plan: 50,
          actual: 0,
          combined: 50,
          variance: 0,
          state: 'future',
          actualDays: 0,
          missingDays: 0,
          pendingDays: 0,
          totalDays: 1,
        }}
        mode="actual"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )

    expect(screen.queryByText('F')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Future forecast/)).toBeInTheDocument()
  })

  it('aligns a shared usage chart with the grid and toggles it from the outer toolbar', async () => {
    const user = userEvent.setup()
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 0, 4)),
      new Date(Date.UTC(2026, 0, 10)),
    ], 'daily')
    const comparisons = periods.map((_period, index) => ({
      plan: index === 0 ? 70 : 0,
      actual: index === 0 ? 80 : 0,
      combined: index === 0 ? 80 : 0,
      variance: index === 0 ? 10 : 0,
      state: index === 0 ? 'actualized' as const : 'empty' as const,
      actualDays: index === 0 ? 1 : 0,
      missingDays: 0,
      pendingDays: 0,
      totalDays: 1,
    }))

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
          values: [80, 80, 90, 110, 105, 85, 60],
          comparisons,
          displayMode: 'combined',
          deltaFormatter: (value) => `${value > 0 ? '+' : ''}${value}%`,
          capacityLimit: 100,
          availableCapacityLabel: 'Available capacity',
          reportingDate: '2026-01-07',
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
    expect(screen.getByText('Plan').parentElement).toHaveStyle({
      left: '10px',
      top: '82px',
    })
    expect(screen.getByText('Actual').parentElement).toHaveStyle({
      left: '10px',
      top: '103px',
    })
    expect(screen.getByText('Available capacity').parentElement).toHaveStyle({
      left: '10px',
      top: '124px',
    })
    expect(screen.getByText('Capacity limit').parentElement).toHaveStyle({
      left: '10px',
      top: '145px',
    })
    expect(screen.getByRole('columnheader', {
      name: 'Date: January 7, 2026',
    })).toHaveStyle({
      borderLeft: '2px solid #d32f2f',
    })
    expect(screen.getByTestId('reporting-date-boundary')).toHaveAttribute('x1', '126')
    expect(screen.getByTestId('reporting-date-boundary')).toHaveAttribute('x2', '126')
    const delta = screen.getByTestId('assignment-delta-label')
    const actualPoint = screen.getByTestId('assignment-actual-point')
    expect(delta).toHaveTextContent('Δ+10%')
    expect(Number(delta.getAttribute('y'))).toBeLessThan(
      Number(actualPoint.getAttribute('cy')),
    )

    await user.click(screen.getByRole('button', { name: 'Hide allocation chart' }))

    expect(screen.queryByTestId('assignment-usage-chart')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show allocation chart' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders stacked monetary series while retaining the total outline', () => {
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 0, 31)),
      new Date(Date.UTC(2026, 1, 28)),
    ], 'monthly')

    render(
      <AssignmentsGrid
        ariaLabel="Non-labor assignments"
        periods={periods}
        viewMode="monthly"
        onViewModeChange={vi.fn()}
        primaryHeader="Resource"
        primaryHeaderAriaLabel="Resource name"
        chartConfig={{
          title: 'Non-Labor forecast over time',
          subtitle: 'Stacked cash-flow amounts',
          seriesLabel: 'Total forecast',
          values: [150, 250],
          stackedSeries: [
            { label: 'Capital', values: [100, 100], fill: '#cae0f2' },
            { label: 'Expense', values: [50, 150], fill: '#ead9bc' },
          ],
          valueFormatter: (value) => `$${value}`,
        }}
      >
        <TableRow>
          <AssignmentsGridCell>Total</AssignmentsGridCell>
          <AssignmentsGridCell>$</AssignmentsGridCell>
          <AssignmentsGridCell>150</AssignmentsGridCell>
          <AssignmentsGridCell>250</AssignmentsGridCell>
        </TableRow>
      </AssignmentsGrid>
    )

    expect(screen.getByText('Capital')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    expect(screen.queryByText('Total forecast')).not.toBeInTheDocument()
    expect(screen.getByRole('img', {
      name: 'Non-Labor forecast over time: Stacked cash-flow amounts',
    })).toHaveTextContent(
      'Month: January 2026: $150 total · Capital $100 · Expense $50',
    )
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
