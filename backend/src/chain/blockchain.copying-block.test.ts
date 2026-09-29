import { describe, expect, it, vi } from 'vitest'
import type { AccessEvent } from './access-event.js'
import { Blockchain } from './blockchain.js'

vi.mock('./block.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./block.js')>()

  class CopyingBlock extends original.Block {
    constructor(
      index: number,
      timestamp: string,
      data: AccessEvent[],
      previousHash: string,
      nonce: number,
    ) {
      super(index, timestamp, [...data], previousHash, nonce)
    }
  }

  return { ...original, Block: CopyingBlock }
})

function event(id: string): AccessEvent {
  return {
    id,
    patientId: 5,
    userId: 1,
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-09-25T00:00:00.000Z',
    serverId: 'server-test',
  }
}

describe('Blockchain.flush with a Block that copies its data', () => {
  it('does not re-queue events whose block reached the chain before a hook threw', () => {
    let failNext = true
    const blockchain = new Blockchain({
      batchSize: 1,
      onBlockAdded: () => {
        if (failNext) {
          failNext = false
          throw new Error('disk full')
        }
      },
    })

    expect(() => blockchain.addEvent(event('a'))).toThrow('disk full')
    expect(blockchain.pending).toHaveLength(0)

    blockchain.addEvent(event('b'))

    const recordedIds = blockchain.chain.flatMap((block) => block.data.map((e) => e.id))
    expect(recordedIds).toEqual(['a', 'b'])
  })
})
