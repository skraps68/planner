import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
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
import { AssignmentUsageChart } from './AssignmentUsageChart'
import { getAssignmentsGridBoundaryStrokeCenter } from './assignmentGridConstants'
import { buildAssignmentPeriods } from './assignmentPeriods'

describe('AssignmentsGrid', () => {
  it('centers thick overlays on table borders, including the plot origin', () => {
    expect(getAssignmentsGridBoundaryStrokeCenter(0)).toBe(1)
    expect(getAssignmentsGridBoundaryStrokeCenter(42)).toBe(41)
  })

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

  it('aligns the reporting boundary across row-spanned Capital and Expense rows', () => {
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 6, 29)),
      new Date(Date.UTC(2026, 6, 30)),
      new Date(Date.UTC(2026, 6, 31)),
    ], 'daily')

    render(
      <AssignmentsGrid
        ariaLabel="Row-spanned assignments"
        periods={periods}
        viewMode="daily"
        onViewModeChange={vi.fn()}
        primaryHeader="Resource"
        primaryHeaderAriaLabel="Resource name"
        chartVisible={false}
        chartConfig={{
          title: 'Usage',
          subtitle: 'Assignments',
          seriesLabel: 'Plan',
          values: [0, 0, 0],
          reportingDate: '2026-07-30',
        }}
      >
        <TableRow>
          <AssignmentsGridCell rowSpan={2}>AWS Cloud Services</AssignmentsGridCell>
          <AssignmentsGridCell>Cap $</AssignmentsGridCell>
          <AssignmentsGridCell>cap-29</AssignmentsGridCell>
          <AssignmentsGridCell>cap-30</AssignmentsGridCell>
          <AssignmentsGridCell>cap-31</AssignmentsGridCell>
        </TableRow>
        <TableRow data-assignment-rowspan-continuation="true">
          <AssignmentsGridCell>Exp $</AssignmentsGridCell>
          <AssignmentsGridCell>exp-29</AssignmentsGridCell>
          <AssignmentsGridCell>exp-30</AssignmentsGridCell>
          <AssignmentsGridCell>exp-31</AssignmentsGridCell>
        </TableRow>
      </AssignmentsGrid>,
    )

    const capitalBoundaryCell = screen.getByText('cap-29').closest('td')!
    expect(getComputedStyle(capitalBoundaryCell).borderRight)
      .toBe('2px dashed rgb(211, 47, 47)')
    const expenseBoundaryCell = screen.getByText('exp-29').closest('td')!
    expect(getComputedStyle(expenseBoundaryCell).borderRight)
      .toBe('2px dashed rgb(211, 47, 47)')
    const todayExpenseCell = screen.getByText('exp-30').closest('td')!
    expect(getComputedStyle(todayExpenseCell).borderLeftColor)
      .not.toBe('rgb(211, 47, 47)')
    expect(getComputedStyle(todayExpenseCell).borderLeftWidth)
      .not.toBe('2px')
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

  it('shows compact year bands in Daily and Weekly views without adding one to Monthly', () => {
    const sourceDates = [
      new Date(Date.UTC(2026, 11, 20)),
      new Date(Date.UTC(2027, 0, 9)),
    ]
    const grid = (viewMode: 'daily' | 'weekly' | 'monthly') => {
      const periods = buildAssignmentPeriods(sourceDates, viewMode)
      return (
        <AssignmentsGrid
          ariaLabel={`${viewMode} year bands`}
          periods={periods}
          viewMode={viewMode}
          onViewModeChange={vi.fn()}
          primaryHeader="Resource"
          primaryHeaderAriaLabel="Resource name"
        >
          <TableRow>
            <AssignmentsGridCell>Total</AssignmentsGridCell>
            <AssignmentsGridCell>%</AssignmentsGridCell>
            {periods.map((period) => (
              <AssignmentsGridCell key={period.key}>0</AssignmentsGridCell>
            ))}
          </TableRow>
        </AssignmentsGrid>
      )
    }
    const { rerender } = render(grid('daily'))
    const dailyPeriodCount = buildAssignmentPeriods(sourceDates, 'daily').length
    const dailyGrid = screen.getByRole('grid', { name: 'daily year bands' })

    expect(screen.getByTestId('assignment-year-2026')).toHaveTextContent('2026')
    expect(screen.getByTestId('assignment-year-2027')).toHaveTextContent('2027')
    expect(dailyGrid.querySelectorAll('thead tr')).toHaveLength(1)
    expect(dailyGrid.querySelectorAll('thead th'))
      .toHaveLength(dailyPeriodCount + 2)
    expect(dailyGrid.querySelectorAll('colgroup col'))
      .toHaveLength(dailyPeriodCount + 2)

    rerender(grid('weekly'))
    expect(screen.getByTestId('assignment-year-2026/27'))
      .toHaveTextContent('2026/27')

    rerender(grid('monthly'))
    expect(screen.queryByTestId('assignment-year-band')).not.toBeInTheDocument()
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

    expect(screen.getByRole('button', { name: 'Curr Fcst values' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(screen.getByRole('group', {
        name: 'Plan and actual display',
      })).getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Plan', 'Actual', 'Variance', 'Curr Fcst'])
    expect(screen.getByText('Actuals through 7/27')).toBeInTheDocument()
    expect(screen.getByLabelText(/Status key:/)).toBeInTheDocument()
    expect(screen.getByText('◷')).toHaveStyle({ color: '#a66300' })
    expect(screen.getByText('!')).toHaveStyle({ color: '#d32f2f' })
    expect(screen.getByText('+')).toHaveStyle({ color: '#a66300' })

    await user.click(screen.getByRole('button', { name: 'Variance values' }))
    expect(onDisplayModeChange).toHaveBeenCalledWith('variance')
  })

  it('colors pending and unplanned markers amber and missing markers red', () => {
    const comparison = (state: 'pending' | 'missing' | 'unplanned') => ({
      plan: state === 'unplanned' ? 0 : 50,
      actual: state === 'unplanned' ? 25 : 0,
      combined: state === 'unplanned' ? 25 : 50,
      variance: state === 'unplanned' ? 25 : 0,
      state,
      actualDays: state === 'unplanned' ? 1 : 0,
      missingDays: state === 'missing' ? 1 : 0,
      pendingDays: state === 'pending' ? 1 : 0,
      totalDays: 1,
    })

    render(
      <>
        {(['pending', 'missing', 'unplanned'] as const).map((state) => (
          <AssignmentComparisonValue
            key={state}
            comparison={comparison(state)}
            mode="combined"
            formatValue={(value) => String(value)}
          />
        ))}
      </>,
    )

    expect(screen.getByText('◷')).toHaveStyle({ color: '#a66300' })
    expect(screen.getByText('!')).toHaveStyle({ color: '#d32f2f' })
    expect(screen.getByText('+')).toHaveStyle({ color: '#a66300' })
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
    expect(screen.getByLabelText(
      'Plan 75% · Actual 70% · Variance -5%',
    )).toBeInTheDocument()

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
    expect(screen.getByLabelText(
      'Actual 70% · Plan 75% · Variance -5%',
    )).toBeInTheDocument()

    rerender(
      <AssignmentComparisonValue
        comparison={comparison}
        mode="variance"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )
    expect(screen.getByText('-5%')).toBeInTheDocument()
    expect(screen.getByLabelText(
      'Variance -5% · Plan 75% · Actual 70%',
    )).toBeInTheDocument()

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
    expect(screen.getByLabelText(
      'Plan 75% · Actual 70% · Variance -5%',
    )).toBeInTheDocument()
  })

  it('uses concise pending hover text in Plan mode', () => {
    const { rerender } = render(
      <AssignmentComparisonValue
        comparison={{
          plan: 50,
          actual: 0,
          combined: 50,
          variance: 0,
          state: 'pending',
          actualDays: 0,
          missingDays: 0,
          pendingDays: 1,
          totalDays: 1,
        }}
        mode="plan"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )

    expect(screen.getByLabelText(
      'Plan 50% · Actual pending',
    )).toBeInTheDocument()
    expect(screen.queryByLabelText(/Actual pending ·/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/No actual loaded/)).not.toBeInTheDocument()

    rerender(
      <AssignmentComparisonValue
        comparison={{
          plan: 50,
          actual: 0,
          combined: 50,
          variance: 0,
          state: 'pending',
          actualDays: 0,
          missingDays: 0,
          pendingDays: 1,
          totalDays: 1,
        }}
        mode="actual"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )
    expect(screen.getByLabelText(
      'Actual pending · Plan 50%',
    )).toBeInTheDocument()
    expect(screen.queryByLabelText(/No actual loaded/)).not.toBeInTheDocument()

    rerender(
      <AssignmentComparisonValue
        comparison={{
          plan: 50,
          actual: 0,
          combined: 50,
          variance: 0,
          state: 'pending',
          actualDays: 0,
          missingDays: 0,
          pendingDays: 1,
          totalDays: 1,
        }}
        mode="variance"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )
    expect(screen.getByLabelText(
      'Variance pending · Plan 50%',
    )).toBeInTheDocument()
    expect(screen.queryByLabelText(/No actual loaded/)).not.toBeInTheDocument()

    rerender(
      <AssignmentComparisonValue
        comparison={{
          plan: 50,
          actual: 0,
          combined: 50,
          variance: 0,
          state: 'pending',
          actualDays: 0,
          missingDays: 0,
          pendingDays: 1,
          totalDays: 1,
        }}
        mode="combined"
        formatValue={(value) => String(value)}
        suffix="%"
      />,
    )
    expect(screen.getByLabelText(
      'Plan 50% · Actual pending',
    )).toBeInTheDocument()
    expect(screen.queryByLabelText(/No actual loaded/)).not.toBeInTheDocument()
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
          projectStartDate: '2026-01-04',
          projectEndDate: '2026-01-10',
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
      name: 'Date: January 6, 2026',
    })).toHaveStyle({
      borderRight: '2px dashed #d32f2f',
    })
    expect(screen.getByTestId('reporting-date-boundary')).toHaveAttribute('x1', '125')
    expect(screen.getByTestId('reporting-date-boundary')).toHaveAttribute('x2', '125')
    expect(screen.getByTestId('reporting-date-boundary')).toHaveAttribute(
      'stroke-dasharray',
      '4 3',
    )
    expect(screen.getByTestId('assignment-year-reporting-boundary')).toHaveStyle({
      left: '357px',
      width: '2px',
    })
    expect(screen.getByTestId('assignment-year-reporting-boundary')).toHaveStyle({
      backgroundImage: 'repeating-linear-gradient(to bottom, #d32f2f 0 4px, transparent 4px 7px)',
    })
    expect(screen.getByTestId('project-start-boundary')).toHaveAttribute('x1', '1')
    expect(screen.getByTestId('project-end-boundary')).toHaveAttribute('x1', '293')
    expect(screen.getByTestId('assignment-year-project-start-boundary')).toHaveStyle({
      left: '233px',
      backgroundColor: '#2e7d32',
    })
    expect(screen.getByTestId('assignment-year-project-end-boundary')).toHaveStyle({
      left: '525px',
      backgroundColor: '#d32f2f',
    })
    expect(screen.getByRole('columnheader', {
      name: 'Date: January 4, 2026',
    })).toHaveStyle({
      borderLeft: '2px solid #2e7d32',
    })
    expect(screen.getByRole('columnheader', {
      name: 'Date: January 10, 2026',
    })).toHaveStyle({
      borderRight: '2px solid #d32f2f',
    })
    expect(screen.getByTestId('assignment-chart-boundary-7')).toHaveAttribute(
      'x1',
      '293',
    )
    expect(screen.getByTestId('assignment-year-boundary-7')).toHaveStyle({
      left: '525px',
      width: '2px',
    })
    const delta = screen.getByTestId('assignment-delta-label')
    const actualPoint = screen.getByTestId('assignment-actual-point')
    expect(delta).toHaveTextContent('Δ+10%')
    expect(Number(delta.getAttribute('y'))).toBeLessThan(
      Number(actualPoint.getAttribute('cy')),
    )
    expect(screen.getByTestId('assignment-plan-line')).not.toHaveAttribute(
      'stroke-dasharray',
    )
    expect(screen.getAllByTestId('assignment-plan-point')[0]).toHaveAttribute(
      'fill',
      '#fff',
    )
    expect(screen.getByTestId('assignment-actual-line')).toHaveAttribute(
      'stroke-dasharray',
      '1.5 3',
    )
    expect(actualPoint).toHaveAttribute('fill', '#445968')
    expect(screen.getByTestId('assignment-plan-legend-swatch')).toBeInTheDocument()
    expect(screen.getByTestId('assignment-actual-legend-swatch')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide allocation chart' }))

    expect(screen.queryByTestId('assignment-usage-chart')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show allocation chart' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('uses mode-specific shading without changing plan and actual line semantics', () => {
    const periods = buildAssignmentPeriods([
      new Date(Date.UTC(2026, 0, 4)),
      new Date(Date.UTC(2026, 0, 5)),
    ], 'daily')
    const comparisons = periods.map((_period, index) => ({
      plan: 70 + index * 10,
      actual: 80 + index * 5,
      combined: 80 + index * 5,
      variance: 10 - index * 5,
      state: 'actualized' as const,
      actualDays: 1,
      missingDays: 0,
      pendingDays: 0,
      totalDays: 1,
    }))
    const chart = (displayMode: 'plan' | 'actual' | 'variance') => (
      <AssignmentUsageChart
        periods={periods}
        periodWidth={24}
        identityWidth={200}
        config={{
          title: 'Allocation over time',
          subtitle: 'Total Allocation %',
          seriesLabel: 'Total allocation',
          values: comparisons.map((comparison) => comparison.plan),
          comparisons,
          displayMode,
          deltaFormatter: (value) => `${value > 0 ? '+' : ''}${value}%`,
          capacityLimit: 100,
        }}
      />
    )
    const { rerender } = render(chart('plan'))

    expect(screen.getByTestId('assignment-plan-area')).toBeInTheDocument()
    expect(screen.queryByTestId('assignment-actual-area')).not.toBeInTheDocument()
    expect(screen.getByTestId('assignment-plan-line')).not.toHaveAttribute(
      'stroke-dasharray',
    )
    expect(screen.getByTestId('assignment-actual-line')).toHaveAttribute(
      'stroke-dasharray',
      '1.5 3',
    )

    rerender(chart('actual'))
    expect(screen.getByTestId('assignment-actual-area')).toBeInTheDocument()
    expect(screen.queryByTestId('assignment-plan-area')).not.toBeInTheDocument()

    rerender(chart('variance'))
    expect(screen.getByTestId('assignment-variance-area')).toBeInTheDocument()
    expect(screen.queryByTestId('assignment-actual-area')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('assignment-delta-label')).toHaveLength(2)
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
