import { generateKeyPairSync } from 'node:crypto'

export interface KeyPair {
  publicKey: string
  privateKey: string
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })

  return {
    publicKey,
    privateKey,
  }
}
