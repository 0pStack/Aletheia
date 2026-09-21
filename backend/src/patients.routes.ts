import type { Database as DatabaseType } from 'better-sqlite3'
import { Router, type Response } from 'express'
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

interface PatientSummary {
  id: number
  name: string
  personalNumber: string
}

// The unfiltered list is a browsing aid, not an export: past this many, staff search instead.
const LIST_LIMIT = 50

function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function createPatientsRouter(db: DatabaseType): Router {
  const router = Router()

  router.get('/', requireRole('DOCTOR', 'NURSE', 'CLINIC'), (req, res) => {
    const q = req.query.q

    // Leaving q out is a deliberate "view all"; a blank q is an empty search box sent by mistake.
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

  return router
}
