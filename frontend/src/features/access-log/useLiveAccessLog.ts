import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryKeys } from '../../api/queryKeys'

const RECONNECT_DELAY_MS = 3000

interface BlockEvent {
  patientId?: unknown
  action?: unknown
  userId?: unknown
}

function eventsInNewBlock(raw: unknown): BlockEvent[] {
  if (typeof raw !== 'string') return []

  try {
    const message: unknown = JSON.parse(raw)
    if (typeof message !== 'object' || message === null) return []

    const { type, block } = message as { type?: unknown; block?: unknown }
    if (type !== 'NEW_BLOCK' || typeof block !== 'object' || block === null) return []

    const { data } = block as { data?: unknown }
    if (!Array.isArray(data)) return []

    return data.filter(
      (event: unknown): event is BlockEvent => typeof event === 'object' && event !== null,
    )
  } catch {
    return []
  }
}

export function blockTouchesPatient(raw: unknown, patientId: number): boolean {
  return eventsInNewBlock(raw).some((event) => event.patientId === patientId)
}

export function blockHasNewNote(raw: unknown, patientId: number, viewerId: number | null): boolean {
  return eventsInNewBlock(raw).some(
    (event) =>
      event.patientId === patientId && event.action === 'WRITE' && event.userId !== viewerId,
  )
}

export function useLiveAccessLog(patientId: number | null, viewerId: number | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (patientId === null || typeof WebSocket === 'undefined') return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws`
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const refreshAccessLog = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.accessLog(patientId) })

    const refreshJournal = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.patient(patientId) })

    const connect = (isReconnect: boolean): WebSocket => {
      const next = new WebSocket(url)

      next.addEventListener('open', () => {
        if (isReconnect) refreshAccessLog()
      })

      next.addEventListener('message', (event) => {
        if (blockHasNewNote(event.data, patientId, viewerId)) refreshJournal()
        if (blockTouchesPatient(event.data, patientId)) refreshAccessLog()
      })

      next.addEventListener('close', () => {
        if (stopped) return
        reconnectTimer = setTimeout(() => {
          socket = connect(true)
        }, RECONNECT_DELAY_MS)
      })

      return next
    }

    let socket = connect(false)

    return () => {
      stopped = true
      clearTimeout(reconnectTimer)
      socket.close()
    }
  }, [patientId, viewerId, queryClient])
}
