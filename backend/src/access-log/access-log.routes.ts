import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import { logAccessEvent } from '../audit-logger.js'
import type { Blockchain } from '../chain/blockchain.js'
import type { KeyPair } from '../chain/keypair.js'
import { fail, ok } from '../envelope.js'
import { patientExists } from '../notes/notes.js'
import { requireRole } from '../rbac.js'
import { collectAccessLog } from './access-log.js'

export function createAccessLogRouter(
  db: DatabaseType,
  blockchain: Blockchain,
  keyPair: KeyPair,
): Router {
  const router = Router()

  router.get('/:id/access-log', requireRole('DOCTOR', 'NURSE', 'CLINIC', 'PATIENT'), (req, res) => {
    const user = req.session.user
    const patientId = Number(req.params.id)

    if (!user || !Number.isInteger(patientId) || patientId <= 0) {
      return fail(res, 400, 'BAD_REQUEST', 'A valid patient id is required.')
    }

    // Checked before existence, so a patient cannot probe which ids exist.
    if (user.role === 'PATIENT' && user.patientId !== patientId) {
      logAccessEvent(req, blockchain, patientId, 'DENIED', keyPair)
      return fail(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource.')
    }

    if (!patientExists(db, patientId)) {
      return fail(res, 404, 'NOT_FOUND', 'Patient not found.')
    }

    // Reading the log is not itself logged: it would bury the reads that matter under
    // a trail of people checking the trail.
    return ok(res, collectAccessLog(db, blockchain, patientId))
  })

  return router
}
