import { describe, expect, it } from 'vitest'
import { Block } from '../chain/block.js'
import type { AccessEvent } from '../chain/access-event.js'
import { signAccessEvent } from '../chain/access-event-signing.js'
import { findFirstInvalidBlockIndex } from '../chain/chain-validation.js'
import { generateKeyPair } from '../chain/keypair.js'
import { tamperChain } from './tamper.js'

const keyPair = generateKeyPair()

function event(id: string, userId: number): AccessEvent {
  return signAccessEvent(
    {
      id,
      patientId: 1,
      userId,
      role: 'NURSE',
      action: 'READ',
      timestamp: '2026-09-29T10:00:00.000Z',
      serverId: 'server-3001',
    },
    keyPair.privateKey,
    keyPair.publicKey,
  )
}

function buildChain(): Block[] {
  const genesis = new Block(0, '2026-01-01T00:00:00.000Z', [], '0', 0)
  const first = new Block(1, '2026-09-29T10:00:01.000Z', [event('a', 7)], genesis.hash, 0)
  const second = new Block(2, '2026-09-29T10:00:02.000Z', [event('b', 8)], first.hash, 0)
  return [genesis, first, second]
}

describe('tamperChain', () => {
  it('rewrites who read the record in the first block that has events', () => {
    const { chain, tamperedIndex } = tamperChain(buildChain(), 999)

    expect(tamperedIndex).toBe(1)
    expect(chain[1]?.data[0]?.userId).toBe(999)
  })

  it('leaves a chain that validation flags at the tampered block', () => {
    const { chain } = tamperChain(buildChain(), 999)

    expect(findFirstInvalidBlockIndex(chain)).toBe(1)
  })

  it('does not change the chain it was given', () => {
    const original = buildChain()

    tamperChain(original, 999)

    expect(original[1]?.data[0]?.userId).toBe(7)
    expect(findFirstInvalidBlockIndex(original)).toBeNull()
  })

  it('refuses a chain with no events to tamper with', () => {
    const genesis = new Block(0, '2026-01-01T00:00:00.000Z', [], '0', 0)

    expect(() => tamperChain([genesis], 999)).toThrow(/no events/)
  })
})
