import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assignmentsApi, ResourceAssignmentCreateInput, ResourceAssignmentUpdateInput, BulkAssignmentUpdate } from '../api/assignments'
import { ResourceAssignment } from '../types'

// Query keys for assignments
export const assignmentKeys = {
  all: ['assignments'] as const,
  lists: () => [...assignmentKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...assignmentKeys.lists(), filters] as const,
  details: () => [...assignmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...assignmentKeys.details(), id] as const,
  byProject: (projectId: string) => [...assignmentKeys.all, 'project', projectId] as const,
  byResource: (resourceId: string) => [...assignmentKeys.all, 'resource', resourceId] as const,
  byResourceAndDate: (resourceId: string, date: string) => [...assignmentKeys.all, 'resource', resourceId, 'date', date] as const,
}

/**
 * Hook to fetch assignments for a specific project
 * Automatically caches and refetches based on React Query configuration
 */
export function useProjectAssignments(projectId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: assignmentKeys.byProject(projectId!),
    queryFn: () => assignmentsApi.getByProject(projectId!),
    enabled: !!projectId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes - matches global config
  })
}

/**
 * Hook to fetch assignments for a specific resource
 * Automatically caches and refetches based on React Query configuration
 */
export function useResourceAssignments(resourceId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: assignmentKeys.byResource(resourceId!),
    queryFn: () => assignmentsApi.getByResource(resourceId!),
    enabled: !!resourceId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch assignments for a specific resource and date
 */
export function useResourceAssignmentsByDate(
  resourceId: string | undefined,
  date: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: assignmentKeys.byResourceAndDate(resourceId!, date!),
    queryFn: () => assignmentsApi.getByDate(resourceId!, date!),
    enabled: !!resourceId && !!date && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch a single assignment by ID
 */
export function useAssignment(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: assignmentKeys.detail(id!),
    queryFn: () => assignmentsApi.get(id!),
    enabled: !!id && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to create a new assignment
 * Automatically invalidates relevant queries on success
 */
export function useCreateAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ResourceAssignmentCreateInput) => assignmentsApi.create(data),
    onSuccess: (newAssignment) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byProject(newAssignment.project_id) })
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byResource(newAssignment.resource_id) })
    },
  })
}

/**
 * Hook to update an existing assignment
 * Automatically invalidates relevant queries on success
 */
export function useUpdateAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResourceAssignmentUpdateInput }) =>
      assignmentsApi.update(id, data),
    onSuccess: (updatedAssignment) => {
      // Invalidate specific assignment
      queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(updatedAssignment.id) })
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byProject(updatedAssignment.project_id) })
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byResource(updatedAssignment.resource_id) })
    },
  })
}

/**
 * Hook to bulk update assignments
 * Automatically invalidates relevant queries on success
 */
export function useBulkUpdateAssignments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (updates: BulkAssignmentUpdate[]) => assignmentsApi.bulkUpdate(updates),
    onSuccess: (result) => {
      // Invalidate all assignment queries since we don't know which ones were affected
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all })
    },
  })
}

/**
 * Hook to delete an assignment
 * Automatically invalidates relevant queries on success
 */
export function useDeleteAssignment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => assignmentsApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Invalidate all assignment queries
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all })
    },
  })
}

/**
 * Helper function to manually invalidate assignment caches
 * Useful when you need to force a refetch
 */
export function useInvalidateAssignments() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: assignmentKeys.all }),
    invalidateProject: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byProject(projectId) }),
    invalidateResource: (resourceId: string) =>
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byResource(resourceId) }),
  }
}
