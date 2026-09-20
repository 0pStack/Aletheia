import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { KeyPair } from './keypair.js'
import { generateKeyPair } from './keypair.js'

export function loadOrCreateKeyPair(filePath: string): KeyPair {
  try {
    const publicKey = readFileSync(`${filePath}.public.pem`, 'utf8')
    const privateKey = readFileSync(`${filePath}.private.pem`, 'utf8')

    return {
      publicKey,
      privateKey,
    }
  } catch {
    const keyPair = generateKeyPair()

    mkdirSync(dirname(filePath), { recursive: true })

    writeFileSync(`${filePath}.public.pem`, keyPair.publicKey, {
      mode: 0o644,
    })

    writeFileSync(`${filePath}.private.pem`, keyPair.privateKey, {
      mode: 0o600,
    })

    return keyPair
  }
}
