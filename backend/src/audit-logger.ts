import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import type { Blockchain } from './chain/blockchain.js'
import type { AccessEvent } from './chain/access-event.js'
import { resolveServerId } from './config/server-id.js'
import { signAccessEvent } from './chain/access-event-signing.js'
import type { KeyPair } from './chain/keypair.js'

export interface AuditLogFailures {
  readonly count: number
  readonly deniedCount: number
  readonly lastFailureAt: string | null
}

let failures: AuditLogFailures = Object.freeze({ count: 0, deniedCount: 0, lastFailureAt: null })

export function auditLogFailures(): AuditLogFailures {
  return failures
}

// The patient id is left out on purpose: this goes to the server log, not to the chain.
function reportFailure(req: Request, action: AccessEvent['action'], error: unknown): void {
  failures = Object.freeze({
    count: failures.count + 1,
    deniedCount: failures.deniedCount + (action === 'DENIED' ? 1 : 0),
    lastFailureAt: new Date().toISOString(),
  })

  const user = req.session.user
  const context = {
    action,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    serverId: resolveServerId(process.env),
    failuresSinceStart: failures.count,
    deniedFailuresSinceStart: failures.deniedCount,
    reason: error instanceof Error ? error.message : 'Unknown error',
  }

  const headline =
    action === 'DENIED'
      ? 'ALERT: a refused access could not be recorded on the audit chain.'
      : 'Could not record an access event on the audit chain.'

  console.error(headline, context)
}

export function logAccessEvent(
  req: Request,
  blockchain: Blockchain,
  patientId: number,
  action: AccessEvent['action'],
  keyPair: KeyPair,
): void {
  try {
    const user = req.session.user

    if (!user) {
      throw new Error('Cannot record an access event without a session user.')
    }

    const event: AccessEvent = {
      id: randomUUID(),
      patientId,
      userId: user.id,
      role: user.role,
      action,
      timestamp: new Date().toISOString(),
      serverId: resolveServerId(process.env),
    }

    blockchain.addEvent(signAccessEvent(event, keyPair.privateKey, keyPair.publicKey))
  } catch (error) {
    reportFailure(req, action, error)
    throw error
  }
}
