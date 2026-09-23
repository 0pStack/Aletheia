import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import { logAccessEvent } from '../audit-logger.js'
import type { Blockchain } from '../chain/blockchain.js'
import { fail, ok } from '../envelope.js'
import { getVisibleNotes, toNoteResponse } from '../notes/notes.js'
import { requireRole } from '../rbac.js'

interface PatientSummary {
  id: number
  name: string
  personalNumber: string
}

const LIST_LIMIT = 50

function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function createPatientsRouter(db: DatabaseType, blockchain: Blockchain): Router {
  const router = Router()

  router.get('/', requireRole('DOCTOR', 'NURSE', 'CLINIC'), (req, res) => {
    const q = req.query.q

    if (q === undefined) {
      const patients = db
        .prepare(
          `SELECT id, name, personal_number AS personalNumber
           FROM patients
           ORDER BY name, id
           LIMIT ?`,
        )
        .all(LIST_LIMIT) as PatientSummary[]

      return ok(res, patients)
    }

    if (typeof q !== 'string' || q.trim() === '') {
      return fail(res, 400, 'BAD_REQUEST', 'A search query is required.')
    }

    const query = q.trim()
    const namePattern = `%${escapeLikeWildcards(query)}%`
    const numberPattern = `%${escapeLikeWildcards(digitsOnly(query))}%`
    const hasDigits = digitsOnly(query) !== ''

    const patients = db
      .prepare(
        `SELECT id, name, personal_number AS personalNumber
         FROM patients
         WHERE name LIKE ? ESCAPE '\\'
            OR (? = 1 AND REPLACE(personal_number, '-', '') LIKE ? ESCAPE '\\')
         ORDER BY name, id`,
      )
      .all(namePattern, hasDigits ? 1 : 0, numberPattern) as PatientSummary[]

    return ok(res, patients)
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
      .get(patientId) as PatientSummary | undefined

    if (!patient) {
      return fail(res, 404, 'NOT_FOUND', 'Patient not found.')
    }

    const notes = getVisibleNotes(db, patientId, {
      id: user.id,
      role: user.role,
    }).map(toNoteResponse)

    logAccessEvent(req, blockchain, patientId, 'READ')

    return ok(res, {
      patient,
      notes,
    })
  })

  return router
}
