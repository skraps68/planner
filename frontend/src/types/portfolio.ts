// Portfolio types for the application

export interface Portfolio {
  id: string
  name: string
  description: string
  owner: string
  reporting_start_date: string
  reporting_end_date: string
  program_count?: number
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface PortfolioCreate {
  name: string
  description: string
  owner: string
  reporting_start_date: string
  reporting_end_date: string
}

export interface PortfolioUpdate {
  name?: string
  description?: string
  owner?: string
  reporting_start_date?: string
  reporting_end_date?: string
}
