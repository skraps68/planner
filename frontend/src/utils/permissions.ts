import { User } from '../store/slices/authSlice'

export type Permission = 
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
    'view_programs',
    'view_projects',
    'view_resources',
    'view_workers',
    'view_actuals',
    'import_actuals',
    'view_reports',
  ],
  RESOURCE_MANAGER: [
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

  const activeRole = user.activeRole || user.roles[0]
  if (!activeRole) {
    return { hasPermission: false, reason: 'No active role assigned' }
  }

  const permissions = rolePermissions[activeRole.role_type] || []
  const hasAccess = permissions.includes(permission)

  return {
    hasPermission: hasAccess,
    reason: hasAccess ? undefined : `Role ${activeRole.role_type} does not have ${permission} permission`,
  }
}

/**
 * Check if user has access to a specific program
 */
export const canAccessProgram = (user: User | null, programId: string): PermissionCheck => {
  if (!user) {
    return { hasPermission: false, reason: 'User not authenticated' }
  }

  const activeRole = user.activeRole || user.roles[0]
  if (!activeRole) {
    return { hasPermission: false, reason: 'No active role assigned' }
  }

  // Check for global scope
  const hasGlobalScope = activeRole.scopes.some((scope) => scope.scope_type === 'GLOBAL')
  if (hasGlobalScope) {
    return { hasPermission: true }
  }

  // Check for program scope
  const hasProgramScope = activeRole.scopes.some(
    (scope) => scope.scope_type === 'PROGRAM' && scope.program_id === programId
  )

  return {
    hasPermission: hasProgramScope,
    reason: hasProgramScope ? undefined : 'Program not in user scope',
  }
}

/**
 * Check if user has access to a specific project
 */
export const canAccessProject = (user: User | null, projectId: string, programId?: string): PermissionCheck => {
  if (!user) {
    return { hasPermission: false, reason: 'User not authenticated' }
  }

  const activeRole = user.activeRole || user.roles[0]
  if (!activeRole) {
    return { hasPermission: false, reason: 'No active role assigned' }
  }

  // Check for global scope
  const hasGlobalScope = activeRole.scopes.some((scope) => scope.scope_type === 'GLOBAL')
  if (hasGlobalScope) {
    return { hasPermission: true }
  }

  // Check for program scope (includes all projects in program)
  if (programId) {
    const hasProgramScope = activeRole.scopes.some(
      (scope) => scope.scope_type === 'PROGRAM' && scope.program_id === programId
    )
    if (hasProgramScope) {
      return { hasPermission: true }
    }
  }

  // Check for specific project scope
  const hasProjectScope = activeRole.scopes.some(
    (scope) => scope.scope_type === 'PROJECT' && scope.project_id === projectId
  )

  return {
    hasPermission: hasProjectScope,
    reason: hasProjectScope ? undefined : 'Project not in user scope',
  }
}

/**
 * Get all accessible program IDs for the user
 */
export const getAccessibleProgramIds = (user: User | null): string[] | 'all' => {
  if (!user) return []

  const activeRole = user.activeRole || user.roles[0]
  if (!activeRole) return []

  // Check for global scope
  const hasGlobalScope = activeRole.scopes.some((scope) => scope.scope_type === 'GLOBAL')
  if (hasGlobalScope) return 'all'

  // Get program IDs from program scopes
  const programIds = activeRole.scopes
    .filter((scope) => scope.scope_type === 'PROGRAM' && scope.program_id)
    .map((scope) => scope.program_id!)

  return programIds
}

/**
 * Get all accessible project IDs for the user
 */
export const getAccessibleProjectIds = (user: User | null): string[] | 'all' => {
  if (!user) return []

  const activeRole = user.activeRole || user.roles[0]
  if (!activeRole) return []

  // Check for global scope
  const hasGlobalScope = activeRole.scopes.some((scope) => scope.scope_type === 'GLOBAL')
  if (hasGlobalScope) return 'all'

  // Get project IDs from both program and project scopes
  const projectIds = activeRole.scopes
    .filter((scope) => scope.scope_type === 'PROJECT' && scope.project_id)
    .map((scope) => scope.project_id!)

  return projectIds
}

/**
 * Get scope context for display (breadcrumbs, headers, etc.)
 */
export const getScopeContext = (user: User | null): string[] => {
  if (!user) return []

  const activeRole = user.activeRole || user.roles[0]
  if (!activeRole) return []

  return activeRole.scopes
    .map((scope) => {
      if (scope.scope_type === 'GLOBAL') return 'All Programs & Projects'
      if (scope.scope_type === 'PROGRAM') return scope.program_name || 'Unknown Program'
      if (scope.scope_type === 'PROJECT') return scope.project_name || 'Unknown Project'
      return ''
    })
    .filter(Boolean)
}

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (user: User | null, roles: string[]): boolean => {
  if (!user) return false
  const activeRole = user.activeRole || user.roles[0]
  return activeRole ? roles.includes(activeRole.role_type) : false
}

/**
 * Get user's active role type
 */
export const getActiveRoleType = (user: User | null): string | null => {
  if (!user) return null
  const activeRole = user.activeRole || user.roles[0]
  return activeRole ? activeRole.role_type : null
}
