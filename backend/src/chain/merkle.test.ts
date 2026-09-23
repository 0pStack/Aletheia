import { describe, expect, it } from 'vitest'
import type { AccessEvent } from './access-event.js'
import {
  EMPTY_MERKLE_ROOT,
  buildMerkleLevels,
  calculateMerkleRoot,
  hashLeaf,
  hashPair,
} from './merkle.js'

function makeEvent(id: string): AccessEvent {
  return {
    id,
    patientId: 101,
    userId: 5,
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-09-23T10:00:00.000Z',
    serverId: 'server-1',
  }
}

const a = makeEvent('a')
const b = makeEvent('b')
const c = makeEvent('c')

describe('hashLeaf', () => {
  it('gives the same hash regardless of key order', () => {
    const reordered: AccessEvent = {
      serverId: a.serverId,
      timestamp: a.timestamp,
      action: a.action,
      role: a.role,
      userId: a.userId,
      patientId: a.patientId,
      id: a.id,
    }

    expect(hashLeaf(reordered)).toBe(hashLeaf(a))
  })

  it('changes when any field changes', () => {
    expect(hashLeaf({ ...a, action: 'WRITE' })).not.toBe(hashLeaf(a))
  })
})

describe('calculateMerkleRoot', () => {
  it('returns the empty root for no events', () => {
    expect(calculateMerkleRoot([])).toBe(EMPTY_MERKLE_ROOT)
  })

  it('returns the leaf hash for a single event', () => {
    expect(calculateMerkleRoot([a])).toBe(hashLeaf(a))
  })

  it('hashes two leaves together', () => {
    expect(calculateMerkleRoot([a, b])).toBe(hashPair(hashLeaf(a), hashLeaf(b)))
  })

  it('duplicates the last leaf when the count is odd', () => {
    expect(calculateMerkleRoot([a, b, c])).toBe(calculateMerkleRoot([a, b, c, c]))
  })

  it('depends on event order', () => {
    expect(calculateMerkleRoot([a, b])).not.toBe(calculateMerkleRoot([b, a]))
  })

  it('changes when one event is altered', () => {
    expect(calculateMerkleRoot([a, { ...b, userId: 99 }, c])).not.toBe(
      calculateMerkleRoot([a, b, c]),
    )
  })
})

describe('buildMerkleLevels', () => {
  it('keeps every level from leaves to root', () => {
    const levels = buildMerkleLevels([hashLeaf(a), hashLeaf(b), hashLeaf(c)])

    expect(levels.map((level) => level.length)).toEqual([3, 2, 1])
  })
})
