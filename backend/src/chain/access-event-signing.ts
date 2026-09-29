import { sign, verify } from 'node:crypto'
import type { AccessEvent } from './access-event.js'
import { stableStringify } from './stable-stringify.js'
import type { TrustedNodeKeys } from './trusted-node-keys.js'

export function signAccessEvent(
  event: AccessEvent,
  privateKey: string,
  publicKey: string,
): AccessEvent {
  const unsignedEvent = getUnsignedAccessEvent(event)

  const data = stableStringify(unsignedEvent)

  const signature = sign(null, Buffer.from(data), privateKey).toString('base64')

  return {
    ...unsignedEvent,
    signature,
    publicKey,
  }
}

// Without trustedKeys this only proves the event matches the key it carries, which anyone
// can generate. Anything that decides whether to believe an event must pass trustedKeys.
export function verifyAccessEvent(event: AccessEvent, trustedKeys?: TrustedNodeKeys): boolean {
  if (!event.signature || !event.publicKey) return false
  if (trustedKeys && !trustedKeys.isTrusted(event.publicKey)) return false

  try {
    const data = stableStringify(getUnsignedAccessEvent(event))
    return verify(null, Buffer.from(data), event.publicKey, Buffer.from(event.signature, 'base64'))
  } catch {
    return false
  }
}

function getUnsignedAccessEvent(event: AccessEvent) {
  return {
    id: event.id,
    patientId: event.patientId,
    userId: event.userId,
    role: event.role,
    action: event.action,
    timestamp: event.timestamp,
    serverId: event.serverId,
  }
}
