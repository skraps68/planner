import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { transformForecastData } from './forecastTransform'
import { ForecastApiResponse } from '../api/forecast'

describe('transformForecastData', () => {
  it('should transform API response to financial table data', () => {
    const apiResponse: ForecastApiResponse = {
      entity_id: 'prog-1',
      entity_name: 'Test Program',
      entity_type: 'program',
      budget: {
        total: 1000000,
        capital: 600000,
        expense: 400000
      },
      actual: {
        total: 300000,
        capital: 200000,
        expense: 100000
      },
      forecast: {
        total: 500000,
        capital: 300000,
        expense: 200000
      },
      analysis: {
        budget_remaining: 200000,
        forecast_variance: 0,
        budget_utilization_percentage: 80,
        forecast_to_budget_percentage: 100
      }
    }

    const result = transformForecastData(apiResponse)

    // Verify budget mapping
    expect(result.budget).toEqual(apiResponse.budget)

    // Verify actuals mapping
    expect(result.actuals).toEqual(apiResponse.actual)

    // Verify forecast mapping
    expect(result.forecast).toEqual(apiResponse.forecast)

    // Verify currentForecast calculation (actuals + forecast)
    expect(result.currentForecast.total).toBe(800000) // 300000 + 500000
    expect(result.currentForecast.capital).toBe(500000) // 200000 + 300000
    expect(result.currentForecast.expense).toBe(300000) // 100000 + 200000

    // Verify variance calculation (budget - currentForecast)
    expect(result.variance.total).toBe(200000) // 1000000 - 800000
    expect(result.variance.capital).toBe(100000) // 600000 - 500000
    expect(result.variance.expense).toBe(100000) // 400000 - 300000
  })

  it('should handle zero values correctly', () => {
    const apiResponse: ForecastApiResponse = {
      entity_id: 'proj-1',
      entity_name: 'Test Project',
      entity_type: 'project',
      budget: {
        total: 0,
        capital: 0,
        expense: 0
      },
      actual: {
        total: 0,
        capital: 0,
        expense: 0
      },
      forecast: {
        total: 0,
        capital: 0,
        expense: 0
      },
      analysis: {
        budget_remaining: 0,
        forecast_variance: 0,
        budget_utilization_percentage: 0,
        forecast_to_budget_percentage: 0
      }
    }

    const result = transformForecastData(apiResponse)

    expect(result.currentForecast.total).toBe(0)
    expect(result.currentForecast.capital).toBe(0)
    expect(result.currentForecast.expense).toBe(0)
    expect(result.variance.total).toBe(0)
    expect(result.variance.capital).toBe(0)
    expect(result.variance.expense).toBe(0)
  })

  it('should handle negative variance correctly', () => {
    const apiResponse: ForecastApiResponse = {
      entity_id: 'proj-2',
      entity_name: 'Over Budget Project',
      entity_type: 'project',
      budget: {
        total: 100000,
        capital: 60000,
        expense: 40000
      },
      actual: {
        total: 80000,
        capital: 50000,
        expense: 30000
      },
      forecast: {
        total: 50000,
        capital: 30000,
        expense: 20000
      },
      analysis: {
        budget_remaining: -30000,
        forecast_variance: 0,
        budget_utilization_percentage: 130,
        forecast_to_budget_percentage: 130
      }
    }

    const result = transformForecastData(apiResponse)

    // Current forecast: 80000 + 50000 = 130000
    expect(result.currentForecast.total).toBe(130000)
    
    // Variance: 100000 - 130000 = -30000 (over budget)
    expect(result.variance.total).toBe(-30000)
    expect(result.variance.capital).toBe(-20000) // 60000 - 80000
    expect(result.variance.expense).toBe(-10000) // 40000 - 50000
  })

  // Feature: portfolio-dashboard, Property 5: Current Forecast Calculation
  // Validates: Requirements 4.4
  it('property test: current forecast equals actuals + forecast for any values', () => {
    // Generate arbitrary financial values
    const categoryBreakdownArbitrary = fc.record({
      total: fc.double({ min: 0, max: 1e9, noNaN: true }),
      capital: fc.double({ min: 0, max: 1e9, noNaN: true }),
      expense: fc.double({ min: 0, max: 1e9, noNaN: true })
    })

    const forecastApiResponseArbitrary = fc.record({
      entity_id: fc.string(),
      entity_name: fc.string(),
      entity_type: fc.constantFrom('program' as const, 'project' as const),
      budget: categoryBreakdownArbitrary,
      actual: categoryBreakdownArbitrary,
      forecast: categoryBreakdownArbitrary,
      analysis: fc.record({
        budget_remaining: fc.double({ noNaN: true }),
        forecast_variance: fc.double({ noNaN: true }),
        budget_utilization_percentage: fc.double({ noNaN: true }),
        forecast_to_budget_percentage: fc.double({ noNaN: true })
      })
    })

    fc.assert(
      fc.property(forecastApiResponseArbitrary, (apiResponse) => {
        const result = transformForecastData(apiResponse)

        // Property: For any actuals A and forecast F, current forecast = A + F
        const expectedTotal = apiResponse.actual.total + apiResponse.forecast.total
        const expectedCapital = apiResponse.actual.capital + apiResponse.forecast.capital
        const expectedExpense = apiResponse.actual.expense + apiResponse.forecast.expense

        // Allow for floating point precision errors
        const epsilon = 1e-10
        expect(Math.abs(result.currentForecast.total - expectedTotal)).toBeLessThan(epsilon)
        expect(Math.abs(result.currentForecast.capital - expectedCapital)).toBeLessThan(epsilon)
        expect(Math.abs(result.currentForecast.expense - expectedExpense)).toBeLessThan(epsilon)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: portfolio-dashboard, Property 6: Variance Calculation
  // Validates: Requirements 4.5
  it('property test: variance equals budget minus current forecast for any values', () => {
    // Generate arbitrary financial values
    const categoryBreakdownArbitrary = fc.record({
      total: fc.double({ min: 0, max: 1e9, noNaN: true }),
      capital: fc.double({ min: 0, max: 1e9, noNaN: true }),
      expense: fc.double({ min: 0, max: 1e9, noNaN: true })
    })

    const forecastApiResponseArbitrary = fc.record({
      entity_id: fc.string(),
      entity_name: fc.string(),
      entity_type: fc.constantFrom('program' as const, 'project' as const),
      budget: categoryBreakdownArbitrary,
      actual: categoryBreakdownArbitrary,
      forecast: categoryBreakdownArbitrary,
      analysis: fc.record({
        budget_remaining: fc.double({ noNaN: true }),
        forecast_variance: fc.double({ noNaN: true }),
        budget_utilization_percentage: fc.double({ noNaN: true }),
        forecast_to_budget_percentage: fc.double({ noNaN: true })
      })
    })

    fc.assert(
      fc.property(forecastApiResponseArbitrary, (apiResponse) => {
        const result = transformForecastData(apiResponse)

        // Property: For any budget B and current forecast CF, variance = B - CF
        // First calculate current forecast
        const currentForecastTotal = apiResponse.actual.total + apiResponse.forecast.total
        const currentForecastCapital = apiResponse.actual.capital + apiResponse.forecast.capital
        const currentForecastExpense = apiResponse.actual.expense + apiResponse.forecast.expense

        // Then calculate expected variance
        const expectedVarianceTotal = apiResponse.budget.total - currentForecastTotal
        const expectedVarianceCapital = apiResponse.budget.capital - currentForecastCapital
        const expectedVarianceExpense = apiResponse.budget.expense - currentForecastExpense

        // Allow for floating point precision errors
        const epsilon = 1e-10
        expect(Math.abs(result.variance.total - expectedVarianceTotal)).toBeLessThan(epsilon)
        expect(Math.abs(result.variance.capital - expectedVarianceCapital)).toBeLessThan(epsilon)
        expect(Math.abs(result.variance.expense - expectedVarianceExpense)).toBeLessThan(epsilon)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: portfolio-dashboard, Property 8: Data Transformation Correctness
  // Validates: Requirements 6.4
  it('property test: transformation produces correct FinancialTableData for any valid API response', () => {
    // Generate arbitrary financial values
    const categoryBreakdownArbitrary = fc.record({
      total: fc.double({ min: 0, max: 1e9, noNaN: true }),
      capital: fc.double({ min: 0, max: 1e9, noNaN: true }),
      expense: fc.double({ min: 0, max: 1e9, noNaN: true })
    })

    const forecastApiResponseArbitrary = fc.record({
      entity_id: fc.string(),
      entity_name: fc.string(),
      entity_type: fc.constantFrom('program' as const, 'project' as const),
      budget: categoryBreakdownArbitrary,
      actual: categoryBreakdownArbitrary,
      forecast: categoryBreakdownArbitrary,
      analysis: fc.record({
        budget_remaining: fc.double({ noNaN: true }),
        forecast_variance: fc.double({ noNaN: true }),
        budget_utilization_percentage: fc.double({ noNaN: true }),
        forecast_to_budget_percentage: fc.double({ noNaN: true })
      })
    })

    fc.assert(
      fc.property(forecastApiResponseArbitrary, (apiResponse) => {
        const result = transformForecastData(apiResponse)

        const epsilon = 1e-10

        // Property: budget values match the API response budget values
        expect(Math.abs(result.budget.total - apiResponse.budget.total)).toBeLessThan(epsilon)
        expect(Math.abs(result.budget.capital - apiResponse.budget.capital)).toBeLessThan(epsilon)
        expect(Math.abs(result.budget.expense - apiResponse.budget.expense)).toBeLessThan(epsilon)

        // Property: actuals values match the API response actual values
        expect(Math.abs(result.actuals.total - apiResponse.actual.total)).toBeLessThan(epsilon)
        expect(Math.abs(result.actuals.capital - apiResponse.actual.capital)).toBeLessThan(epsilon)
        expect(Math.abs(result.actuals.expense - apiResponse.actual.expense)).toBeLessThan(epsilon)

        // Property: forecast values match the API response forecast values
        expect(Math.abs(result.forecast.total - apiResponse.forecast.total)).toBeLessThan(epsilon)
        expect(Math.abs(result.forecast.capital - apiResponse.forecast.capital)).toBeLessThan(epsilon)
        expect(Math.abs(result.forecast.expense - apiResponse.forecast.expense)).toBeLessThan(epsilon)

        // Property: currentForecast values equal actuals + forecast for each category
        const expectedCurrentForecastTotal = apiResponse.actual.total + apiResponse.forecast.total
        const expectedCurrentForecastCapital = apiResponse.actual.capital + apiResponse.forecast.capital
        const expectedCurrentForecastExpense = apiResponse.actual.expense + apiResponse.forecast.expense

        expect(Math.abs(result.currentForecast.total - expectedCurrentForecastTotal)).toBeLessThan(epsilon)
        expect(Math.abs(result.currentForecast.capital - expectedCurrentForecastCapital)).toBeLessThan(epsilon)
        expect(Math.abs(result.currentForecast.expense - expectedCurrentForecastExpense)).toBeLessThan(epsilon)

        // Property: variance values equal budget - currentForecast for each category
        const expectedVarianceTotal = apiResponse.budget.total - expectedCurrentForecastTotal
        const expectedVarianceCapital = apiResponse.budget.capital - expectedCurrentForecastCapital
        const expectedVarianceExpense = apiResponse.budget.expense - expectedCurrentForecastExpense

        expect(Math.abs(result.variance.total - expectedVarianceTotal)).toBeLessThan(epsilon)
        expect(Math.abs(result.variance.capital - expectedVarianceCapital)).toBeLessThan(epsilon)
        expect(Math.abs(result.variance.expense - expectedVarianceExpense)).toBeLessThan(epsilon)
      }),
      { numRuns: 100 }
    )
  })
})
