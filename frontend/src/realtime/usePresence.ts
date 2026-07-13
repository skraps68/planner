import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { realtimeApi } from './realtimeApi'

const HEARTBEAT_MS = Number(import.meta.env.VITE_LOCK_HEARTBEAT_MS) || 30000

export interface PresentUser {
  user_id: string
  name: string
}

export function usePresence(entityType: string, entityId: string | undefined, active: boolean) {
  const currentUserId = useSelector((s: any) => s.auth.user?.id)

  const { data: present = [] } = useQuery({
    queryKey: ['presence', entityType, entityId],
    queryFn: () => realtimeApi.getPresence(entityType, entityId as string),
    enabled: !!entityId,
    staleTime: 0,
  })

  useEffect(() => {
    if (!active || !entityId) return
    let stopped = false
    const beat = () => {
      if (!stopped) realtimeApi.registerPresence(entityType, entityId).catch(() => {})
    }
    beat()
    const h = setInterval(beat, HEARTBEAT_MS)
    return () => {
      stopped = true
      clearInterval(h)
      realtimeApi.releasePresence(entityType, entityId).catch(() => {})
    }
  }, [active, entityType, entityId])

  const others: PresentUser[] = present.filter((p) => p.user_id !== currentUserId)
  return { others }
}
