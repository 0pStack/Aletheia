import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import type { Blockchain } from './blockchain.js'
import type { AccessEvent } from './chain/access-event.js'

export function logAccessEvent(
  req: Request,
  blockchain: Blockchain,
  patientId: number,
  action: AccessEvent['action'],
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

  blockchain.addBlock([event])
}
