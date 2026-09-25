import type { AccessEvent } from '../chain/access-event.js'
import type { Block } from '../chain/block.js'
import type { Blockchain } from '../chain/blockchain.js'
import { findFirstInvalidBlockIndex } from '../chain/chain-validation.js'
import {
  getMerkleProof,
  hashLeaf,
  verifyMerkleProof,
  type MerkleProofStep,
} from '../chain/merkle.js'

export interface EventProof {
  eventId: string
  blockIndex: number
  blockHash: string
  merkleRoot: string
  proof: MerkleProofStep[]
  isValid: boolean
}

export interface LocatedEvent {
  status: 'found'
  patientId: number
  block: Block
  event: AccessEvent
}

export type EventLocation =
  LocatedEvent | { status: 'pending'; patientId: number } | { status: 'missing' }

// Deliberately cheap: no hashing or signature checks happen until the route has decided
// the caller may see the event, so an event in someone else's record costs the same as
// one that does not exist.
export function locateEvent(blockchain: Blockchain, eventId: string): EventLocation {
  for (const block of blockchain.chain) {
    const event = block.data.find((candidate) => candidate.id === eventId)
    if (event) return { status: 'found', patientId: event.patientId, block, event }
  }

  const queued = blockchain.pending.find((candidate) => candidate.id === eventId)
  return queued ? { status: 'pending', patientId: queued.patientId } : { status: 'missing' }
}

export function proveEvent(blockchain: Blockchain, { block, event }: LocatedEvent): EventProof {
  const proof = getMerkleProof(block.data.map(hashLeaf), hashLeaf(event)) ?? []
  // A block is only as trustworthy as the chain leading up to it, so later blocks are
  // neither checked nor able to spoil the answer.
  // Sliced by position, not by block.index, which a tampered block could misstate.
  const upToBlock = blockchain.chain.slice(0, blockchain.chain.indexOf(block) + 1)
  const chainHolds = findFirstInvalidBlockIndex(upToBlock) === null

  return {
    eventId: event.id,
    blockIndex: block.index,
    blockHash: block.hash,
    merkleRoot: block.merkleRoot,
    proof,
    isValid: chainHolds && verifyMerkleProof(event, proof, block.merkleRoot),
  }
}
