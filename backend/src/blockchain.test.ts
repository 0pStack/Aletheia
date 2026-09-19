import { describe, expect, it } from 'vitest'
import { Blockchain } from './blockchain.js'
import type { AccessEvent } from './chain/access-event.js'

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

    blockchain.chain[1]!.data[0]!.action = 'WRITE'

    expect(blockchain.isChainValid()).toBe(false)
  })
})
