import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import { logAccessEvent } from '../audit-logger.js'
import type { Blockchain } from '../chain/blockchain.js'
import { fail, ok } from '../envelope.js'
import { requireRole } from '../rbac.js'
import { createNote } from './notes.js'

export function createNotesRouter(db: DatabaseType, blockchain: Blockchain): Router {
  const router = Router()

  router.post('/:id/notes', requireRole('DOCTOR', 'NURSE', 'CLINIC'), (req, res) => {
    const user = req.session.user
    const patientId = Number(req.params.id)
    const body: unknown = req.body

    const { text, visibility } =
      typeof body === 'object' && body !== null
        ? (body as {
            text?: unknown
            visibility?: unknown
          })
        : {}

    if (
      !user ||
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      typeof text !== 'string' ||
      text.trim() === '' ||
      (visibility !== 'PRIVATE' && visibility !== 'STAFF' && visibility !== 'ALL')
    ) {
      return fail(res, 400, 'BAD_REQUEST', 'Valid patient, text and visibility are required.')
    }

    const note = createNote(db, {
      patientId,
      authorId: user.id,
      text: text.trim(),
      visibility,
    })

    logAccessEvent(req, blockchain, patientId, 'WRITE')

    return ok(res, note)
  })

  return router
}
