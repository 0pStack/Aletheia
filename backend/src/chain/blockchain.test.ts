import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blockchain } from './blockchain.js'
import type { Block } from './block.js'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent } from './access-event-signing.js'
import { generateKeyPair } from './keypair.js'

const testEvent: AccessEvent = {
  id: 'event-1',
  patientId: 123,
  userId: 45,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-19T10:00:00.000Z',
  serverId: 'server-1',
}
const testKeys = generateKeyPair()
const signedTestEvent = (event: AccessEvent): AccessEvent =>
  signAccessEvent(event, testKeys.privateKey, testKeys.publicKey)

describe('Blockchain', () => {
  it('accepts a valid chain', () => {
    const blockchain = new Blockchain()

    blockchain.addBlock([signedTestEvent(testEvent)])

    blockchain.addBlock([
      signedTestEvent({
        ...testEvent,
        id: 'event-2',
        action: 'WRITE',
      }),
    ])

    expect(blockchain.isChainValid()).toBe(true)
  })

  it('rejects the chain when block data is changed', () => {
    const blockchain = new Blockchain()

    blockchain.addBlock([signedTestEvent(testEvent)])

    const tamperedEvent = blockchain.chain[1]?.data[0]
    if (!tamperedEvent) throw new Error('expected the added block to hold one event')
    tamperedEvent.action = 'WRITE'

    expect(blockchain.isChainValid()).toBe(false)
  })

  it('returns null when every block is valid', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([signedTestEvent(testEvent)])

    expect(blockchain.findFirstInvalidBlockIndex()).toBeNull()
  })

  it('returns the chain position of the first invalid block, not its stored index', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([signedTestEvent(testEvent)])

    const block = blockchain.chain[1]
    if (!block) throw new Error('expected a block at chain position one')
    block.index = 42
    block.hash = block.calculateHash()

    expect(blockchain.isChainValid()).toBe(true)

    block.hash = 'tampered'

    expect(blockchain.findFirstInvalidBlockIndex()).toBe(1)
  })

  it('returns the earliest invalid block when later links also fail', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([signedTestEvent(testEvent)])
    blockchain.addBlock([signedTestEvent({ ...testEvent, id: 'event-2' })])
    blockchain.addBlock([signedTestEvent({ ...testEvent, id: 'event-3' })])

    const tamperedEvent = blockchain.chain[1]?.data[0]
    if (!tamperedEvent) throw new Error('expected the added block to hold one event')
    tamperedEvent.action = 'WRITE'

    expect(blockchain.findFirstInvalidBlockIndex()).toBe(1)
  })

  it('rejects a block whose Merkle root does not match its events', () => {
    const blockchain = new Blockchain()
    const block = blockchain.addBlock([signedTestEvent(testEvent)])

    block.merkleRoot = 'f'.repeat(64)
    block.hash = block.calculateHash()

    expect(blockchain.isChainValid()).toBe(false)
  })

  it('creates the same genesis block every time', () => {
    expect(new Blockchain().chain[0]?.hash).toBe(new Blockchain().chain[0]?.hash)
  })

  it('continues from a chain passed in', () => {
    const original = new Blockchain()
    original.addBlock([signedTestEvent(testEvent)])

    const restored = new Blockchain({ chain: original.chain })
    restored.addBlock([signedTestEvent({ ...testEvent, id: 'event-2' })])

    expect(restored.chain.length).toBe(3)
    expect(restored.isChainValid()).toBe(true)
  })

  it('calls onBlockAdded with the whole chain after each new block', () => {
    const saves: number[] = []
    const blockchain = new Blockchain({
      onBlockAdded: (chain) => saves.push(chain.length),
    })

    blockchain.addBlock([testEvent])
    blockchain.addBlock([testEvent])

    expect(saves).toEqual([2, 3])
  })

  it('calls onNewBlock with the newly added block', () => {
    const blocks: Block[] = []
    const blockchain = new Blockchain({
      onNewBlock: (block) => blocks.push(block),
    })

    const addedBlock = blockchain.addBlock([testEvent])

    expect(blocks).toEqual([addedBlock])
  })

  it('rejects a block containing an event with a forged signature', () => {
    const blockchain = new Blockchain()
    const attacker = generateKeyPair()
    const forgedEvent = signAccessEvent(testEvent, attacker.privateKey, testKeys.publicKey)
    blockchain.addBlock([forgedEvent])

    expect(blockchain.isChainValid()).toBe(false)
  })

  it('accepts a valid incoming block from a peer', () => {
    const peer = new Blockchain()
    const incomingBlock = peer.addBlock([signedTestEvent(testEvent)])

    const blockchain = new Blockchain()

    expect(blockchain.acceptBlock(incomingBlock)).toBe(true)
    expect(blockchain.getLatestBlock()).toBe(incomingBlock)
    expect(blockchain.chain).toHaveLength(2)
  })

  it('rejects an incoming block with a broken previous hash', () => {
    const peer = new Blockchain()
    const incomingBlock = peer.addBlock([signedTestEvent(testEvent)])

    incomingBlock.previousHash = 'f'.repeat(64)
    incomingBlock.hash = incomingBlock.calculateHash()

    const blockchain = new Blockchain()

    expect(blockchain.acceptBlock(incomingBlock)).toBe(false)
    expect(blockchain.chain).toHaveLength(1)
  })

  it('keeps an empty genesis block valid', () => {
    expect(new Blockchain().isChainValid()).toBe(true)
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
      blockchain.addEvent(signedTestEvent({ ...testEvent, id: `e${i}` }))
    }
    blockchain.flush()

    expect(blockchain.chain.map((block) => block.data.length)).toEqual([0, 3, 3, 1])
    expect(blockchain.isChainValid()).toBe(true)
  })

  it('rejects an invalid batch size', () => {
    expect(() => new Blockchain({ batchSize: 0 })).toThrow()
  })
})
