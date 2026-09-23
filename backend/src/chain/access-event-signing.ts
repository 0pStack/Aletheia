import { sign } from 'node:crypto'
import type { AccessEvent } from './access-event.js'
import { stableStringify } from './stable-stringify.js'

export function signAccessEvent(
  event: AccessEvent,
  privateKey: string,
  publicKey: string,
): AccessEvent {
  const unsignedEvent = {
    id: event.id,
    patientId: event.patientId,
    userId: event.userId,
    role: event.role,
    action: event.action,
    timestamp: event.timestamp,
    serverId: event.serverId,
  }

  const data = stableStringify(unsignedEvent)

  const signature = sign(null, Buffer.from(data), privateKey).toString('base64')

  return {
    ...unsignedEvent,
    signature,
    publicKey,
  }
}
