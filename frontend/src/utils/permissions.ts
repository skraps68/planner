import { User } from '../store/slices/authSlice'

export type Permission = 
  | 'view_portfolios'
  | 'create_portfolios'
  | 'edit_portfolios'
  | 'delete_portfolios'
  | 'view_programs'
  | 'create_programs'
  | 'edit_programs'
  | 'delete_programs'
  | 'view_projects'
  | 'create_projects'
  | 'edit_projects'
  | 'delete_projects'
  | 'view_resources'
  | 'manage_resources'
  | 'view_workers'
  | 'manage_workers'
  | 'view_actuals'
  | 'import_actuals'
  | 'view_reports'
  | 'manage_users'
  | 'view_audit'

export interface PermissionCheck {
  hasPermission: boolean
  reason?: string
}

// Role-based permissions mapping
const rolePermissions: Record<string, Permission[]> = {
  ADMIN: [
    'view_portfolios',
    'create_portfolios',
    'edit_portfolios',
    'delete_portfolios',
    'view_programs',
    'create_programs',
    'edit_programs',
    'delete_programs',
    'view_projects',
    'create_projects',
    'edit_projects',
    'delete_projects',
    'view_resources',
    'manage_resources',
    'view_workers',
    'manage_workers',
    'view_actuals',
    'import_actuals',
    'view_reports',
    'manage_users',
    'view_audit',
  ],
  PROGRAM_MANAGER: [
    'view_portfolios',
    'view_programs',
    'edit_programs',
    'view_projects',
    'create_projects',
    'edit_projects',
    'view_resources',
    'manage_resources',
    'view_workers',
    'view_actuals',
    'import_actuals',
    'view_reports',
  ],
  PROJECT_MANAGER: [
    'view_portfolios',
    'view_programs',
    'view_projects',
    'edit_projects',
    'view_resources',
    'manage_resources',
    'view_workers',
    'view_actuals',
    'import_actuals',
    'view_reports',
  ],
  FINANCE_MANAGER: [
    'view_portfolios',
    'view_programs',
    'view_projects',
    'view_resources',
    'view_workers',
    'view_actuals',
    'import_actuals',
    'view_reports',
  ],
  RESOURCE_MANAGER: [
    'view_portfolios',
    'view_programs',
    'view_projects',
    'view_resources',
    'manage_resources',
    'view_workers',
    'manage_workers',
    'view_actuals',
    'view_reports',
  ],
  VIEWER: [
    'view_portfolios',
    'view_programs',
    'view_projects',
    'view_resources',
    'view_workers',
    'view_actuals',
    'view_reports',
  ],
}

/**
 * Check if user has a specific permission based on their active role
 */
export const hasPermission = (user: User | null, permission: Permission): PermissionCheck => {
  if (!user) {
    return { hasPermission: false, reason: 'User not authenticated' }
  }

  const activeRole = user.roles?.[0]
  if (!activeRole) {
    return { hasPermission: false, reason: 'No active role assigned' }
  }

  // Normalize role to uppercase for comparison
  const normalizedRole = activeRole.toUpperCase()
  const permissions = rolePermissions[normalizedRole] || []
  const hasAccess = permissions.includes(permission)

  return {
    hasPermission: hasAccess,
    reason: hasAccess ? undefined : `Role ${activeRole} does not have ${permission} permission`,
  }
}

/**
 * Check if user has access to a specific program
 * Note: Simplified version - assumes ADMIN has global access, others need backend validation
 */
export const canAccessProgram = (user: User | null, programId: string): PermissionCheck => {
  if (!user) {
    return { hasPermission: false, reason: 'User not authenticated' }
  }

  const activeRole = user.roles?.[0]
  if (!activeRole) {
    return { hasPermission: false, reason: 'No active role assigned' }
  }

  // ADMIN has global access (case-insensitive)
  if (activeRole.toUpperCase() === 'ADMIN') {
    return { hasPermission: true }
  }

  // For other roles, assume access (backend will enforce actual scope)
  return { hasPermission: true }
}

/**
 * Check if user has access to a specific project
 * Note: Simplified version - assumes ADMIN has global access, others need backend validation
 */
export const canAccessProject = (user: User | null, projectId: string, programId?: string): PermissionCheck => {
  if (!user) {
    return { hasPermission: false, reason: 'User not authenticated' }
  }

  const activeRole = user.roles?.[0]
  if (!activeRole) {
    return { hasPermission: false, reason: 'No active role assigned' }
  }

  // ADMIN has global access (case-insensitive)
  if (activeRole.toUpperCase() === 'ADMIN') {
    return { hasPermission: true }
  }

  // For other roles, assume access (backend will enforce actual scope)
  return { hasPermission: true }
}

/**
 * Get all accessible program IDs for the user
 * Note: Simplified version - returns 'all' for ADMIN, empty array for others (backend enforces)
 */
export const getAccessibleProgramIds = (user: User | null): string[] | 'all' => {
  if (!user) return []

  const activeRole = user.roles?.[0]
  if (!activeRole) return []

  // ADMIN has global access (case-insensitive)
  if (activeRole.toUpperCase() === 'ADMIN') return 'all'

  // For other roles, backend will filter
  return []
}

/**
 * Get all accessible project IDs for the user
 * Note: Simplified version - returns 'all' for ADMIN, empty array for others (backend enforces)
 */
export const getAccessibleProjectIds = (user: User | null): string[] | 'all' => {
  if (!user) return []

  const activeRole = user.roles?.[0]
  if (!activeRole) return []

  // ADMIN has global access (case-insensitive)
  if (activeRole.toUpperCase() === 'ADMIN') return 'all'

  // For other roles, backend will filter
  return []
}

/**
 * Get scope context for display (breadcrumbs, headers, etc.)
 * Note: Simplified version - shows role-based context
 */
export const getScopeContext = (user: User | null): string[] => {
  if (!user) return []

  const activeRole = user.roles?.[0]
  if (!activeRole) return []

  if (activeRole.toUpperCase() === 'ADMIN') {
    return ['All Programs & Projects']
  }

  return [`${activeRole.replace('_', ' ')} Access`]
}

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (user: User | null, roles: string[]): boolean => {
  if (!user) return false
  const activeRole = user.roles?.[0]
  return activeRole ? roles.includes(activeRole) : false
}

/**
 * Get user's active role type
 */
export const getActiveRoleType = (user: User | null): string | null => {
  if (!user) return null
  return user.roles?.[0] || null
}

