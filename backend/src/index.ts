import { createServer } from 'node:http'
import { createApp } from './app.js'
import { loadNodeKeyPair } from './chain/node-identity.js'
import { resolvePort } from './config/port.js'
import { resolvePeers } from './config/peers.js'
import { attachWebSocketServer } from './websocket.js'
import { Blockchain } from './chain/blockchain.js'

const keyPair = loadNodeKeyPair()
const port = resolvePort(process.env.PORT)
const peers = resolvePeers(process.env.PEERS)

console.info(`Node public key loaded: ${keyPair.publicKey}`)
console.info(`Configured peers: ${peers.length}`)

const blockchain = new Blockchain({ batchSize: 5, flushIntervalMs: 2000 })
const app = createApp({ blockchain })
const server = createServer(app)
attachWebSocketServer(server)

server.listen(port, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})
