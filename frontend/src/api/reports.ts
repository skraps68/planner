import { apiClient } from './client'

export interface BudgetBreakdown {
  capital_budget: number
  expense_budget: number
  total_budget: number
}

export interface ActualBreakdown {
  capital_actual: number
  expense_actual: number
  total_actual: number
}

export interface ForecastBreakdown {
  capital_forecast: number
  expense_forecast: number
  total_forecast: number
}

export interface VarianceBreakdown {
  budget_vs_actual_variance: number
  budget_vs_forecast_variance: number
  actual_vs_forecast_variance: number
  budget_vs_actual_percentage: number
  budget_vs_forecast_percentage: number
}

export interface ProjectFinancialSummary {
  project_id: string
  project_name: string
  program_id: string
  program_name: string
  cost_center_code: string
  budget: BudgetBreakdown
  actual: ActualBreakdown
  forecast: ForecastBreakdown
  variance: VarianceBreakdown
}

export interface ProgramFinancialSummary {
  program_id: string
  program_name: string
  project_count: number
  budget: BudgetBreakdown
  actual: ActualBreakdown
  forecast: ForecastBreakdown
  variance: VarianceBreakdown
  projects: ProjectFinancialSummary[]
}

export interface TimeSeriesDataPoint {
  data_date: string
  budget: number
  actual: number
  forecast: number
  cumulative_budget: number
  cumulative_actual: number
  cumulative_forecast: number
}

export interface ResourceUtilization {
  resource_id: string
  resource_name: string
  resource_type: string
  total_allocation: number
  average_allocation: number
  utilization_days: number
  total_days: number
  utilization_percentage: number
}

export interface WorkerUtilization {
  external_worker_id: string
  worker_name: string
  worker_type: string
  total_allocation: number
  average_allocation: number
  working_days: number
  total_days: number
  utilization_percentage: number
  total_cost: number
}

export const reportsApi = {
  // Project forecast
  getProjectForecast: async (projectId: string, asOfDate?: string) => {
    const params = asOfDate ? { as_of_date: asOfDate } : {}
    const response = await apiClient.get(`/reports/forecast/project/${projectId}`, { params })
    return response.data
  },

  // Program forecast
  getProgramForecast: async (programId: string, asOfDate?: string) => {
    const params = asOfDate ? { as_of_date: asOfDate } : {}
    const response = await apiClient.get(`/reports/forecast/program/${programId}`, { params })
    return response.data
  },

  // Budget vs Actual vs Forecast
  getBudgetVsActualVsForecast: async (
    entityType: 'project' | 'program',
    entityId: string,
    asOfDate?: string
  ) => {
    const params = asOfDate ? { as_of_date: asOfDate } : {}
    const response = await apiClient.get(
      `/reports/budget-vs-actual/${entityType}/${entityId}`,
      { params }
    )
    return response.data
  },

  // Project cost projection
  getProjectCostProjection: async (
    projectId: string,
    startDate: string,
    endDate: string
  ) => {
    const response = await apiClient.get(`/reports/project/${projectId}/cost-projection`, {
      params: { start_date: startDate, end_date: endDate }
    })
    return response.data
  },

  // Project report
  getProjectReport: async (projectId: string, asOfDate?: string, includeVariance = true) => {
    const params: any = { include_variance: includeVariance }
    if (asOfDate) params.as_of_date = asOfDate
    const response = await apiClient.get(`/reports/project/${projectId}`, { params })
    return response.data
  },

  // Program report
  getProgramReport: async (programId: string, asOfDate?: string, includeProjects = true) => {
    const params: any = { include_projects: includeProjects }
    if (asOfDate) params.as_of_date = asOfDate
    const response = await apiClient.get(`/reports/program/${programId}`, { params })
    return response.data
  },

  // Budget status report
  getBudgetStatusReport: async (
    entityType: 'project' | 'program',
    entityId: string,
    asOfDate?: string
  ) => {
    const params = asOfDate ? { as_of_date: asOfDate } : {}
    const response = await apiClient.get(
      `/reports/budget-status/${entityType}/${entityId}`,
      { params }
    )
    return response.data
  },

  // Time series report
  getTimeSeriesReport: async (
    projectId: string,
    startDate: string,
    endDate: string,
    interval: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ) => {
    const response = await apiClient.get(`/reports/project/${projectId}/time-series`, {
      params: { start_date: startDate, end_date: endDate, interval }
    })
    return response.data
  },

  // Drill-down report
  getDrillDownReport: async (
    projectId: string,
    startDate: string,
    endDate: string,
    groupBy: 'worker' | 'date' | 'phase' = 'worker'
  ) => {
    const response = await apiClient.get(`/reports/project/${projectId}/drill-down`, {
      params: { start_date: startDate, end_date: endDate, group_by: groupBy }
    })
    return response.data
  },

  // Variance report
  getVarianceReport: async (
    projectId: string,
    startDate: string,
    endDate: string,
    allocationThreshold?: number,
    costThreshold?: number
  ) => {
    const params: any = { start_date: startDate, end_date: endDate }
    if (allocationThreshold !== undefined) params.allocation_threshold = allocationThreshold
    if (costThreshold !== undefined) params.cost_threshold = costThreshold
    const response = await apiClient.get(`/reports/project/${projectId}/variance`, { params })
    return response.data
  },

  // Variance exceptions
  getVarianceExceptions: async (
    projectId: string,
    startDate: string,
    endDate: string,
    allocationThreshold = 30,
    costThreshold = 20
  ) => {
    const response = await apiClient.get(`/reports/project/${projectId}/variance/exceptions`, {
      params: {
        start_date: startDate,
        end_date: endDate,
        allocation_threshold: allocationThreshold,
        cost_threshold: costThreshold
      }
    })
    return response.data
  }
}
