import { Block } from './block.js'
import type { AccessEvent } from './access-event.js'
import { calculateMerkleRoot } from './merkle.js'

export interface BlockchainOptions {
  batchSize?: number
  flushIntervalMs?: number
}

export class Blockchain {
  public chain: Block[]
  public pending: AccessEvent[] = []
  private readonly batchSize: number
  private readonly flushIntervalMs: number | undefined
  private flushTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: BlockchainOptions = {}) {
    const batchSize = options.batchSize ?? 1

    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error('batchSize must be a positive integer')
    }

    this.batchSize = batchSize
    this.flushIntervalMs = options.flushIntervalMs
    this.chain = [this.createGenesisBlock()]
  }

  private createGenesisBlock(): Block {
    return new Block(0, new Date().toISOString(), [], '0', 0)
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

  isChainValid(): boolean {
    const genesisBlock = this.chain[0]

    if (!genesisBlock || genesisBlock.previousHash !== '0') {
      return false
    }

    for (let i = 0; i < this.chain.length; i++) {
      const currentBlock = this.chain[i]

      if (!currentBlock) {
        return false
      }

      const recalculatedHash = currentBlock.calculateHash()
      if (currentBlock.merkleRoot !== calculateMerkleRoot(currentBlock.data)) {
        return false
      }

      if (currentBlock.hash !== recalculatedHash) {
        return false
      }

      if (i > 0) {
        const previousBlock = this.chain[i - 1]

        if (!previousBlock) {
          return false
        }

        if (currentBlock.previousHash !== previousBlock.hash) {
          return false
        }
      }
    }

    return true
  }
}
