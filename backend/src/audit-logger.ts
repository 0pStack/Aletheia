import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import type { Blockchain } from './chain/blockchain.js'
import type { AccessEvent } from './chain/access-event.js'
import { signAccessEvent } from './chain/access-event-signing.js'
import type { KeyPair } from './chain/keypair.js'

export function logAccessEvent(
  req: Request,
  blockchain: Blockchain,
  patientId: number,
  action: AccessEvent['action'],
  keyPair: KeyPair,
): void {
  const user = req.session.user

  if (!user) {
    return
  }

  const event: AccessEvent = {
    id: randomUUID(),
    patientId,
    userId: user.id,
    role: user.role,
    action,
    timestamp: new Date().toISOString(),
    serverId: 'server-1',
  }

  blockchain.addEvent(signAccessEvent(event, keyPair.privateKey, keyPair.publicKey))
}
