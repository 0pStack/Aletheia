import { describe, expect, it } from 'vitest'
import {
  hasOnlyAllowedAccessEventFields,
  hasOnlyAllowedBlockchainPayloadFields,
} from './payload-security.js'
import { Blockchain } from './blockchain.js'

describe('blockchain payload security', () => {
  it('rejects an access event containing a non-whitelisted field', () => {
    const unsafeEvent = {
      id: 'event-1',
      patientId: 101,
      userId: 5,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-17T10:00:00.000Z',
      serverId: 'server-1',
      journalText: 'Sensitive patient information',
    }

    expect(hasOnlyAllowedAccessEventFields(unsafeEvent)).toBe(false)
  })

  it('allows an access event containing only whitelisted fields', () => {
    const safeEvent = {
      id: 'event-1',
      patientId: 101,
      userId: 5,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-17T10:00:00.000Z',
      serverId: 'server-1',
      signature: 'signature',
      publicKey: 'public-key',
    }

    expect(hasOnlyAllowedAccessEventFields(safeEvent)).toBe(true)
  })

  it('rejects a blockchain when any block contains a non-whitelisted field', () => {
    const blockchain = new Blockchain()

    blockchain.addBlock([
      {
        id: 'event-1',
        patientId: 101,
        userId: 5,
        role: 'DOCTOR',
        action: 'READ',
        timestamp: '2026-09-17T10:00:00.000Z',
        serverId: 'server-1',
      },
    ])

    const block = blockchain.chain[1]
    const event = block?.data[0]

    expect(block).toBeDefined()
    expect(event).toBeDefined()

    if (!event) {
      throw new Error('Expected access event in blockchain')
    }

    const unsafeEvent = event as unknown as Record<string, unknown>
    unsafeEvent.journalText = 'Sensitive patient information'

    expect(hasOnlyAllowedBlockchainPayloadFields(blockchain.chain)).toBe(false)
  })

  it('allows a blockchain when all payload fields are whitelisted', () => {
    const blockchain = new Blockchain()

    blockchain.addBlock([
      {
        id: 'event-1',
        patientId: 101,
        userId: 5,
        role: 'DOCTOR',
        action: 'READ',
        timestamp: '2026-09-17T10:00:00.000Z',
        serverId: 'server-1',
      },
    ])

    expect(hasOnlyAllowedBlockchainPayloadFields(blockchain.chain)).toBe(true)
  })
})
