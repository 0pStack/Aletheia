import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessEvent } from './access-event.js'
import { Blockchain } from './blockchain.js'

function event(id: string, action: AccessEvent['action'] = 'READ'): AccessEvent {
  return {
    id,
    patientId: 5,
    userId: 1,
    role: 'DOCTOR',
    action,
    timestamp: '2026-09-25T00:00:00.000Z',
    serverId: 'server-test',
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Blockchain deferred flush failures', () => {
  it('hands a failed timer flush to onFlushError instead of throwing out of the timer', () => {
    const onFlushError = vi.fn()
    const blockchain = new Blockchain({
      batchSize: 5,
      flushIntervalMs: 2000,
      onBlockAdded: () => {
        throw new Error('disk full')
      },
      onFlushError,
    })

    blockchain.addEvent(event('a', 'DENIED'))
    blockchain.addEvent(event('b'))

    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
    expect(onFlushError).toHaveBeenCalledTimes(1)
    const [error, events] = onFlushError.mock.calls[0] ?? []
    expect(error).toBeInstanceOf(Error)
    expect((events as AccessEvent[]).map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('keeps the events in the chain when only saving it failed, so the next save writes them', () => {
    const saves: number[] = []
    let failNext = true
    const blockchain = new Blockchain({
      batchSize: 5,
      flushIntervalMs: 2000,
      onBlockAdded: (chain) => {
        if (failNext) {
          failNext = false
          throw new Error('disk full')
        }
        saves.push(chain.length)
      },
      onFlushError: () => undefined,
    })

    blockchain.addEvent(event('a'))
    vi.advanceTimersByTime(2000)

    expect(blockchain.pending).toHaveLength(0)
    expect(blockchain.getLatestBlock().data.map((e) => e.id)).toEqual(['a'])

    blockchain.addEvent(event('b'))
    vi.advanceTimersByTime(2000)

    expect(saves).toEqual([3])
  })

  it('puts the events back in pending when the block never reached the chain', () => {
    const blockchain = new Blockchain({
      batchSize: 5,
      flushIntervalMs: 2000,
      onFlushError: () => undefined,
    })
    const addBlock = vi.spyOn(blockchain, 'addBlock').mockImplementationOnce(() => {
      throw new Error('boom')
    })

    blockchain.addEvent(event('a'))
    vi.advanceTimersByTime(2000)

    expect(blockchain.pending.map((e) => e.id)).toEqual(['a'])

    addBlock.mockRestore()
    blockchain.addEvent(event('b'))
    vi.advanceTimersByTime(2000)

    expect(blockchain.pending).toHaveLength(0)
    expect(blockchain.getLatestBlock().data.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('still reports on the console when no onFlushError is wired', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const blockchain = new Blockchain({
      batchSize: 5,
      flushIntervalMs: 2000,
      onBlockAdded: () => {
        throw new Error('disk full')
      },
    })

    blockchain.addEvent(event('a'))

    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
  })
})
