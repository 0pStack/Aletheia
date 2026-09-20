import { generateKeyPairSync } from 'node:crypto'

export function generateKeyPair(): {
  publicKey: string
  privateKey: string
} {
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
