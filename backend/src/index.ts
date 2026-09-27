import { createServer } from 'node:http'
import { createApp } from './app.js'
import { reportFlushFailure } from './audit-logger.js'
import { loadNodeKeyPair } from './chain/node-identity.js'
import { resolvePort } from './config/port.js'
import { resolvePeers } from './config/peers.js'
import { attachWebSocketServer } from './websocket.js'
import { Blockchain } from './chain/blockchain.js'
import { loadChain, saveChain } from './chain/chain-storage.js'
import { createChainSyncHandlers } from './peer-sync.js'

const keyPair = loadNodeKeyPair()
const port = resolvePort(process.env.PORT)
const peers = resolvePeers(process.env.PEERS)

console.info(`Node public key loaded: ${keyPair.publicKey}`)
console.info(`Configured peers: ${peers.length}`)

const chainPath = `./data/chain-${port}.json`
const savedChain = loadChain(chainPath)

const blockchain = new Blockchain({
  batchSize: 5,
  flushIntervalMs: 2000,
  chain: savedChain,
  onBlockAdded: (chain) => saveChain(chainPath, chain),
  onFlushError: reportFlushFailure,
  onNewBlock: (block) => {
    webSocketServer.broadcast({
      type: 'NEW_BLOCK',
      block,
    })
  },
})

const server = createServer()
const webSocketServer = attachWebSocketServer(server, peers, createChainSyncHandlers(blockchain))

if (!savedChain) {
  console.info(`No saved chain found, starting a new one in ${chainPath}`)
} else if (blockchain.isChainValid()) {
  console.info(`Loaded ${blockchain.chain.length} blocks from ${chainPath}`)
} else {
  console.warn(
    `WARNING: the saved chain in ${chainPath} is INVALID. It may have been tampered with.`,
  )
}
const app = createApp({ blockchain, keyPair })
server.on('request', app)

server.listen(port, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})

function shutdown(signal: string): void {
  console.info(`${signal} received, flushing pending events`)
  blockchain.flush()
  process.exit(0)
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
