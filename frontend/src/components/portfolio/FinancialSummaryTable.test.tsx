import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import { FinancialSummaryTable } from './FinancialSummaryTable'
import { FinancialTableData } from '../../utils/forecastTransform'

describe('FinancialSummaryTable', () => {
  // Clean up after each test to avoid DOM pollution
  afterEach(() => {
    cleanup()
  })

  it('renders without crashing with null data', () => {
    render(<FinancialSummaryTable data={null} loading={false} error={null} />)
    
    // Check that the table structure is present
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('Actuals')).toBeInTheDocument()
    expect(screen.getByText('Forecast')).toBeInTheDocument()
    expect(screen.getByText('Current Forecast')).toBeInTheDocument()
    expect(screen.getByText('Variance')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    render(<FinancialSummaryTable data={null} loading={true} error={null} />)
    
    // Check for loading spinner
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('displays error state', () => {
    const error = new Error('Test error message')
    render(<FinancialSummaryTable data={null} loading={false} error={error} />)
    
    // Check for error message
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('renders financial data correctly', () => {
    const mockData = {
      budget: { total: 100000, capital: 60000, expense: 40000 },
      actuals: { total: 50000, capital: 30000, expense: 20000 },
      forecast: { total: 40000, capital: 25000, expense: 15000 },
      currentForecast: { total: 90000, capital: 55000, expense: 35000 },
      variance: { total: 10000, capital: 5000, expense: 5000 }
    }

    render(<FinancialSummaryTable data={mockData} loading={false} error={null} />)
    
    // Check that row labels are present
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Capital')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    
    // Check that formatted values are present
    expect(screen.getByText('100,000.00')).toBeInTheDocument()
    expect(screen.getByText('50,000.00')).toBeInTheDocument()
  })

  it('displays + and = symbols', () => {
    render(<FinancialSummaryTable data={null} loading={false} error={null} />)
    
    // Check for symbols in header
    const cells = screen.getAllByText('+')
    expect(cells.length).toBeGreaterThan(0)
    
    const equalCells = screen.getAllByText('=')
    expect(equalCells.length).toBeGreaterThan(0)
  })

  // Task 6.1: Unit tests for FinancialSummaryTable structure
  // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

  describe('Table Structure (Task 6.1)', () => {
    it('displays 3x5 grid structure (3 data rows, 5 data columns)', () => {
      // Requirement 3.1: 3x5 grid with 3 rows and 5 columns
      render(<FinancialSummaryTable data={null} loading={false} error={null} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      // Check for header row (1) + data rows (3) = 4 total rows
      const rows = within(table).getAllByRole('row')
      expect(rows).toHaveLength(4) // 1 header + 3 data rows (Total, Capital, Expense)
      
      // Check header row has 8 cells (Category + Budget + Actuals + + + Forecast + = + Current Forecast + Variance)
      const headerCells = within(rows[0]).getAllByRole('columnheader')
      expect(headerCells).toHaveLength(8)
      
      // Check each data row has 8 cells
      for (let i = 1; i < rows.length; i++) {
        const cells = within(rows[i]).getAllByRole('cell')
        expect(cells).toHaveLength(8)
      }
    })

    it('displays column headers in correct order', () => {
      // Requirement 3.2: Column headers in order: Budget, Actuals, Forecast, Current Forecast, Variance
      render(<FinancialSummaryTable data={null} loading={false} error={null} />)
      
      const table = screen.getByRole('table')
      const headerRow = within(table).getAllByRole('row')[0]
      const headers = within(headerRow).getAllByRole('columnheader')
      
      // Expected order: Category, Budget, Actuals, +, Forecast, =, Current Forecast, Variance
      expect(headers[0]).toHaveTextContent('Category')
      expect(headers[1]).toHaveTextContent('Budget')
      expect(headers[2]).toHaveTextContent('Actuals')
      expect(headers[3]).toHaveTextContent('+')
      expect(headers[4]).toHaveTextContent('Forecast')
      expect(headers[5]).toHaveTextContent('=')
      expect(headers[6]).toHaveTextContent('Current Forecast')
      expect(headers[7]).toHaveTextContent('Variance')
    })

    it('displays row labels in correct order', () => {
      // Requirement 3.3: Row labels in order: Total, Capital, Expense
      render(<FinancialSummaryTable data={null} loading={false} error={null} />)
      
      const table = screen.getByRole('table')
      const rows = within(table).getAllByRole('row')
      
      // Skip header row (index 0), check data rows
      const row1Cells = within(rows[1]).getAllByRole('cell')
      expect(row1Cells[0]).toHaveTextContent('Total')
      
      const row2Cells = within(rows[2]).getAllByRole('cell')
      expect(row2Cells[0]).toHaveTextContent('Capital')
      
      const row3Cells = within(rows[3]).getAllByRole('cell')
      expect(row3Cells[0]).toHaveTextContent('Expense')
    })

    it('displays + and = symbols in correct positions', () => {
      // Requirement 3.4: '+' symbol between Actuals and Forecast
      // Requirement 3.5: '=' symbol between Forecast and Current Forecast
      render(<FinancialSummaryTable data={null} loading={false} error={null} />)
      
      const table = screen.getByRole('table')
      const rows = within(table).getAllByRole('row')
      
      // Check header row
      const headerCells = within(rows[0]).getAllByRole('columnheader')
      expect(headerCells[3]).toHaveTextContent('+') // Between Actuals and Forecast
      expect(headerCells[5]).toHaveTextContent('=') // Between Forecast and Current Forecast
      
      // Check each data row has + and = symbols
      for (let i = 1; i < rows.length; i++) {
        const cells = within(rows[i]).getAllByRole('cell')
        expect(cells[3]).toHaveTextContent('+')
        expect(cells[5]).toHaveTextContent('=')
      }
    })

    it('is visible with empty values on initial load', () => {
      // Requirement 3.6: Table visible with empty or default values
      render(<FinancialSummaryTable data={null} loading={false} error={null} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeVisible()
      
      // Check that all row labels are present
      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('Capital')).toBeInTheDocument()
      expect(screen.getByText('Expense')).toBeInTheDocument()
      
      // Check that all column headers are present
      expect(screen.getByText('Budget')).toBeInTheDocument()
      expect(screen.getByText('Actuals')).toBeInTheDocument()
      expect(screen.getByText('Forecast')).toBeInTheDocument()
      expect(screen.getByText('Current Forecast')).toBeInTheDocument()
      expect(screen.getByText('Variance')).toBeInTheDocument()
      
      // Check that empty values are displayed (formatted as 0.00)
      const formattedZeros = screen.getAllByText('0.00')
      // Should have 15 cells with 0.00 (3 rows × 5 columns)
      expect(formattedZeros.length).toBe(15)
    })
  })

  // Task 6.2: Property test for financial data display
  // Feature: portfolio-dashboard, Property 9: Financial Data Display
  // Validates: Requirements 3.7, 5.1, 5.2, 5.3
  describe('Financial Data Display (Task 6.2)', () => {
    it('property test: table renders Total, Capital, and Expense rows correctly for any FinancialTableData', () => {
      // Generate arbitrary financial data
      const categoryBreakdownArbitrary = fc.record({
        total: fc.double({ min: 0, max: 1e9, noNaN: true }),
        capital: fc.double({ min: 0, max: 1e9, noNaN: true }),
        expense: fc.double({ min: 0, max: 1e9, noNaN: true })
      })

      const financialTableDataArbitrary = fc.record({
        budget: categoryBreakdownArbitrary,
        actuals: categoryBreakdownArbitrary,
        forecast: categoryBreakdownArbitrary,
        currentForecast: categoryBreakdownArbitrary,
        variance: categoryBreakdownArbitrary
      })

      fc.assert(
        fc.property(financialTableDataArbitrary, (data: FinancialTableData) => {
          const { container } = render(
            <FinancialSummaryTable data={data} loading={false} error={null} />
          )

          // Use container to query within this specific render
          const table = within(container).getByRole('table')
          const rows = within(table).getAllByRole('row')

          // Property: Table must have exactly 4 rows (1 header + 3 data rows)
          expect(rows).toHaveLength(4)

          // Skip header row (index 0), check data rows
          // Property: Row 1 must be labeled "Total"
          const totalRowCells = within(rows[1]).getAllByRole('cell')
          expect(totalRowCells[0]).toHaveTextContent('Total')

          // Property: Row 2 must be labeled "Capital"
          const capitalRowCells = within(rows[2]).getAllByRole('cell')
          expect(capitalRowCells[0]).toHaveTextContent('Capital')

          // Property: Row 3 must be labeled "Expense"
          const expenseRowCells = within(rows[3]).getAllByRole('cell')
          expect(expenseRowCells[0]).toHaveTextContent('Expense')

          // Property: Each data row must have exactly 8 cells (Category + 5 data columns + 2 symbol columns)
          expect(totalRowCells).toHaveLength(8)
          expect(capitalRowCells).toHaveLength(8)
          expect(expenseRowCells).toHaveLength(8)

          // Property: All data cells must contain non-empty text (formatted values)
          // Budget column (index 1)
          expect(totalRowCells[1].textContent).toBeTruthy()
          expect(capitalRowCells[1].textContent).toBeTruthy()
          expect(expenseRowCells[1].textContent).toBeTruthy()

          // Actuals column (index 2)
          expect(totalRowCells[2].textContent).toBeTruthy()
          expect(capitalRowCells[2].textContent).toBeTruthy()
          expect(expenseRowCells[2].textContent).toBeTruthy()

          // Symbol column (index 3) - must be '+'
          expect(totalRowCells[3]).toHaveTextContent('+')
          expect(capitalRowCells[3]).toHaveTextContent('+')
          expect(expenseRowCells[3]).toHaveTextContent('+')

          // Forecast column (index 4)
          expect(totalRowCells[4].textContent).toBeTruthy()
          expect(capitalRowCells[4].textContent).toBeTruthy()
          expect(expenseRowCells[4].textContent).toBeTruthy()

          // Symbol column (index 5) - must be '='
          expect(totalRowCells[5]).toHaveTextContent('=')
          expect(capitalRowCells[5]).toHaveTextContent('=')
          expect(expenseRowCells[5]).toHaveTextContent('=')

          // Current Forecast column (index 6)
          expect(totalRowCells[6].textContent).toBeTruthy()
          expect(capitalRowCells[6].textContent).toBeTruthy()
          expect(expenseRowCells[6].textContent).toBeTruthy()

          // Variance column (index 7)
          expect(totalRowCells[7].textContent).toBeTruthy()
          expect(capitalRowCells[7].textContent).toBeTruthy()
          expect(expenseRowCells[7].textContent).toBeTruthy()

          // Clean up after each property test iteration
          cleanup()
        }),
        { numRuns: 100 }
      )
    })
  })
})
