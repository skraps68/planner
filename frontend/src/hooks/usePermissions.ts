import { useSelector } from 'react-redux'
import { RootState } from '../store'
import {
  hasPermission,
  canAccessProgram,
  canAccessProject,
  getAccessibleProgramIds,
  getAccessibleProjectIds,
  getScopeContext,
  hasAnyRole,
  getActiveRoleType,
  Permission,
  PermissionCheck,
} from '../utils/permissions'

/**
 * Custom hook for permission checking and scope management
 */
export const usePermissions = () => {
  const user = useSelector((state: RootState) => state.auth.user)

  return {
    // Permission checks
    hasPermission: (permission: Permission): PermissionCheck => hasPermission(user, permission),
    
    // Scope checks
    canAccessProgram: (programId: string): PermissionCheck => canAccessProgram(user, programId),
    canAccessProject: (projectId: string, programId?: string): PermissionCheck => 
      canAccessProject(user, projectId, programId),
    
    // Scope data
    accessibleProgramIds: getAccessibleProgramIds(user),
    accessibleProjectIds: getAccessibleProjectIds(user),
    scopeContext: getScopeContext(user),
    
    // Role checks
    hasAnyRole: (roles: string[]): boolean => hasAnyRole(user, roles),
    activeRoleType: getActiveRoleType(user),
    
    // User data
    user,
    isAuthenticated: !!user,
  }
}

/**
 * Custom hook for filtering data based on user scope
 */
export const useScopeFilter = () => {
  const { accessibleProgramIds, accessibleProjectIds } = usePermissions()

  return {
    /**
     * Filter programs based on user scope
     */
    filterPrograms: <T extends { id: string }>(programs: T[]): T[] => {
      if (accessibleProgramIds === 'all') return programs
      return programs.filter((program) => accessibleProgramIds.includes(program.id))
    },

    /**
     * Filter projects based on user scope
     */
    filterProjects: <T extends { id: string; program_id?: string }>(projects: T[]): T[] => {
      if (accessibleProjectIds === 'all' && accessibleProgramIds === 'all') {
        return projects
      }

      return projects.filter((project) => {
        // Check direct project access
        if (accessibleProjectIds !== 'all' && accessibleProjectIds.includes(project.id)) {
          return true
        }

        // Check program-level access
        if (
          project.program_id &&
          accessibleProgramIds !== 'all' &&
          accessibleProgramIds.includes(project.program_id)
        ) {
          return true
        }

        // If user has global access
        if (accessibleProjectIds === 'all' || accessibleProgramIds === 'all') {
          return true
        }

        return false
      })
    },

    /**
     * Check if user should see all data (no filtering needed)
     */
    hasGlobalAccess: accessibleProgramIds === 'all' && accessibleProjectIds === 'all',

    /**
     * Get scope filter parameters for API calls
     */
    getScopeFilterParams: () => {
      if (accessibleProgramIds === 'all') {
        return {}
      }

      return {
        program_ids: accessibleProgramIds,
        project_ids: accessibleProjectIds !== 'all' ? accessibleProjectIds : undefined,
      }
    },
  }
}
