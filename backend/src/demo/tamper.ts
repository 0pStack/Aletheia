import { Block, type BlockData } from '../chain/block.js'

export interface TamperResult {
  chain: Block[]
  tamperedIndex: number
}

// The attack the chain exists to catch: someone with disk access rewrites who read a
// record, but leaves the stored hashes alone because they cannot recompute them unseen.
export function tamperChain(chain: readonly Block[], fakeUserId: number): TamperResult {
  const copy = chain.map((block) => Block.fromJSON(JSON.parse(JSON.stringify(block)) as BlockData))
  const target = copy.find((block) => block.data.length > 0)

  if (!target) {
    throw new Error('The chain has no events to tamper with')
  }

  target.data = target.data.map((event, i) => (i === 0 ? { ...event, userId: fakeUserId } : event))

  return { chain: copy, tamperedIndex: target.index }
}
