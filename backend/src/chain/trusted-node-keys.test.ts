import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateKeyPair } from './keypair.js'
import { createTrustedNodeKeys, loadTrustedNodeKeys } from './trusted-node-keys.js'

const ownKeys = generateKeyPair()
const peerKeys = generateKeyPair()
const strangerKeys = generateKeyPair()

function keyDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'aletheia-trusted-'))
}

describe('createTrustedNodeKeys', () => {
  it('trusts only the keys it was given', () => {
    const trusted = createTrustedNodeKeys([ownKeys.publicKey, peerKeys.publicKey])

    expect(trusted.isTrusted(ownKeys.publicKey)).toBe(true)
    expect(trusted.isTrusted(peerKeys.publicKey)).toBe(true)
    expect(trusted.isTrusted(strangerKeys.publicKey)).toBe(false)
  })

  it('matches a key regardless of line endings and surrounding whitespace', () => {
    const trusted = createTrustedNodeKeys([ownKeys.publicKey.replace(/\n/g, '\r\n')])

    expect(trusted.isTrusted(`  ${ownKeys.publicKey}\n`)).toBe(true)
  })

  it('does not trust something that is not a public key', () => {
    const trusted = createTrustedNodeKeys([ownKeys.publicKey])

    expect(trusted.isTrusted('not a key')).toBe(false)
    expect(trusted.isTrusted('')).toBe(false)
  })

  it('refuses to start from a malformed trusted key', () => {
    expect(() => createTrustedNodeKeys(['not a key'])).toThrow()
  })
})

describe('loadTrustedNodeKeys', () => {
  it('trusts the node own key when the directory does not exist', () => {
    const trusted = loadTrustedNodeKeys(join(keyDirectory(), 'missing'), ownKeys.publicKey)

    expect(trusted.isTrusted(ownKeys.publicKey)).toBe(true)
    expect(trusted.isTrusted(peerKeys.publicKey)).toBe(false)
  })

  it('trusts every .public.pem file in the directory plus the node own key', () => {
    const directory = keyDirectory()
    writeFileSync(join(directory, 'node-3002.public.pem'), peerKeys.publicKey)
    writeFileSync(join(directory, 'notes.txt'), strangerKeys.publicKey)

    const trusted = loadTrustedNodeKeys(directory, ownKeys.publicKey)

    expect(trusted.isTrusted(ownKeys.publicKey)).toBe(true)
    expect(trusted.isTrusted(peerKeys.publicKey)).toBe(true)
    expect(trusted.isTrusted(strangerKeys.publicKey)).toBe(false)
  })

  it('names the file when a trusted key cannot be read as a public key', () => {
    const directory = keyDirectory()
    writeFileSync(join(directory, 'broken.public.pem'), 'garbage')

    expect(() => loadTrustedNodeKeys(directory, ownKeys.publicKey)).toThrow(/broken\.public\.pem/)
  })
})
