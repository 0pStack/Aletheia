import type { Database as DatabaseType } from 'better-sqlite3'
import type { UserRole } from './auth.js'

interface NoteViewer {
  id: number
  role: UserRole
}

type NoteVisibility = 'PRIVATE' | 'STAFF' | 'ALL'

interface CreateNoteInput {
  patientId: number
  authorId: number
  text: string
  visibility: NoteVisibility
}

interface NoteRow {
  id: number
  patient_id: number
  author_id: number
  text: string
  visibility: NoteVisibility
  created_at: string
}

export function createNote(db: DatabaseType, input: CreateNoteInput): NoteRow {
  const result = db
    .prepare(
      `INSERT INTO notes (
        patient_id,
        author_id,
        text,
        visibility
      )
      VALUES (?, ?, ?, ?)`,
    )
    .run(input.patientId, input.authorId, input.text, input.visibility)

  return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as NoteRow
}

export function getVisibleNotes(db: DatabaseType, patientId: number, viewer: NoteViewer) {
  const isStaff = viewer.role === 'DOCTOR' || viewer.role === 'NURSE' || viewer.role === 'CLINIC'

  const canSeeAll = isStaff || viewer.role === 'PATIENT'

  return db
    .prepare(
      `SELECT *
       FROM notes
       WHERE patient_id = ?
         AND (
           (visibility = 'PRIVATE' AND author_id = ?)
           OR
           (visibility = 'STAFF' AND ? = 1)
           OR
           (visibility = 'ALL' AND ? = 1)
         )`,
    )
    .all(patientId, viewer.id, isStaff ? 1 : 0, canSeeAll ? 1 : 0)
}
