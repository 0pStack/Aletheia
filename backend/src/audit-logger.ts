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

// Patient ids never reach this: it goes to the server log, not to the chain.
function recordFailures(
  total: number,
  denied: number,
  error: unknown,
  details: Readonly<Record<string, unknown>>,
): void {
  failures = Object.freeze({
    count: failures.count + total,
    deniedCount: failures.deniedCount + denied,
    lastFailureAt: new Date().toISOString(),
  })

  const headline =
    denied > 0
      ? 'ALERT: a refused access could not be recorded on the audit chain.'
      : 'Could not record an access event on the audit chain.'

  console.error(headline, {
    ...details,
    serverId: resolveServerId(process.env),
    failuresSinceStart: failures.count,
    deniedFailuresSinceStart: failures.deniedCount,
    reason: error instanceof Error ? error.message : 'Unknown error',
  })
}

function requestDetails(req: Request, action: AccessEvent['action']): Record<string, unknown> {
  const user = req.session.user
  return { action, userId: user?.id ?? null, role: user?.role ?? null }
}

function reportFailure(req: Request, action: AccessEvent['action'], error: unknown): void {
  recordFailures(1, action === 'DENIED' ? 1 : 0, error, requestDetails(req, action))
}

function reportBatchFailure(
  error: unknown,
  events: readonly AccessEvent[],
  details: Readonly<Record<string, unknown>>,
): void {
  const denied = events.filter((event) => event.action === 'DENIED').length
  recordFailures(events.length, denied, error, { ...details, events: events.length })
}

// Wired to Blockchain's onFlushError. The events were queued without error, so a batch
// the timer later fails to save is counted here and nowhere else.
export function reportFlushFailure(error: unknown, events: readonly AccessEvent[]): void {
  reportBatchFailure(error, events, { deferredFlush: true })
}

export function logAccessEvent(
  req: Request,
  blockchain: Blockchain,
  patientId: number,
  action: AccessEvent['action'],
  keyPair: KeyPair,
): void {
  let signed: AccessEvent

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

    signed = signAccessEvent(event, keyPair.privateKey, keyPair.publicKey)
  } catch (error) {
    reportFailure(req, action, error)
    throw error
  }

  // addEvent only throws when this event fills the batch and saving it fails, and then
  // every queued event from earlier requests failed with it, not just this one.
  const batch = [...blockchain.pending, signed]

  try {
    blockchain.addEvent(signed)
  } catch (error) {
    reportBatchFailure(error, batch, {
      deferredFlush: false,
      ...requestDetails(req, action),
    })
    throw error
  }
}
