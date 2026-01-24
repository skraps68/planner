// Common types used across the application

export interface Program {
  id: string
  name: string
  business_sponsor: string
  program_manager: string
  technical_lead: string
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  program_id: string
  name: string
  business_sponsor: string
  project_manager: string
  technical_lead: string
  start_date: string
  end_date: string
  cost_center_code: string
  created_at: string
  updated_at: string
}

export interface ProjectPhase {
  id: string
  project_id: string
  phase_type: 'PLANNING' | 'EXECUTION'
  capital_budget: number
  expense_budget: number
  total_budget: number
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  name: string
  resource_type: 'LABOR' | 'NON_LABOR'
  description?: string
  created_at: string
  updated_at: string
}

export interface Worker {
  id: string
  external_id: string
  name: string
  worker_type_id: string
  created_at: string
  updated_at: string
}

export interface WorkerType {
  id: string
  type: string
  description: string
  created_at: string
  updated_at: string
}

export interface Rate {
  id: string
  worker_type_id: string
  rate_amount: number
  start_date: string
  end_date?: string
  created_at: string
}

export interface ResourceAssignment {
  id: string
  resource_id: string
  project_id: string
  project_phase_id: string
  assignment_date: string
  allocation_percentage: number
  capital_percentage: number
  expense_percentage: number
  created_at: string
  updated_at: string
}

export interface Actual {
  id: string
  project_id: string
  external_worker_id: string
  worker_name: string
  actual_date: string
  allocation_percentage: number
  actual_cost: number
  capital_amount: number
  expense_amount: number
  created_at: string
  updated_at: string
  project_name?: string
  program_name?: string
  cost_center_code?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ApiError {
  detail: string
  status_code?: number
}
