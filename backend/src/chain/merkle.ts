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
