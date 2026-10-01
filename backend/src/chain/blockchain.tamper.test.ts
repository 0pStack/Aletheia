import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blockchain } from './blockchain.js'
import type { Block } from './block.js'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent } from './access-event-signing.js'
import { generateKeyPair } from './keypair.js'

const keys = generateKeyPair()
const DETECTED_AT = new Date('2026-10-01T12:00:00.000Z')

function signedEvent(id: string): AccessEvent {
  return signAccessEvent(
    {
      id,
      patientId: 1,
      userId: 1,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-10-01T10:00:00.000Z',
      serverId: 'server-1',
    },
    keys.privateKey,
    keys.publicKey,
  )
}

function honestChain(length: number): Block[] {
  const blockchain = new Blockchain()
  for (let i = 1; i < length; i++) blockchain.addBlock([signedEvent(`event-${i}`)])
  return blockchain.chain
}

// What `npm run demo:tamper` does: rewrite who made the first access, leave the hashes alone.
function tamperFirstEvent(chain: Block[]): void {
  const event = chain[1]?.data[0]
  if (!event) throw new Error('expected an event in block 1')
  event.userId = 99
}

describe('Blockchain tamper record', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(DETECTED_AT)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('has none for an honest chain', () => {
    const blockchain = new Blockchain({ chain: honestChain(3) })

    expect(blockchain.findFirstInvalidBlockIndex()).toBeNull()
    expect(blockchain.tamperDetected).toBeNull()
  })

  it('records a chain that was already tampered when the node loaded it', () => {
    const chain = honestChain(3)
    tamperFirstEvent(chain)

    const blockchain = new Blockchain({ chain })

    expect(blockchain.tamperDetected).toEqual({
      blockIndex: 1,
      detectedAt: DETECTED_AT.toISOString(),
    })
  })

  it('records tampering found by a later check', () => {
    const blockchain = new Blockchain({ chain: honestChain(3) })
    tamperFirstEvent(blockchain.chain)

    expect(blockchain.findFirstInvalidBlockIndex()).toBe(1)
    expect(blockchain.tamperDetected).toEqual({
      blockIndex: 1,
      detectedAt: DETECTED_AT.toISOString(),
    })
  })

  it('keeps the record after a peer repairs the chain, even if nobody checked before', () => {
    const peer = honestChain(4)
    const blockchain = new Blockchain({ chain: honestChain(2) })
    tamperFirstEvent(blockchain.chain)

    expect(blockchain.replaceChain(peer)).toBe(true)

    expect(blockchain.isChainValid()).toBe(true)
    expect(blockchain.tamperDetected).toEqual({
      blockIndex: 1,
      detectedAt: DETECTED_AT.toISOString(),
    })
  })

  it('keeps the first detection rather than the latest', () => {
    const blockchain = new Blockchain({ chain: honestChain(3) })
    tamperFirstEvent(blockchain.chain)
    blockchain.findFirstInvalidBlockIndex()

    vi.setSystemTime(new Date('2026-10-01T13:00:00.000Z'))
    blockchain.findFirstInvalidBlockIndex()

    expect(blockchain.tamperDetected?.detectedAt).toBe(DETECTED_AT.toISOString())
  })
})
