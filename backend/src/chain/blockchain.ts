import { Block } from './block.js'
import type { AccessEvent } from './access-event.js'
import { calculateMerkleRoot } from './merkle.js'
import { verifyAccessEvent } from './access-event-signing.js'

export interface BlockchainOptions {
  batchSize?: number
  flushIntervalMs?: number
  chain?: Block[]
  onBlockAdded?: (chain: Block[]) => void
}

const GENESIS_TIMESTAMP = '2026-01-01T00:00:00.000Z'

export class Blockchain {
  public chain: Block[]
  public pending: AccessEvent[] = []
  private readonly batchSize: number
  private readonly flushIntervalMs: number | undefined
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private readonly onBlockAdded: ((chain: Block[]) => void) | undefined

  constructor(options: BlockchainOptions = {}) {
    const batchSize = options.batchSize ?? 1

    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error('batchSize must be a positive integer')
    }

    this.batchSize = batchSize
    this.flushIntervalMs = options.flushIntervalMs
    this.onBlockAdded = options.onBlockAdded
    this.chain =
      options.chain && options.chain.length > 0 ? options.chain : [this.createGenesisBlock()]
  }

  private createGenesisBlock(): Block {
    return new Block(0, GENESIS_TIMESTAMP, [], '0', 0)
  }

  getLatestBlock(): Block {
    const latestBlock = this.chain[this.chain.length - 1]

    if (!latestBlock) {
      throw new Error('Blockchain is empty')
    }

    return latestBlock
  }

  addBlock(data: AccessEvent[]): Block {
    const previousBlock = this.getLatestBlock()

    const newBlock = new Block(
      previousBlock.index + 1,
      new Date().toISOString(),
      data,
      previousBlock.hash,
      0,
    )

    this.chain.push(newBlock)
    this.onBlockAdded?.(this.chain)

    return newBlock
  }

  addEvent(event: AccessEvent): void {
    this.pending.push(event)

    if (this.pending.length >= this.batchSize) {
      this.flush()
      return
    }

    this.startFlushTimer()
  }

  flush(): Block | undefined {
    this.clearFlushTimer()

    if (this.pending.length === 0) {
      return undefined
    }

    const events = this.pending
    this.pending = []

    return this.addBlock(events)
  }

  private startFlushTimer(): void {
    if (this.flushTimer || this.flushIntervalMs === undefined) {
      return
    }

    this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs)
    this.flushTimer.unref()
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  findFirstInvalidBlockIndex(): number | null {
    const genesisBlock = this.chain[0]

    if (!genesisBlock || genesisBlock.previousHash !== '0') {
      return 0
    }

    for (let i = 0; i < this.chain.length; i++) {
      const currentBlock = this.chain[i]

      if (!currentBlock) {
        return i
      }

      const recalculatedHash = currentBlock.calculateHash()
      if (currentBlock.merkleRoot !== calculateMerkleRoot(currentBlock.data)) {
        return i
      }

      if (currentBlock.hash !== recalculatedHash) {
        return i
      }

      if (!currentBlock.data.every(verifyAccessEvent)) {
        return i
      }

      if (i > 0) {
        const previousBlock = this.chain[i - 1]

        if (!previousBlock) {
          return i
        }

        if (currentBlock.previousHash !== previousBlock.hash) {
          return i
        }
      }
    }

    return null
  }

  isChainValid(): boolean {
    return this.findFirstInvalidBlockIndex() === null
  }
}
