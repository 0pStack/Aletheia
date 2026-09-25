import { Block } from './block.js'
import type { AccessEvent } from './access-event.js'
import { findFirstInvalidBlockIndex, isValidIncomingChain } from './chain-validation.js'

export interface BlockchainOptions {
  batchSize?: number
  flushIntervalMs?: number
  chain?: Block[]
  onBlockAdded?: (chain: Block[]) => void
  onNewBlock?: (block: Block) => void
  onFlushError?: (error: unknown, events: readonly AccessEvent[]) => void
}

const GENESIS_TIMESTAMP = '2026-01-01T00:00:00.000Z'

export class Blockchain {
  public chain: Block[]
  public pending: AccessEvent[] = []
  private readonly batchSize: number
  private readonly flushIntervalMs: number | undefined
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private readonly onBlockAdded: ((chain: Block[]) => void) | undefined
  private readonly onNewBlock: ((block: Block) => void) | undefined
  private readonly onFlushError: BlockchainOptions['onFlushError']

  constructor(options: BlockchainOptions = {}) {
    const batchSize = options.batchSize ?? 1

    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error('batchSize must be a positive integer')
    }

    this.batchSize = batchSize
    this.flushIntervalMs = options.flushIntervalMs
    this.onBlockAdded = options.onBlockAdded
    this.onNewBlock = options.onNewBlock
    this.onFlushError = options.onFlushError
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
    this.onNewBlock?.(newBlock)

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

    try {
      return this.addBlock(events)
    } catch (error) {
      // A block that reached the chain before a hook failed is written by the next save,
      // which stores the whole chain. Re-queuing it would record the events twice.
      if (this.getLatestBlock().data !== events) {
        this.pending = [...events, ...this.pending]
      }
      throw error
    }
  }

  // Nothing up a timer's stack can catch this, and a throw here would take the node down
  // with every queued event still in memory.
  private flushFromTimer(): void {
    const events = this.pending

    try {
      this.flush()
    } catch (error) {
      if (this.onFlushError) {
        this.onFlushError(error, events)
        return
      }
      console.error(
        'Deferred chain flush failed:',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer || this.flushIntervalMs === undefined) {
      return
    }

    this.flushTimer = setTimeout(() => this.flushFromTimer(), this.flushIntervalMs)
    this.flushTimer.unref()
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  replaceChain(incoming: Block[]): boolean {
    const ourGenesis = this.chain[0]

    if (!ourGenesis || incoming.length <= this.chain.length) {
      return false
    }

    if (!isValidIncomingChain(incoming, ourGenesis)) {
      return false
    }

    this.chain = [...incoming]
    this.onBlockAdded?.(this.chain)

    return true
  }

  findFirstInvalidBlockIndex(): number | null {
    return findFirstInvalidBlockIndex(this.chain)
  }

  isChainValid(): boolean {
    return this.findFirstInvalidBlockIndex() === null
  }
}
