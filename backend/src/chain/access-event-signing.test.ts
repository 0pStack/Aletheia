import { verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { generateKeyPair } from './keypair.js'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent } from './access-event-signing.js'
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
