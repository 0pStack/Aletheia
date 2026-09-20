import { describe, expect, it } from 'vitest'
import { generateKeyPair } from './keypair.js'

describe('generateKeyPair', () => {
  it('generates a public key and a private key', () => {
    const keyPair = generateKeyPair()

    expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----')
    expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----')
  })

  it('generates different public and private keys', () => {
    const keyPair = generateKeyPair()

    expect(keyPair.publicKey).not.toBe(keyPair.privateKey)
  })

  it('generates a new keypair on each call', () => {
    const keyPair1 = generateKeyPair()
    const keyPair2 = generateKeyPair()

    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey)
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey)
  })
})
