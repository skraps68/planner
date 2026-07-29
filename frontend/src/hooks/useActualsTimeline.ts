import { useQuery } from '@tanstack/react-query'

import { actualsApi } from '../api/actuals'

export const actualsTimelineKeys = {
  all: ['actuals', 'timeline'] as const,
  project: (projectId: string, startDate?: string, endDate?: string) =>
    [...actualsTimelineKeys.all, 'project', projectId, startDate, endDate] as const,
  resource: (resourceId: string, startDate?: string, endDate?: string) =>
    [...actualsTimelineKeys.all, 'resource', resourceId, startDate, endDate] as const,
}

export function useProjectActualsTimeline(
  projectId: string | undefined,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: actualsTimelineKeys.project(projectId!, startDate, endDate),
    queryFn: () => actualsApi.getTimeline({
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
    }),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useResourceActualsTimeline(
  resourceId: string | undefined,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: actualsTimelineKeys.resource(resourceId!, startDate, endDate),
    queryFn: () => actualsApi.getTimeline({
      resource_id: resourceId,
      start_date: startDate,
      end_date: endDate,
    }),
    enabled: Boolean(resourceId),
    staleTime: 5 * 60 * 1000,
  })
}
