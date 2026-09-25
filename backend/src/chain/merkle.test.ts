import { describe, expect, it } from 'vitest'
import type { AccessEvent } from './access-event.js'
import {
  EMPTY_MERKLE_ROOT,
  buildMerkleLevels,
  calculateMerkleRoot,
  getMerkleProof,
  hashLeaf,
  hashPair,
  verifyMerkleProof,
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

describe('getMerkleProof and verifyMerkleProof', () => {
  const events = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(makeEvent)

  it.each([1, 2, 3, 4, 5, 6, 7])(
    'proves every event in a block of %i against its root',
    (count) => {
      const block = events.slice(0, count)
      const leaves = block.map(hashLeaf)
      const root = calculateMerkleRoot(block)

      for (const leaf of leaves) {
        const proof = getMerkleProof(leaves, leaf)
        expect(proof).not.toBeNull()
        expect(verifyMerkleProof(leaf, proof ?? [], root)).toBe(true)
      }
    },
  )

  it('needs no siblings when the block holds a single event', () => {
    expect(getMerkleProof([hashLeaf(a)], hashLeaf(a))).toEqual([])
  })

  it('pairs the odd last event with itself', () => {
    const leaves = [a, b, c].map(hashLeaf)

    expect(getMerkleProof(leaves, hashLeaf(c))?.[0]).toEqual({
      hash: hashLeaf(c),
      position: 'right',
    })
  })

  it('names the side each sibling sits on', () => {
    const leaves = [a, b].map(hashLeaf)

    expect(getMerkleProof(leaves, hashLeaf(a))).toEqual([{ hash: hashLeaf(b), position: 'right' }])
    expect(getMerkleProof(leaves, hashLeaf(b))).toEqual([{ hash: hashLeaf(a), position: 'left' }])
  })

  it('returns null for an empty block', () => {
    expect(getMerkleProof([], hashLeaf(a))).toBeNull()
  })

  it('returns null for an event that is not in the block', () => {
    expect(getMerkleProof([a, b].map(hashLeaf), hashLeaf(c))).toBeNull()
  })

  describe('rejects', () => {
    const block = [a, b, c]
    const leaves = block.map(hashLeaf)
    const root = calculateMerkleRoot(block)
    const proof = getMerkleProof(leaves, hashLeaf(b)) ?? []

    it('an altered event', () => {
      expect(verifyMerkleProof(hashLeaf({ ...b, userId: 99 }), proof, root)).toBe(false)
    })

    it('a proof checked against another block’s root', () => {
      expect(verifyMerkleProof(hashLeaf(b), proof, calculateMerkleRoot([a, b]))).toBe(false)
    })

    it('a swapped sibling hash', () => {
      const forged = proof.map((step, i) => (i === 0 ? { ...step, hash: hashLeaf(c) } : step))
      expect(verifyMerkleProof(hashLeaf(b), forged, root)).toBe(false)
    })

    it('a sibling moved to the wrong side', () => {
      const flipped = proof.map((step) => ({
        ...step,
        position: step.position === 'left' ? ('right' as const) : ('left' as const),
      }))
      expect(verifyMerkleProof(hashLeaf(b), flipped, root)).toBe(false)
    })

    it('a proof with a step removed', () => {
      expect(verifyMerkleProof(hashLeaf(b), proof.slice(1), root)).toBe(false)
    })
  })
})
