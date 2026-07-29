import apiClient from './client'
import { Actual, PaginatedResponse } from '../types'

export interface ActualImportResult {
  row_number: number
  success: boolean
  actual_id?: string
  errors?: string[]
  warnings?: string[]
}

export interface ActualImportResponse {
  total_rows: number
  successful_imports: number
  failed_imports: number
  results: ActualImportResult[]
  validation_only: boolean
  import_batch_id?: string
  actuals_through_date?: string
}

export interface ActualsTimelineResponse {
  plan_context: 'current'
  knowledge_time: string
  reporting_date: string
  watermarks: {
    labor?: string | null
    non_labor?: string | null
  }
  items: Actual[]
}

export interface AllocationConflict {
  external_worker_id: string
  worker_name: string
  actual_date: string
  existing_allocation: number
  new_allocation: number
  total_allocation: number
  conflict_type: string
}

export interface AllocationConflictResponse {
  has_conflicts: boolean
  conflicts: AllocationConflict[]
}

export interface VarianceRecord {
  worker_id: string
  worker_name: string
  date: string
  forecast_allocation: number
  actual_allocation: number
  allocation_variance: number
  variance_percentage: number
  variance_type: string
}

export interface VarianceAnalysisResponse {
  project_id: string
  period: {
    start_date: string
    end_date: string
  }
  summary: {
    total_variances: number
    allocation_over: number
    allocation_under: number
    unplanned_work: number
    unworked_assignment: number
  }
  variances: VarianceRecord[]
}

export interface ExceptionalVariance {
  worker_id: string
  worker_name: string
  date: string
  variance_type: string
  allocation_variance: number
  variance_percentage: number
  severity: string
}

export interface ExceptionalVariancesResponse {
  project_id: string
  period: {
    start_date: string
    end_date: string
  }
  thresholds: {
    allocation_threshold: number
    cost_threshold: number
  }
  total_exceptions: number
  exceptions: ExceptionalVariance[]
}

export interface ActualUpdateInput {
  project_id?: string
  external_worker_id?: string
  worker_name?: string
  actual_date?: string
  allocation_percentage?: number
  version: number
}

export const actualsApi = {
  // List actuals with filters
  listActuals: async (params?: {
    page?: number
    size?: number
    project_id?: string
    resource_id?: string
    external_worker_id?: string
    start_date?: string
    end_date?: string
  }): Promise<PaginatedResponse<Actual>> => {
    const response = await apiClient.get('/actuals/', { params })
    return response.data
  },

  // Get single actual
  getActual: async (id: string): Promise<Actual> => {
    const response = await apiClient.get(`/actuals/${id}`)
    return response.data
  },

  // Create actual
  createActual: async (data: {
    project_id: string
    external_worker_id: string
    worker_name: string
    actual_date: string
    allocation_percentage: number
  }): Promise<Actual> => {
    const response = await apiClient.post('/actuals/', data)
    return response.data
  },

  // Update actual
  updateActual: async (id: string, data: ActualUpdateInput): Promise<Actual> => {
    const response = await apiClient.put(`/actuals/${id}`, data)
    return response.data
  },

  // Delete actual
  deleteActual: async (id: string): Promise<void> => {
    await apiClient.delete(`/actuals/${id}`)
  },

  // Import labor actuals (percentage-based) from CSV
  importLaborActuals: async (
    file: File,
    validateOnly: boolean = false,
    actualsThroughDate?: string,
  ): Promise<ActualImportResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post(
      '/actuals/import/labor',
      formData,
      {
        params: {
          validate_only: validateOnly,
          ...(actualsThroughDate ? { actuals_through_date: actualsThroughDate } : {}),
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Import non-labor actuals (dollar-based) from CSV
  importNonLaborActuals: async (
    file: File,
    validateOnly: boolean = false,
    actualsThroughDate?: string,
  ): Promise<ActualImportResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post(
      '/actuals/import/non-labor',
      formData,
      {
        params: {
          validate_only: validateOnly,
          ...(actualsThroughDate ? { actuals_through_date: actualsThroughDate } : {}),
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Check allocation conflicts
  checkAllocationConflicts: async (file: File): Promise<AllocationConflictResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/actuals/check-allocation-conflicts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Get variance analysis
  getVarianceAnalysis: async (
    projectId: string,
    startDate: string,
    endDate: string,
    allocationThreshold?: number,
    costThreshold?: number
  ): Promise<VarianceAnalysisResponse> => {
    const params: any = {
      start_date: startDate,
      end_date: endDate,
    }
    if (allocationThreshold !== undefined) params.allocation_threshold = allocationThreshold
    if (costThreshold !== undefined) params.cost_threshold = costThreshold
    
    const response = await apiClient.get(`/actuals/variance/${projectId}`, { params })
    return response.data
  },

  // Get exceptional variances
  getExceptionalVariances: async (
    projectId: string,
    startDate: string,
    endDate: string,
    allocationThreshold?: number,
    costThreshold?: number
  ): Promise<ExceptionalVariancesResponse> => {
    const params: any = {
      start_date: startDate,
      end_date: endDate,
    }
    if (allocationThreshold !== undefined) params.allocation_threshold = allocationThreshold
    if (costThreshold !== undefined) params.cost_threshold = costThreshold
    
    const response = await apiClient.get(`/actuals/variance/${projectId}/exceptions`, { params })
    return response.data
  },

  // Get project total cost
  getProjectTotalCost: async (
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ project_id: string; total_cost: number; start_date?: string; end_date?: string }> => {
    const params: any = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    
    const response = await apiClient.get(`/actuals/project/${projectId}/total-cost`, { params })
    return response.data
  },

  getTimeline: async (params: {
    project_id?: string
    resource_id?: string
    start_date?: string
    end_date?: string
  }): Promise<ActualsTimelineResponse> => {
    const response = await apiClient.get('/actuals/timeline', { params })
    return response.data
  },
}
