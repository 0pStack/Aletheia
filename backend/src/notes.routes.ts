import { logAccessEvent } from './audit-logger.js'
import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import type { Blockchain } from './chain/blockchain.js'
import { createNote, getVisibleNotes } from './notes.js'
import { requireRole } from './rbac.js'
import { fail, ok } from './envelope.js'

interface Patient {
  id: number
  name: string
  personalNumber: string
}

function toIso(sqliteDate: string): string {
  if (sqliteDate.includes('T')) return sqliteDate
  return new Date(`${sqliteDate.replace(' ', 'T')}Z`).toISOString()
}

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

  router.get('/:id', requireRole('DOCTOR', 'NURSE', 'CLINIC', 'PATIENT'), (req, res) => {
    const user = req.session.user
    const patientId = Number(req.params.id)

    if (!user || !Number.isInteger(patientId) || patientId <= 0) {
      return fail(res, 400, 'BAD_REQUEST', 'Valid patient is required.')
    }

    if (user.role === 'PATIENT' && user.patientId !== patientId) {
      logAccessEvent(req, blockchain, patientId, 'DENIED')

      return fail(res, 403, 'FORBIDDEN', 'You do not have permission to access this patient.')
    }

    const patient = db
      .prepare(
        `SELECT
            id,
            name,
            personal_number AS personalNumber
          FROM patients
          WHERE id = ?`,
      )
      .get(patientId) as Patient | undefined

    if (!patient) {
      return fail(res, 404, 'NOT_FOUND', 'Patient not found.')
    }

    const notes = getVisibleNotes(db, patientId, {
      id: user.id,
      role: user.role,
    }).map((note) => ({
      id: note.id,
      authorId: note.author_id,
      authorName: note.author_name,
      authorRole: note.author_role,
      text: note.text,
      visibility: note.visibility,
      createdAt: toIso(note.created_at),
    }))

    logAccessEvent(req, blockchain, patientId, 'READ')

    return ok(res, {
      patient,
      notes,
    })
  })

  return router
}
