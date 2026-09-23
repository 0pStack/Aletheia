import { createHash } from 'node:crypto'
import type { AccessEvent } from './access-event.js'
import { calculateMerkleRoot } from './merkle.js'

export interface BlockData {
  index: number
  timestamp: string
  data: AccessEvent[]
  previousHash: string
  merkleRoot: string
  hash: string
  nonce: number
}

export class Block {
  public index: number
  public timestamp: string
  public data: AccessEvent[]
  public merkleRoot: string
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
    this.merkleRoot = calculateMerkleRoot(data)
    this.hash = this.calculateHash()
  }

  calculateHash(): string {
    return createHash('sha256')
      .update(`${this.index}${this.timestamp}${this.merkleRoot}${this.previousHash}${this.nonce}`)
      .digest('hex')
  }

  static fromJSON(json: BlockData): Block {
    const block = new Block(json.index, json.timestamp, json.data, json.previousHash, json.nonce)

    block.merkleRoot = json.merkleRoot
    block.hash = json.hash

    return block
  }
}
