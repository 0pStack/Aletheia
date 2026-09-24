import type { NextFunction, Request, Response } from 'express'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { logAccessEvent } from './audit-logger.js'
import { Blockchain } from './chain/blockchain.js'
import type { KeyPair } from './chain/keypair.js'
import { patientExists } from './notes/notes.js'
import type { UserRole } from './auth/auth.js'

// The chain is put on app.locals by createApp. Read it defensively: a refusal must stay
// a refusal even if the log is somehow unavailable.
function chainFor(req: Request): Blockchain | undefined {
  const candidate: unknown = req.app?.locals?.blockchain
  return candidate instanceof Blockchain ? candidate : undefined
}

function dbFor(req: Request): DatabaseType | undefined {
  const candidate: unknown = req.app?.locals?.db
  return candidate instanceof Database ? candidate : undefined
}

function keyPairFor(req: Request): KeyPair | undefined {
  const candidate: unknown = req.app?.locals?.keyPair
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const { publicKey, privateKey } = candidate as Record<string, unknown>
  return typeof publicKey === 'string' && typeof privateKey === 'string'
    ? { publicKey, privateKey }
    : undefined
}

// Only a route that names a real patient can be refused *about* a patient. A refused
// search targets nobody yet, and an id that belongs to no one is not an incident in
// anybody's history — writing it anyway would let a refused account push chosen noise
// into a chosen patient's record, permanently, since the chain cannot be corrected.
function refusedPatientId(req: Request): number | undefined {
  const parsed = Number(req.params?.id)
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined

  const db = dbFor(req)
  if (!db || !patientExists(db, parsed)) return undefined

  return parsed
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session.user

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
        },
      })
    }

    if (!allowedRoles.includes(user.role)) {
      // The reaches that matter most are the ones that were refused. Without this, a
      // curious employee is the only visitor who leaves no trace.
      const blockchain = chainFor(req)
      const keyPair = keyPairFor(req)
      const patientId = refusedPatientId(req)
      if (blockchain && keyPair && patientId !== undefined) {
        // A failed write must not turn the refusal into a 500, which would tell the caller
        // something about the node instead of simply saying no.
        try {
          logAccessEvent(req, blockchain, patientId, 'DENIED', keyPair)
        } catch (error) {
          console.error('Could not record a refused access event:', error)
        }
      }

      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      })
    }

    next()
  }
}
