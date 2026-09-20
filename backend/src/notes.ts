import type { Database as DatabaseType } from 'better-sqlite3'
import type { UserRole } from './auth.js'

interface NoteViewer {
  id: number
  role: UserRole
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
