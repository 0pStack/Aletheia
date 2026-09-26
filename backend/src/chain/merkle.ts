import { createHash } from 'node:crypto'
import type { AccessEvent } from './access-event.js'
import { stableStringify } from './stable-stringify.js'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export const EMPTY_MERKLE_ROOT = sha256('')

// RFC 6962 domain separation: the prefix byte keeps an inner node from ever passing as a leaf.
const LEAF_PREFIX = Buffer.from([0x00])
const NODE_PREFIX = Buffer.from([0x01])

export function hashLeaf(event: AccessEvent): string {
  return createHash('sha256').update(LEAF_PREFIX).update(stableStringify(event)).digest('hex')
}

export function hashNode(left: string, right: string): string {
  return createHash('sha256')
    .update(NODE_PREFIX)
    .update(Buffer.from(left, 'hex'))
    .update(Buffer.from(right, 'hex'))
    .digest('hex')
}

export function buildMerkleLevels(leaves: string[]): string[][] {
  if (leaves.length === 0) {
    return [[EMPTY_MERKLE_ROOT]]
  }

  const levels: string[][] = [leaves]
  let current = leaves

  while (current.length > 1) {
    const next: string[] = []

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i] as string
      const right = current[i + 1]
      // An odd last node is promoted, not paired with itself, so [a, b, c] and [a, b, c, c] differ.
      next.push(right === undefined ? left : hashNode(left, right))
    }

    levels.push(next)
    current = next
  }

  return levels
}

export function calculateMerkleRoot(events: AccessEvent[]): string {
  const levels = buildMerkleLevels(events.map((event) => hashLeaf(event)))

  return levels.at(-1)?.[0] ?? EMPTY_MERKLE_ROOT
}

// `position` is where the sibling sits, so the verifier knows which side to hash it on.
export interface MerkleProofStep {
  hash: string
  position: 'left' | 'right'
}

// The sibling hashes from the leaf up to the root: enough to rebuild the root without
// seeing any other event in the block.
export function getMerkleProof(leaves: string[], leaf: string): MerkleProofStep[] | null {
  let index = leaves.indexOf(leaf)
  if (index === -1) return null

  const proof: MerkleProofStep[] = []

  for (const level of buildMerkleLevels(leaves).slice(0, -1)) {
    const isRight = index % 2 === 1
    const sibling = level[isRight ? index - 1 : index + 1]

    // No sibling means this node was promoted, so the level adds nothing to the proof.
    if (sibling !== undefined) {
      proof.push({ hash: sibling, position: isRight ? 'left' : 'right' })
    }
    index = Math.floor(index / 2)
  }

  return proof
}

// Takes the event, not its hash, so a caller cannot start the walk from an arbitrary node.
export function verifyMerkleProof(
  event: AccessEvent,
  proof: readonly MerkleProofStep[],
  root: string,
): boolean {
  const computed = proof.reduce(
    (hash, step) =>
      step.position === 'left' ? hashNode(step.hash, hash) : hashNode(hash, step.hash),
    hashLeaf(event),
  )

  return computed === root
}
