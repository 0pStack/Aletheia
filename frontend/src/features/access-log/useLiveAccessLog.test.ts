import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blockHasNewNote, blockTouchesPatient, useLiveAccessLog } from './useLiveAccessLog'

interface TestEvent {
  patientId: number
  action?: string
  userId?: number
}

const newBlock = (events: TestEvent[]) =>
  JSON.stringify({ type: 'NEW_BLOCK', block: { data: events } })

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = []
  closed = false

  constructor() {
    super()
    FakeWebSocket.instances.push(this)
  }

  close(): void {
    this.closed = true
    this.dispatchEvent(new Event('close'))
  }

  open(): void {
    this.dispatchEvent(new Event('open'))
  }

  receive(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }

  drop(): void {
    this.dispatchEvent(new Event('close'))
  }
}

function latestSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (!socket) throw new Error('expected a socket to be open')
  return socket
}

function renderLive(patientId: number, viewerId: number | null) {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  const view = renderHook(() => useLiveAccessLog(patientId, viewerId), { wrapper })
  return { ...view, invalidate }
}

const accessLogKey = { queryKey: ['patients', 4, 'access-log'] }
const journalKey = { queryKey: ['patients', 4] }

describe('blockTouchesPatient', () => {
  it('is true when the block holds an event for the patient', () => {
    expect(blockTouchesPatient(newBlock([{ patientId: 2 }, { patientId: 4 }]), 4)).toBe(true)
  })

  it('is false when the block is about other patients', () => {
    expect(blockTouchesPatient(newBlock([{ patientId: 2 }, { patientId: 3 }]), 4)).toBe(false)
  })

  it('ignores other message types and junk', () => {
    expect(blockTouchesPatient(JSON.stringify({ type: 'CHAIN_REQUEST' }), 4)).toBe(false)
    expect(blockTouchesPatient('not json', 4)).toBe(false)
    expect(blockTouchesPatient(JSON.stringify({ type: 'NEW_BLOCK', block: null }), 4)).toBe(false)
  })
})

describe('blockHasNewNote', () => {
  it('is true when someone else wrote a note on the patient', () => {
    expect(blockHasNewNote(newBlock([{ patientId: 4, action: 'WRITE', userId: 2 }]), 4, 1)).toBe(
      true,
    )
  })

  it('is false for reads', () => {
    expect(blockHasNewNote(newBlock([{ patientId: 4, action: 'READ', userId: 2 }]), 4, 1)).toBe(
      false,
    )
  })

  it("is false for the viewer's own note", () => {
    expect(blockHasNewNote(newBlock([{ patientId: 4, action: 'WRITE', userId: 1 }]), 4, 1)).toBe(
      false,
    )
  })

  it('is false for a note on another patient', () => {
    expect(blockHasNewNote(newBlock([{ patientId: 7, action: 'WRITE', userId: 2 }]), 4, 1)).toBe(
      false,
    )
  })
})

describe('useLiveAccessLog', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('refreshes only the access log when someone opens the record', () => {
    const { invalidate } = renderLive(4, 1)

    latestSocket().receive(newBlock([{ patientId: 4, action: 'READ', userId: 2 }]))

    expect(invalidate).toHaveBeenCalledWith(accessLogKey)
    expect(invalidate).not.toHaveBeenCalledWith(journalKey)
  })

  it('ignores blocks about other patients', () => {
    const { invalidate } = renderLive(4, 1)

    latestSocket().receive(newBlock([{ patientId: 7, action: 'WRITE', userId: 2 }]))

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('refreshes the journal when someone else writes a note', () => {
    const { invalidate } = renderLive(4, 1)

    latestSocket().receive(newBlock([{ patientId: 4, action: 'WRITE', userId: 2 }]))

    expect(invalidate).toHaveBeenCalledWith(journalKey)
  })

  it('does not refresh on the first connect', () => {
    const { invalidate } = renderLive(4, 1)

    latestSocket().open()

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('reconnects after the socket drops and catches up on the access log', () => {
    vi.useFakeTimers()
    const { invalidate } = renderLive(4, 1)

    latestSocket().drop()
    expect(FakeWebSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(3000)
    expect(FakeWebSocket.instances).toHaveLength(2)

    latestSocket().open()
    expect(invalidate).toHaveBeenCalledWith(accessLogKey)
  })

  it('closes the socket and stops reconnecting when the journal closes', () => {
    vi.useFakeTimers()
    const { unmount } = renderLive(4, 1)

    unmount()
    vi.advanceTimersByTime(3000)

    expect(FakeWebSocket.instances[0]?.closed).toBe(true)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
