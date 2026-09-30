import { sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { generateKeyPair } from './chain/keypair.js'
import { createTrustedNodeKeys } from './chain/trusted-node-keys.js'
import {
  createPeerChallenge,
  isPeerChallenge,
  signPeerChallenge,
  verifyPeerChallenge,
} from './peer-auth.js'

describe('peer challenge handshake', () => {
  const node = generateKeyPair()
  const stranger = generateKeyPair()
  const trustedKeys = createTrustedNodeKeys([node.publicKey])

  it('creates a different well-formed challenge every time', () => {
    const first = createPeerChallenge()
    const second = createPeerChallenge()

    expect(first).not.toBe(second)
    expect(isPeerChallenge(first)).toBe(true)
  })

  it('accepts a challenge signed by a trusted node', () => {
    const challenge = createPeerChallenge()
    const signature = signPeerChallenge(challenge, node.privateKey)

    expect(verifyPeerChallenge(challenge, node.publicKey, signature, trustedKeys)).toBe(true)
  })

  it('rejects a valid signature from a key that is not trusted', () => {
    const challenge = createPeerChallenge()
    const signature = signPeerChallenge(challenge, stranger.privateKey)

    expect(verifyPeerChallenge(challenge, stranger.publicKey, signature, trustedKeys)).toBe(false)
  })

  it('rejects a trusted key paired with a signature it did not make', () => {
    const challenge = createPeerChallenge()
    const signature = signPeerChallenge(challenge, stranger.privateKey)

    expect(verifyPeerChallenge(challenge, node.publicKey, signature, trustedKeys)).toBe(false)
  })

  it('rejects a signature replayed against a new challenge', () => {
    const signature = signPeerChallenge(createPeerChallenge(), node.privateKey)

    expect(verifyPeerChallenge(createPeerChallenge(), node.publicKey, signature, trustedKeys)).toBe(
      false,
    )
  })

  it('rejects a signature over the bare challenge without the handshake prefix', () => {
    const challenge = createPeerChallenge()
    const bare = sign(null, Buffer.from(challenge), node.privateKey).toString('base64')

    expect(verifyPeerChallenge(challenge, node.publicKey, bare, trustedKeys)).toBe(false)
  })

  it('rejects garbage instead of throwing', () => {
    const challenge = createPeerChallenge()

    expect(verifyPeerChallenge(challenge, 'not a key', 'not a signature', trustedKeys)).toBe(false)
    expect(verifyPeerChallenge(challenge, node.publicKey, '', trustedKeys)).toBe(false)
  })

  it.each([
    ['empty', ''],
    ['too short', 'abc='],
    ['JSON that could pass for an event', '{"id":"x","patientId":1}'],
  ])('does not treat %s as a challenge', (_label, value) => {
    expect(isPeerChallenge(value)).toBe(false)
  })
})
