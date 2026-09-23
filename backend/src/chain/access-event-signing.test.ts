import { verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { generateKeyPair } from './keypair.js'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent, verifyAccessEvent } from './access-event-signing.js'
import { stableStringify } from './stable-stringify.js'

describe('signAccessEvent', () => {
  it('signs an access event with the private key', () => {
    const keyPair = generateKeyPair()

    const event: AccessEvent = {
      id: 'event-1',
      patientId: 1,
      userId: 10,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-23T12:00:00.000Z',
      serverId: 'server-1',
    }

    const signedEvent = signAccessEvent(event, keyPair.privateKey, keyPair.publicKey)

    expect(signedEvent.signature).toBeDefined()
    expect(signedEvent.signature).not.toBe('')
    expect(signedEvent.publicKey).toBe(keyPair.publicKey)
  })

  it('does not modify the original access event', () => {
    const keyPair = generateKeyPair()

    const event: AccessEvent = {
      id: 'event-2',
      patientId: 2,
      userId: 20,
      role: 'NURSE',
      action: 'WRITE',
      timestamp: '2026-09-23T13:00:00.000Z',
      serverId: 'server-1',
    }

    signAccessEvent(event, keyPair.privateKey, keyPair.publicKey)

    expect(event.signature).toBeUndefined()
    expect(event.publicKey).toBeUndefined()
  })

  it('creates a signature that is valid for the access event', () => {
    const keyPair = generateKeyPair()

    const event: AccessEvent = {
      id: 'event-3',
      patientId: 3,
      userId: 30,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-23T14:00:00.000Z',
      serverId: 'server-1',
    }

    const signedEvent = signAccessEvent(event, keyPair.privateKey, keyPair.publicKey)

    const data = stableStringify(event)

    expect(signedEvent.signature).toBeDefined()

    if (!signedEvent.signature) {
      throw new Error('Expected signed event to contain a signature')
    }

    const isValid = verify(
      null,
      Buffer.from(data),
      keyPair.publicKey,
      Buffer.from(signedEvent.signature, 'base64'),
    )

    expect(isValid).toBe(true)
  })
})

describe('verifyAccessEvent', () => {
  const event: AccessEvent = {
    id: 'event-verify',
    patientId: 1,
    userId: 10,
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-09-23T12:00:00.000Z',
    serverId: 'server-1',
  }

  it('verifies a signature over the unsigned access event fields', () => {
    const keys = generateKeyPair()
    expect(verifyAccessEvent(signAccessEvent(event, keys.privateKey, keys.publicKey))).toBe(true)
  })

  it('rejects an event with a forged signature', () => {
    const signer = generateKeyPair()
    const attacker = generateKeyPair()
    const forged = signAccessEvent(event, attacker.privateKey, signer.publicKey)
    expect(verifyAccessEvent(forged)).toBe(false)
  })

  it('rejects missing signatures, missing public keys, and malformed signatures', () => {
    const keys = generateKeyPair()
    const signed = signAccessEvent(event, keys.privateKey, keys.publicKey)
    expect(verifyAccessEvent(event)).toBe(false)
    expect(verifyAccessEvent({ ...signed, signature: undefined })).toBe(false)
    expect(verifyAccessEvent({ ...signed, publicKey: undefined })).toBe(false)
    expect(verifyAccessEvent({ ...signed, signature: 'not-base64-signature' })).toBe(false)
  })

  it('rejects changes to signed fields', () => {
    const keys = generateKeyPair()
    const signed = signAccessEvent(event, keys.privateKey, keys.publicKey)
    expect(verifyAccessEvent({ ...signed, action: 'WRITE' })).toBe(false)
  })
})
