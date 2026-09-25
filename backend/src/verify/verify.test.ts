import { describe, expect, it } from 'vitest'
import type { AccessEvent } from '../chain/access-event.js'
import { signAccessEvent } from '../chain/access-event-signing.js'
import { Blockchain } from '../chain/blockchain.js'
import { generateKeyPair } from '../chain/keypair.js'
import { verifyMerkleProof } from '../chain/merkle.js'
import { findEventProof } from './verify.js'

const keyPair = generateKeyPair()

function makeEvent(id: string, patientId = 1): AccessEvent {
  return signAccessEvent(
    {
      id,
      patientId,
      userId: 5,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-25T10:00:00.000Z',
      serverId: 'server-1',
    },
    keyPair.privateKey,
    keyPair.publicKey,
  )
}

function chainWith(...blocks: AccessEvent[][]): Blockchain {
  const blockchain = new Blockchain()
  for (const events of blocks) blockchain.addBlock(events)
  return blockchain
}

describe('findEventProof', () => {
  it('returns a proof that rebuilds the root of the block holding the event', () => {
    const events = ['a', 'b', 'c'].map((id) => makeEvent(id))
    const blockchain = chainWith(events)
    const block = blockchain.getLatestBlock()

    const result = findEventProof(blockchain, 'b')

    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.patientId).toBe(1)
    expect(result.proof).toMatchObject({
      eventId: 'b',
      blockIndex: block.index,
      blockHash: block.hash,
      merkleRoot: block.merkleRoot,
      isValid: true,
    })
    expect(verifyMerkleProof(events[1] as AccessEvent, result.proof.proof, block.merkleRoot)).toBe(
      true,
    )
  })

  it('finds an event in an earlier block', () => {
    const blockchain = chainWith([makeEvent('a')], [makeEvent('b')], [makeEvent('c')])

    const result = findEventProof(blockchain, 'a')

    expect(result.status === 'found' && result.proof.blockIndex).toBe(1)
  })

  it('reports an event still waiting for its block as pending', () => {
    const blockchain = new Blockchain({ batchSize: 5 })
    blockchain.addEvent(makeEvent('queued', 7))

    expect(findEventProof(blockchain, 'queued')).toEqual({ status: 'pending', patientId: 7 })
  })

  it('reports an unknown event as missing', () => {
    expect(findEventProof(chainWith([makeEvent('a')]), 'nope')).toEqual({ status: 'missing' })
  })

  describe('marks the proof invalid', () => {
    it('when the event was altered after it was sealed', () => {
      const blockchain = chainWith([makeEvent('a'), makeEvent('b')])
      const block = blockchain.getLatestBlock()
      block.data = block.data.map((event) =>
        event.id === 'b' ? { ...event, action: 'WRITE' } : event,
      )

      const result = findEventProof(blockchain, 'b')

      expect(result.status === 'found' && result.proof.isValid).toBe(false)
    })

    it('when an earlier block has been tampered with', () => {
      const blockchain = chainWith([makeEvent('a')], [makeEvent('b')])
      const first = blockchain.chain[1]
      if (first) first.data = [{ ...(first.data[0] as AccessEvent), userId: 99 }]

      const result = findEventProof(blockchain, 'b')

      expect(result.status === 'found' && result.proof.isValid).toBe(false)
    })
  })

  it('stays valid when only a later block is broken', () => {
    const blockchain = chainWith([makeEvent('a')], [makeEvent('b')])
    const later = blockchain.chain[2]
    if (later) later.hash = 'f'.repeat(64)

    const result = findEventProof(blockchain, 'a')

    expect(result.status === 'found' && result.proof.isValid).toBe(true)
  })
})
