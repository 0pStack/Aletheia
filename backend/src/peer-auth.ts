import { randomBytes, sign, verify } from 'node:crypto'
import type { KeyPair } from './chain/keypair.js'
import type { TrustedNodeKeys } from './chain/trusted-node-keys.js'

export interface PeerIdentity {
  readonly keyPair: KeyPair
  readonly trustedKeys: TrustedNodeKeys
}

const CHALLENGE_BYTES = 32
const CHALLENGE_PATTERN = /^[A-Za-z0-9+/]{43}=$/

// A node signs whatever challenge the peer it dials sends. Without a prefix, a hostile peer
// could send the bytes of an access event and get back a valid event signature.
const HANDSHAKE_PREFIX = 'aletheia-peer-handshake:'

function handshakePayload(challenge: string): Buffer {
  return Buffer.from(HANDSHAKE_PREFIX + challenge)
}

export function createPeerChallenge(): string {
  return randomBytes(CHALLENGE_BYTES).toString('base64')
}

export function isPeerChallenge(value: string): boolean {
  return CHALLENGE_PATTERN.test(value)
}

export function signPeerChallenge(challenge: string, privateKey: string): string {
  return sign(null, handshakePayload(challenge), privateKey).toString('base64')
}

export function verifyPeerChallenge(
  challenge: string,
  publicKey: string,
  signature: string,
  trustedKeys: TrustedNodeKeys,
): boolean {
  if (!trustedKeys.isTrusted(publicKey)) return false

  try {
    return verify(null, handshakePayload(challenge), publicKey, Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}
