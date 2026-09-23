import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blockchain } from './blockchain.js'
import type { AccessEvent } from './access-event.js'

const testEvent: AccessEvent = {
  id: 'event-1',
  patientId: 123,
  userId: 45,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-19T10:00:00.000Z',
  serverId: 'server-1',
}

describe('Blockchain', () => {
  it('accepts a valid chain', () => {
    const blockchain = new Blockchain()

    blockchain.addBlock([testEvent])

    blockchain.addBlock([
      {
        ...testEvent,
        id: 'event-2',
        action: 'WRITE',
      },
    ])

    expect(blockchain.isChainValid()).toBe(true)
  })

  it('rejects the chain when block data is changed', () => {
    const blockchain = new Blockchain()

    blockchain.addBlock([testEvent])

    const tamperedEvent = blockchain.chain[1]?.data[0]
    if (!tamperedEvent) throw new Error('expected the added block to hold one event')
    tamperedEvent.action = 'WRITE'

    expect(blockchain.isChainValid()).toBe(false)
  })

  it('rejects a block whose Merkle root does not match its events', () => {
    const blockchain = new Blockchain()
    const block = blockchain.addBlock([testEvent])

    block.merkleRoot = 'f'.repeat(64)
    block.hash = block.calculateHash()

    expect(blockchain.isChainValid()).toBe(false)
  })
})

describe('Blockchain batching', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a block per event by default', () => {
    const blockchain = new Blockchain()

    blockchain.addEvent(testEvent)

    expect(blockchain.chain.length).toBe(2)
    expect(blockchain.pending).toEqual([])
  })

  it('waits until the batch is full before creating a block', () => {
    const blockchain = new Blockchain({ batchSize: 3 })

    blockchain.addEvent({ ...testEvent, id: 'e1' })
    blockchain.addEvent({ ...testEvent, id: 'e2' })

    expect(blockchain.chain.length).toBe(1)
    expect(blockchain.pending.length).toBe(2)

    blockchain.addEvent({ ...testEvent, id: 'e3' })

    expect(blockchain.chain.length).toBe(2)
    expect(blockchain.getLatestBlock().data.map((event) => event.id)).toEqual(['e1', 'e2', 'e3'])
    expect(blockchain.pending).toEqual([])
  })

  it('creates a block from pending events when the timer fires', () => {
    const blockchain = new Blockchain({ batchSize: 5, flushIntervalMs: 1000 })

    blockchain.addEvent({ ...testEvent, id: 'e1' })
    blockchain.addEvent({ ...testEvent, id: 'e2' })

    vi.advanceTimersByTime(999)
    expect(blockchain.chain.length).toBe(1)

    vi.advanceTimersByTime(1)
    expect(blockchain.chain.length).toBe(2)
    expect(blockchain.getLatestBlock().data.length).toBe(2)
  })

  it('does not restart the timer when more events arrive', () => {
    const blockchain = new Blockchain({ batchSize: 5, flushIntervalMs: 1000 })

    blockchain.addEvent({ ...testEvent, id: 'e1' })
    vi.advanceTimersByTime(600)
    blockchain.addEvent({ ...testEvent, id: 'e2' })
    vi.advanceTimersByTime(400)

    expect(blockchain.chain.length).toBe(2)
    expect(blockchain.getLatestBlock().data.length).toBe(2)
  })

  it('never creates empty blocks', () => {
    const blockchain = new Blockchain({ batchSize: 2, flushIntervalMs: 1000 })

    blockchain.addEvent({ ...testEvent, id: 'e1' })
    blockchain.addEvent({ ...testEvent, id: 'e2' })
    vi.advanceTimersByTime(5000)

    expect(blockchain.chain.length).toBe(2)
    expect(blockchain.flush()).toBeUndefined()
  })

  it('stays valid with several events per block', () => {
    const blockchain = new Blockchain({ batchSize: 3 })

    for (let i = 1; i <= 7; i++) {
      blockchain.addEvent({ ...testEvent, id: `e${i}` })
    }
    blockchain.flush()

    expect(blockchain.chain.map((block) => block.data.length)).toEqual([0, 3, 3, 1])
    expect(blockchain.isChainValid()).toBe(true)
  })

  it('rejects an invalid batch size', () => {
    expect(() => new Blockchain({ batchSize: 0 })).toThrow()
  })
})
