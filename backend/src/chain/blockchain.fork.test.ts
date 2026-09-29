import { afterEach, describe, expect, it, vi } from 'vitest'
import { Blockchain } from './blockchain.js'
import type { Block } from './block.js'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent } from './access-event-signing.js'
import { generateKeyPair } from './keypair.js'

const baseEvent: AccessEvent = {
  id: 'base',
  patientId: 123,
  userId: 45,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-28T10:00:00.000Z',
  serverId: 'server-3001',
}
const keys = generateKeyPair()
const signed = (id: string): AccessEvent =>
  signAccessEvent({ ...baseEvent, id }, keys.privateKey, keys.publicKey)

const eventIds = (blocks: Block[]): string[] =>
  blocks.flatMap((block) => block.data.map((event) => event.id))

describe('fork resolution', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('re-adds events from the losing branch on top of the winning chain', () => {
    const ours = new Blockchain()
    const theirs = new Blockchain()
    ours.addBlock([signed('ours-1')])
    theirs.addBlock([signed('theirs-1')])
    theirs.addBlock([signed('theirs-2')])

    expect(ours.replaceChain(theirs.chain)).toBe(true)
    expect(ours.pending.map((event) => event.id)).toEqual(['ours-1'])

    const block = ours.flush()

    expect(block?.previousHash).toBe(theirs.getLatestBlock().hash)
    expect(eventIds(ours.chain)).toEqual(['theirs-1', 'theirs-2', 'ours-1'])
    expect(ours.isChainValid()).toBe(true)
  })

  it('does not re-add events from blocks both branches share', () => {
    const theirs = new Blockchain()
    theirs.addBlock([signed('shared')])
    const ours = new Blockchain({ chain: [...theirs.chain] })
    ours.addBlock([signed('ours-1')])
    theirs.addBlock([signed('theirs-1')])
    theirs.addBlock([signed('theirs-2')])

    ours.replaceChain(theirs.chain)

    expect(ours.pending.map((event) => event.id)).toEqual(['ours-1'])
  })

  it('does not re-add an event the winning chain already holds', () => {
    const ours = new Blockchain()
    const theirs = new Blockchain()
    ours.addBlock([signed('in-both'), signed('ours-1')])
    theirs.addBlock([signed('in-both')])
    theirs.addBlock([signed('theirs-1')])

    ours.replaceChain(theirs.chain)

    expect(ours.pending.map((event) => event.id)).toEqual(['ours-1'])
  })

  it('puts re-added events before events that were already waiting', () => {
    const ours = new Blockchain({ batchSize: 5 })
    const theirs = new Blockchain()
    ours.addBlock([signed('ours-1')])
    ours.addEvent(signed('waiting'))
    theirs.addBlock([signed('theirs-1')])
    theirs.addBlock([signed('theirs-2')])

    ours.replaceChain(theirs.chain)

    expect(ours.pending.map((event) => event.id)).toEqual(['ours-1', 'waiting'])
  })

  it('re-adds nothing when the incoming chain is rejected', () => {
    const ours = new Blockchain()
    const theirs = new Blockchain()
    ours.addBlock([signed('ours-1')])
    ours.addBlock([signed('ours-2')])
    theirs.addBlock([signed('theirs-1')])

    expect(ours.replaceChain(theirs.chain)).toBe(false)
    expect(ours.pending).toEqual([])
  })

  it('seals and broadcasts the re-added events when the flush timer fires', () => {
    vi.useFakeTimers()
    const loser = new Blockchain()
    loser.addBlock([signed('ours-1')])
    const broadcasts: Block[] = []
    const ours = new Blockchain({
      chain: [...loser.chain],
      flushIntervalMs: 2000,
      onNewBlock: (block) => broadcasts.push(block),
    })
    const theirs = new Blockchain()
    theirs.addBlock([signed('theirs-1')])
    theirs.addBlock([signed('theirs-2')])

    ours.replaceChain(theirs.chain)

    expect(broadcasts).toEqual([])

    vi.advanceTimersByTime(2000)

    expect(broadcasts.map((block) => eventIds([block]))).toEqual([['ours-1']])
    expect(ours.isChainValid()).toBe(true)
  })
})
