import { createHash } from 'node:crypto'
import type { AccessEvent } from './access-event.js'

export class Block {
  public index: number
  public timestamp: string
  public data: AccessEvent[]
  public previousHash: string
  public hash: string
  public nonce: number

  constructor(
    index: number,
    timestamp: string,
    data: AccessEvent[],
    previousHash: string,
    nonce: number,
  ) {
    this.index = index
    this.timestamp = timestamp
    this.data = data
    this.previousHash = previousHash
    this.nonce = nonce
    this.hash = this.calculateHash()
  }

  calculateHash(): string {
    return createHash('sha256')
      .update(
        `${this.index}${this.timestamp}${JSON.stringify(this.data)}${this.previousHash}${this.nonce}`,
      )
      .digest('hex')
  }
}