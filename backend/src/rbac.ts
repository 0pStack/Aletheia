import type { NextFunction, Request, Response } from 'express'
import { logAccessEvent } from './audit-logger.js'
import { Blockchain } from './chain/blockchain.js'
import type { UserRole } from './auth/auth.js'

// The chain is put on app.locals by createApp. Read it defensively: a refusal must stay
// a refusal even if the log is somehow unavailable.
function chainFor(req: Request): Blockchain | undefined {
  const candidate: unknown = req.app?.locals?.blockchain
  return candidate instanceof Blockchain ? candidate : undefined
}

// Only a route that names a patient can be refused *about* a patient. A refused search
// targets nobody yet, so there is no record to attach it to.
function patientIdFor(req: Request): number | undefined {
  const parsed = Number(req.params?.id)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
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
      const patientId = patientIdFor(req)
      if (blockchain && patientId !== undefined) {
        logAccessEvent(req, blockchain, patientId, 'DENIED')
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
