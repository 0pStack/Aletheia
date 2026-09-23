import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import { logAccessEvent } from './audit-logger.js'
import { Blockchain } from './chain/blockchain.js'
import { verifyAccessEvent } from './chain/access-event-signing.js'
import { generateKeyPair } from './chain/keypair.js'

describe('logAccessEvent', () => {
  it('signs events before they enter the blockchain batch', () => {
    const blockchain = new Blockchain({ batchSize: 5 })
    const keyPair = generateKeyPair()
    const req = {
      session: {
        user: {
          id: 42,
          role: 'DOCTOR',
        },
      },
    } as unknown as Request

    logAccessEvent(req, blockchain, 123, 'READ', keyPair)

    expect(blockchain.chain).toHaveLength(1)
    expect(blockchain.pending).toHaveLength(1)
    expect(blockchain.pending[0]).toMatchObject({
      patientId: 123,
      userId: 42,
      role: 'DOCTOR',
      action: 'READ',
      publicKey: keyPair.publicKey,
    })
    expect(blockchain.pending[0]?.signature).toBeTruthy()
    expect(blockchain.pending[0] && verifyAccessEvent(blockchain.pending[0])).toBe(true)
  })
})
