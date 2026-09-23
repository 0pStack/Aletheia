import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import { logAccessEvent } from '../audit-logger.js'
import type { Blockchain } from '../chain/blockchain.js'
import { fail, ok } from '../envelope.js'
import { requireRole } from '../rbac.js'
import { createNote, patientExists, toNoteResponse } from './notes.js'

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

    // Without this the insert fails on the foreign key, which used to surface as an
    // HTML error page instead of an envelope.
    if (!patientExists(db, patientId)) {
      return fail(res, 404, 'NOT_FOUND', 'Patient not found.')
    }

    const note = createNote(db, {
      patientId,
      authorId: user.id,
      text: text.trim(),
      visibility,
    })

    logAccessEvent(req, blockchain, patientId, 'WRITE')

    // The author is whoever is signed in, so the row does not need joining back to users.
    return ok(res, toNoteResponse({ ...note, author_name: user.name, author_role: user.role }))
  })

  return router
}
