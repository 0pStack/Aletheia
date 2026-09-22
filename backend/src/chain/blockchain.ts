import { Block } from './block.js'
import type { AccessEvent } from './access-event.js'

export class Blockchain {
  public chain: Block[]

  constructor() {
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
