import { createPublicKey } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TrustedNodeKeys {
  isTrusted(publicKey: string): boolean
}

const PUBLIC_KEY_SUFFIX = '.public.pem'

// The same key can arrive as different PEM text (CRLF from a Windows checkout, a trailing
// newline), so keys are compared by their DER bytes, not by the string.
function fingerprint(publicKey: string): string {
  return createPublicKey(publicKey.trim())
    .export({ type: 'spki', format: 'der' })
    .toString('base64')
}

export function createTrustedNodeKeys(publicKeys: readonly string[]): TrustedNodeKeys {
  const fingerprints = new Set(publicKeys.map(fingerprint))

  return {
    isTrusted(publicKey: string): boolean {
      try {
        return fingerprints.has(fingerprint(publicKey))
      } catch {
        return false
      }
    },
  }
}

function readTrustedKeyFiles(directory: string): string[] {
  let fileNames: string[]

  try {
    fileNames = readdirSync(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  return fileNames
    .filter((fileName) => fileName.endsWith(PUBLIC_KEY_SUFFIX))
    .map((fileName) => {
      const publicKey = readFileSync(join(directory, fileName), 'utf8')
      try {
        fingerprint(publicKey)
      } catch {
        throw new Error(`Trusted node key ${fileName} is not a valid public key`)
      }
      return publicKey
    })
}

// A node always trusts its own key, so a single node works with no key directory at all.
export function loadTrustedNodeKeys(directory: string, ownPublicKey: string): TrustedNodeKeys {
  return createTrustedNodeKeys([ownPublicKey, ...readTrustedKeyFiles(directory)])
}
