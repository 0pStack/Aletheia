import { describe, expect, it } from 'vitest'
import { Block } from './block.js'
import type { AccessEvent } from './access-event.js'

const event: AccessEvent = {
  id: 'event-1',
  patientId: 101,
  userId: 5,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-17T10:00:00.000Z',
  serverId: 'server-1',
}

describe('Block', () => {
  it('produces the same hash for the same input', () => {
    const block1 = new Block(1, event.timestamp, [event], 'previous-hash', 0)
    const block2 = new Block(1, event.timestamp, [event], 'previous-hash', 0)

    expect(block1.hash).toBe(block2.hash)
  })

  it('changes the hash when a block field changes', () => {
    const block = new Block(1, event.timestamp, [event], 'previous-hash', 0)

    block.nonce = 1

    expect(block.calculateHash()).not.toBe(block.hash)
  })
})
