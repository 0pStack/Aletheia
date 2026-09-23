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

// text is null on a row the viewer may not read: the query never selects it for them.
export interface VisibleNoteRow extends Omit<NoteRow, 'text'> {
  text: string | null
  author_name: string
  author_role: UserRole
  redacted: 0 | 1
}

// The note as docs/interfaces.md defines it: camelCase, an author to show, an ISO timestamp.
interface NoteBase {
  id: number
  authorId: number
  authorName: string
  authorRole: UserRole
  visibility: NoteVisibility
  createdAt: string
}

export interface ReadableNote extends NoteBase {
  redacted: false
  text: string
}

// A note the viewer may not read: who wrote it and when, and nothing else. There is no
// text field to leave out by accident, because the type does not have one.
export interface RedactedNote extends NoteBase {
  redacted: true
}

export type NoteResponse = ReadableNote | RedactedNote

// SQLite writes 'YYYY-MM-DD HH:MM:SS' in UTC; the API speaks ISO everywhere.
function toIso(sqliteDate: string): string {
  if (sqliteDate.includes('T')) return sqliteDate
  return new Date(`${sqliteDate.replace(' ', 'T')}Z`).toISOString()
}

export function toNoteResponse(row: VisibleNoteRow): NoteResponse {
  const base: NoteBase = {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    visibility: row.visibility,
    createdAt: toIso(row.created_at),
  }

  if (row.redacted === 1 || row.text === null) return { ...base, redacted: true }
  return { ...base, redacted: false, text: row.text }
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

  // Staff also learn that a colleague's PRIVATE note exists, without its text: the CASE
  // leaves the column null for them, so the words never leave the database (issue #83).
  // A patient gets no such stub; that is still an open group decision.
  const readable = `(
    (n.visibility = 'PRIVATE' AND n.author_id = @viewerId)
    OR (n.visibility = 'STAFF' AND @isStaff = 1)
    OR (n.visibility = 'ALL' AND @canSeeAll = 1)
  )`

  const stub = `(@isStaff = 1 AND n.visibility = 'PRIVATE' AND n.author_id <> @viewerId)`

  return db
    .prepare(
      `SELECT n.id,
              n.patient_id,
              n.author_id,
              n.visibility,
              n.created_at,
              u.name AS author_name,
              u.role AS author_role,
              CASE WHEN ${readable} THEN n.text END AS text,
              CASE WHEN ${readable} THEN 0 ELSE 1 END AS redacted
       FROM notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.patient_id = @patientId
         AND (${readable} OR ${stub})
       ORDER BY n.created_at, n.id`,
    )
    .all({
      patientId,
      viewerId: viewer.id,
      isStaff: isStaff ? 1 : 0,
      canSeeAll: canSeeAll ? 1 : 0,
    }) as VisibleNoteRow[]
}
