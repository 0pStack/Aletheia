import { createHash } from 'node:crypto'
import type { AccessEvent } from './access-event.js'
import { stableStringify } from './stable-stringify.js'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export const EMPTY_MERKLE_ROOT = sha256('')

export function hashLeaf(event: AccessEvent): string {
  return sha256(stableStringify(event))
}

export function hashPair(left: string, right: string): string {
  return sha256(left + right)
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
      const right = current[i + 1] ?? left
      next.push(hashPair(left, right))
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
    const siblingIndex = isRight ? index - 1 : index + 1
    // An odd last node was paired with itself when the level above was built.
    const sibling = level[siblingIndex] ?? (level[index] as string)

    proof.push({ hash: sibling, position: isRight ? 'left' : 'right' })
    index = Math.floor(index / 2)
  }

  return proof
}

export function verifyMerkleProof(
  leaf: string,
  proof: readonly MerkleProofStep[],
  root: string,
): boolean {
  const computed = proof.reduce(
    (hash, step) =>
      step.position === 'left' ? hashPair(step.hash, hash) : hashPair(hash, step.hash),
    leaf,
  )

  return computed === root
}
