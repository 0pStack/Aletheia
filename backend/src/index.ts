import { createApp } from './app.js'
import { loadNodeKeyPair } from './chain/node-identity.js'
import { resolvePort } from './port.js'

const keyPair = loadNodeKeyPair()
const port = resolvePort(process.env.PORT)

console.info(`Node public key loaded: ${keyPair.publicKey}`)

createApp().listen(port, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})
