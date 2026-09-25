import { verifyAccessEvent } from './access-event-signing.js'
import { Block, type BlockData } from './block.js'
import { calculateMerkleRoot } from './merkle.js'
import { hasOnlyAllowedBlockchainPayloadFields } from './payload-security.js'

export function findFirstInvalidBlockIndex(chain: Block[]): number | null {
  const genesisBlock = chain[0]

  if (!genesisBlock || genesisBlock.previousHash !== '0') {
    return 0
  }

  for (let i = 0; i < chain.length; i++) {
    const currentBlock = chain[i]

    if (!currentBlock) {
      return i
    }

    if (currentBlock.merkleRoot !== calculateMerkleRoot(currentBlock.data)) {
      return i
    }

    if (currentBlock.hash !== currentBlock.calculateHash()) {
      return i
    }

    if (!currentBlock.data.every(verifyAccessEvent)) {
      return i
    }

    if (i > 0) {
      const previousBlock = chain[i - 1]

      if (!previousBlock || currentBlock.previousHash !== previousBlock.hash) {
        return i
      }
    }
  }

  return null
}

function isBlockData(value: unknown): value is BlockData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const block = value as Record<string, unknown>

  return (
    typeof block.index === 'number' &&
    typeof block.timestamp === 'string' &&
    Array.isArray(block.data) &&
    block.data.every((event) => typeof event === 'object' && event !== null) &&
    typeof block.previousHash === 'string' &&
    typeof block.merkleRoot === 'string' &&
    typeof block.hash === 'string' &&
    typeof block.nonce === 'number'
  )
}

export function parseChain(json: unknown): Block[] | undefined {
  if (!Array.isArray(json) || !json.every(isBlockData)) {
    return undefined
  }

  return json.map((block) => Block.fromJSON(block))
}

export function isValidIncomingChain(incoming: Block[], ourGenesis: Block): boolean {
  const incomingGenesis = incoming[0]

  if (!incomingGenesis || incomingGenesis.hash !== ourGenesis.hash) {
    return false
  }

  if (!incoming.every((block, position) => block.index === position)) {
    return false
  }

  if (!hasOnlyAllowedBlockchainPayloadFields(incoming)) {
    return false
  }

  return findFirstInvalidBlockIndex(incoming) === null
}
