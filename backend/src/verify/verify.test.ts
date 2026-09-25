import { describe, expect, it } from 'vitest'
import type { AccessEvent } from '../chain/access-event.js'
import { signAccessEvent } from '../chain/access-event-signing.js'
import { Blockchain } from '../chain/blockchain.js'
import { generateKeyPair } from '../chain/keypair.js'
import { verifyMerkleProof } from '../chain/merkle.js'
import { locateEvent, proveEvent } from './verify.js'

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

function proofFor(blockchain: Blockchain, eventId: string) {
  const located = locateEvent(blockchain, eventId)
  if (located.status !== 'found') throw new Error(`expected ${eventId} on the chain`)
  return proveEvent(blockchain, located)
}

describe('locateEvent', () => {
  it('finds the block holding the event and names its patient', () => {
    const blockchain = chainWith([makeEvent('a')], [makeEvent('b', 3)], [makeEvent('c')])

    const located = locateEvent(blockchain, 'b')

    expect(located).toMatchObject({ status: 'found', patientId: 3, block: { index: 2 } })
  })

  it('does not validate anything, so a stranger learns nothing from how long it takes', () => {
    const blockchain = chainWith([makeEvent('a', 2)])
    const block = blockchain.getLatestBlock()
    block.hash = 'f'.repeat(64)

    expect(locateEvent(blockchain, 'a')).toMatchObject({ status: 'found', patientId: 2 })
  })

  it('reports an event still waiting for its block as pending', () => {
    const blockchain = new Blockchain({ batchSize: 5 })
    blockchain.addEvent(makeEvent('queued', 7))

    expect(locateEvent(blockchain, 'queued')).toEqual({ status: 'pending', patientId: 7 })
  })

  it('reports an unknown event as missing', () => {
    expect(locateEvent(chainWith([makeEvent('a')]), 'nope')).toEqual({ status: 'missing' })
  })
})

describe('proveEvent', () => {
  it('returns a proof that rebuilds the root of the block holding the event', () => {
    const events = ['a', 'b', 'c'].map((id) => makeEvent(id))
    const blockchain = chainWith(events)
    const block = blockchain.getLatestBlock()

    const proof = proofFor(blockchain, 'b')

    expect(proof).toMatchObject({
      eventId: 'b',
      blockIndex: block.index,
      blockHash: block.hash,
      merkleRoot: block.merkleRoot,
      isValid: true,
    })
    expect(verifyMerkleProof(events[1] as AccessEvent, proof.proof, block.merkleRoot)).toBe(true)
  })

  it('proves an event in an earlier block', () => {
    const blockchain = chainWith([makeEvent('a')], [makeEvent('b')], [makeEvent('c')])

    expect(proofFor(blockchain, 'a')).toMatchObject({ blockIndex: 1, isValid: true })
  })

  describe('marks the proof invalid', () => {
    it('when the event was altered after it was sealed', () => {
      const blockchain = chainWith([makeEvent('a'), makeEvent('b')])
      const block = blockchain.getLatestBlock()
      block.data = block.data.map((event) =>
        event.id === 'b' ? { ...event, action: 'WRITE' } : event,
      )

      expect(proofFor(blockchain, 'b').isValid).toBe(false)
    })

    it('when an earlier block has been tampered with', () => {
      const blockchain = chainWith([makeEvent('a')], [makeEvent('b')])
      const first = blockchain.chain[1]
      if (first) first.data = [{ ...(first.data[0] as AccessEvent), userId: 99 }]

      expect(proofFor(blockchain, 'b').isValid).toBe(false)
    })
  })

  it('stays valid when only a later block is broken', () => {
    const blockchain = chainWith([makeEvent('a')], [makeEvent('b')])
    const later = blockchain.chain[2]
    if (later) later.hash = 'f'.repeat(64)

    expect(proofFor(blockchain, 'a').isValid).toBe(true)
  })
})
