import type { Database as DatabaseType } from 'better-sqlite3'
import type { UserRole } from '../auth/auth.js'

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

// The note as docs/interfaces.md defines it: camelCase, an author to show, an ISO timestamp.
export interface NoteResponse {
  id: number
  authorId: number
  authorName: string
  authorRole: UserRole
  text: string
  visibility: NoteVisibility
  createdAt: string
}

// SQLite writes 'YYYY-MM-DD HH:MM:SS' in UTC; the API speaks ISO everywhere.
function toIso(sqliteDate: string): string {
  if (sqliteDate.includes('T')) return sqliteDate
  return new Date(`${sqliteDate.replace(' ', 'T')}Z`).toISOString()
}

export function toNoteResponse(row: VisibleNoteRow): NoteResponse {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    text: row.text,
    visibility: row.visibility,
    createdAt: toIso(row.created_at),
  }
}

export function patientExists(db: DatabaseType, patientId: number): boolean {
  return db.prepare('SELECT 1 FROM patients WHERE id = ?').get(patientId) !== undefined
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
