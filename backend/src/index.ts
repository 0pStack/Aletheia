import { createServer } from 'node:http'
import { createApp } from './app.js'
import { loadNodeKeyPair } from './chain/node-identity.js'
import { resolvePort } from './port.js'
import { resolvePeers } from './peers.js'

const keyPair = loadNodeKeyPair()
const port = resolvePort(process.env.PORT)
const peers = resolvePeers(process.env.PEERS)

console.info(`Node public key loaded: ${keyPair.publicKey}`)
console.info(`Configured peers: ${peers.length}`)

const app = createApp()
const server = createServer(app)

server.listen(port, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})
