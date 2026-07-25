// Common types used across the application

export interface Program {
  id: string
  business_id?: string
  name: string
  business_sponsor: string
  program_manager: string
  technical_lead: string
  description?: string
  start_date: string
  end_date: string
  portfolio_id: string
  portfolio?: {
    id: string
    name: string
  }
  version: number
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  business_id?: string
  program_id: string
  name: string
  business_sponsor: string
  project_manager: string
  technical_lead: string
  description?: string
  start_date: string
  end_date: string
  cost_center_code: string
  version: number
  created_at: string
  updated_at: string
  phases?: ProjectPhase[]
}

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  start_date: string
  end_date: string
  description?: string
  labor_capital_budget?: number
  labor_expense_budget?: number
  nonlabor_capital_budget?: number
  nonlabor_expense_budget?: number
  total_budget: number
  // Derived, read-only fields returned by ProjectPhaseResponse (project.phases);
  // not present/settable on the phases-list/batch API. Kept optional so
  // ProjectDetailPage's budget-stat calculations keep compiling.
  capital_budget?: number
  expense_budget?: number
  version?: number
  created_at: string
  updated_at: string
  assignment_count?: number
}

export interface PhaseValidationError {
  field: string
  message: string
  phase_id?: string
}

export interface PhaseValidationResult {
  is_valid: boolean
  errors: PhaseValidationError[]
}

export interface Resource {
  id: string
  name: string
  resource_type: 'LABOR' | 'NON_LABOR'
  description?: string
  worker_id?: string | null
  resource_role_id?: string
  resource_role_name?: string
  worker_name?: string
  worker_type_name?: string
  current_rate?: string
  version: number
  created_at: string
  updated_at: string
}

export interface Worker {
  id: string
  external_id: string
  name: string
  worker_type_id: string
  worker_type_name?: string
  cost_center_code: string
  current_rate?: string
  version: number
  created_at: string
  updated_at: string
}

export interface WorkerType {
  id: string
  type: string
  description: string
  worker_count?: number
  current_rate?: string
  version: number
  created_at: string
  updated_at: string
}

export interface Rate {
  id: string
  worker_type_id: string
  rate_amount: number
  start_date: string
  end_date?: string
  version: number
  created_at: string
}

export interface ResourceRole {
  id: string
  name: string
  description?: string
  resource_count?: number
  created_at?: string
  updated_at?: string
  version: number
}

export interface ResourceAssignment {
  id: string
  resource_id: string
  resource_name?: string
  project_id: string
  project_phase_id?: string
  assignment_date: string
  capital_percentage: number
  expense_percentage: number
  version?: number
  created_at?: string
  updated_at?: string
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
  version: number
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
