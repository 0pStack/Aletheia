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


export interface VisibleNoteRow extends NoteRow {
  author_name: string
  author_role: UserRole
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

export function getVisibleNotes(
  db: DatabaseType,
  patientId: number,
  viewer: NoteViewer,
): VisibleNoteRow[] {
  const isStaff = viewer.role === 'DOCTOR' || viewer.role === 'NURSE' || viewer.role === 'CLINIC'
  const canSeeAll = isStaff || viewer.role === 'PATIENT'

  return db
    .prepare(
      `SELECT n.*,
              u.name AS author_name,
              u.role AS author_role
       FROM notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.patient_id = ?
         AND (
           (n.visibility = 'PRIVATE' AND n.author_id = ?)
           OR
           (n.visibility = 'STAFF' AND ? = 1)
           OR
           (n.visibility = 'ALL' AND ? = 1)
         )
       ORDER BY n.created_at, n.id`,
    )
    .all(patientId, viewer.id, isStaff ? 1 : 0, canSeeAll ? 1 : 0) as VisibleNoteRow[]
}
