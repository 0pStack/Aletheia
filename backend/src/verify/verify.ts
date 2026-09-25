import type { Blockchain } from '../chain/blockchain.js'
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

// patientId travels with the lookup so the route can apply the access rules, but it is
// never part of the proof sent to the client.
export type EventProofLookup =
  | { status: 'found'; patientId: number; proof: EventProof }
  | { status: 'pending'; patientId: number }
  | { status: 'missing' }

export function findEventProof(blockchain: Blockchain, eventId: string): EventProofLookup {
  for (const block of blockchain.chain) {
    const event = block.data.find((candidate) => candidate.id === eventId)
    if (!event) continue

    const proof = getMerkleProof(block.data.map(hashLeaf), hashLeaf(event)) ?? []
    // A block is only as trustworthy as the chain leading up to it; later blocks do not matter.
    const firstInvalid = blockchain.findFirstInvalidBlockIndex()
    const chainHolds = firstInvalid === null || firstInvalid > block.index

    return {
      status: 'found',
      patientId: event.patientId,
      proof: {
        eventId,
        blockIndex: block.index,
        blockHash: block.hash,
        merkleRoot: block.merkleRoot,
        proof,
        isValid: chainHolds && verifyMerkleProof(event, proof, block.merkleRoot),
      },
    }
  }

  const queued = blockchain.pending.find((candidate) => candidate.id === eventId)
  return queued ? { status: 'pending', patientId: queued.patientId } : { status: 'missing' }
}
