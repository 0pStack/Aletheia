import type { Blockchain } from './chain/blockchain.js'
import type { PeerHandlers } from './websocket.js'

export function createChainSyncHandlers(blockchain: Blockchain): PeerHandlers {
  return {
    getChain: () => [...blockchain.chain],

    onNewBlock: (block, requestChain) => {
      // Both nodes list each other as peers, so every block arrives twice.
      if (blockchain.chain[block.index]?.hash === block.hash) {
        return
      }

      if (blockchain.acceptBlock(block)) {
        return
      }

      if (block.index > blockchain.getLatestBlock().index + 1) {
        console.info(`Peer is ahead at block ${block.index}, requesting its chain`)
        requestChain()
        return
      }

      console.warn(`Rejected invalid incoming block: ${block.index}`)
    },

    onChain: (chain) => {
      if (chain.length <= blockchain.chain.length) {
        return
      }

      if (blockchain.replaceChain([...chain])) {
        console.info(`Synced chain from peer: ${chain.length} blocks`)
        return
      }

      console.warn(`Rejected invalid chain from peer: ${chain.length} blocks`)
    },
  }
}
