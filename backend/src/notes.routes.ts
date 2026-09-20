import type { Database as DatabaseType } from 'better-sqlite3'
import { Router, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import type { Blockchain } from './blockchain.js'
import { createNote, getVisibleNotes } from './notes.js'
import { requireRole } from './rbac.js'

function ok<T>(res: Response, data: T): Response {
  return res.status(200).json({
    success: true,
    data,
    error: null,
  })
}

function fail(res: Response, status: number, code: string, message: string): Response {
  return res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  })
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

    return ok(res, note)
  })

  router.get('/:id', requireRole('DOCTOR', 'NURSE', 'CLINIC', 'PATIENT'), (req, res) => {
    const user = req.session.user
    const patientId = Number(req.params.id)

    if (!user || !Number.isInteger(patientId) || patientId <= 0) {
      return fail(res, 400, 'BAD_REQUEST', 'Valid patient is required.')
    }

    if (user.role === 'PATIENT' && user.patientId !== patientId) {
      blockchain.addBlock([
        {
          id: randomUUID(),
          patientId,
          userId: user.id,
          role: user.role,
          action: 'DENIED',
          timestamp: new Date().toISOString(),
          serverId: 'server-1',
        },
      ])

      return fail(res, 403, 'FORBIDDEN', 'You do not have permission to access this patient.')
    }

    const patient = db
      .prepare(
        `SELECT
            id,
            name,
            personal_number,
            created_at
          FROM patients
          WHERE id = ?`,
      )
      .get(patientId)

    if (!patient) {
      return fail(res, 404, 'NOT_FOUND', 'Patient not found.')
    }

    const notes = getVisibleNotes(db, patientId, {
      id: user.id,
      role: user.role,
    })

    return ok(res, {
      patient,
      notes,
    })
  })

  return router
}
