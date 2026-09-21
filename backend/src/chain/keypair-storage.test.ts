import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadOrCreateKeyPair } from './keypair-storage.js'

describe('loadOrCreateKeyPair', () => {
  it('creates and then reloads the same keypair', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aletheia-keys-'))
    const filePath = join(directory, 'node-key')

    const firstKeyPair = loadOrCreateKeyPair(filePath)
    const secondKeyPair = loadOrCreateKeyPair(filePath)

    expect(firstKeyPair.publicKey).toBe(secondKeyPair.publicKey)
    expect(firstKeyPair.privateKey).toBe(secondKeyPair.privateKey)
  })

  it('stores the private key with owner-only permissions', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aletheia-keys-'))
    const filePath = join(directory, 'node-key')

    loadOrCreateKeyPair(filePath)

    const privateKeyPath = `${filePath}.private.pem`
    const permissions = statSync(privateKeyPath).mode & 0o777

    expect(permissions).toBe(0o600)
  })

  it('stores both public and private key files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aletheia-keys-'))
    const filePath = join(directory, 'node-key')

    const keyPair = loadOrCreateKeyPair(filePath)

    expect(readFileSync(`${filePath}.public.pem`, 'utf8')).toBe(keyPair.publicKey)
    expect(readFileSync(`${filePath}.private.pem`, 'utf8')).toBe(keyPair.privateKey)
  })
})
