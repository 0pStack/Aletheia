import type { KeyPair } from './keypair.js'
import { loadOrCreateKeyPair } from './keypair-storage.js'

export function loadNodeKeyPair(): KeyPair {
  return loadOrCreateKeyPair('./keys/node-key')
}
