import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryKeys } from '../../api/queryKeys'

export function blockTouchesPatient(raw: unknown, patientId: number): boolean {
  if (typeof raw !== 'string') return false

  try {
    const message: unknown = JSON.parse(raw)
    if (typeof message !== 'object' || message === null) return false

    const { type, block } = message as { type?: unknown; block?: unknown }
    if (type !== 'NEW_BLOCK' || typeof block !== 'object' || block === null) return false

    const { data } = block as { data?: unknown }
    return (
      Array.isArray(data) &&
      data.some(
        (event: unknown) =>
          typeof event === 'object' &&
          event !== null &&
          (event as { patientId?: unknown }).patientId === patientId,
      )
    )
  } catch {
    return false
  }
}

export function useLiveAccessLog(patientId: number | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (patientId === null || typeof WebSocket === 'undefined') return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`)

    socket.addEventListener('message', (event) => {
      if (blockTouchesPatient(event.data, patientId)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.accessLog(patientId) })
      }
    })

    return () => socket.close()
  }, [patientId, queryClient])
}
